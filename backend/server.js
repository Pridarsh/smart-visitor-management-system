// server.js — CampusGate API
// Phase-6/7: Cosmos DB + GenAI classifyPurpose + Queue trigger for pass generation

// 🔴 NEW (1): bring in dotenv first so env vars are ready for App Insights
import dotenv from "dotenv";
dotenv.config();

// 🔴 NEW (2): import applicationinsights
import appInsights from "applicationinsights";

// 🔴 NEW (3): init Application Insights before creating the Express app
if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
  appInsights
    .setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectConsole(true)
    .setSendLiveMetrics(true)
    .start();

  appInsights.defaultClient.trackTrace({
    message: "✅ Application Insights telemetry initialized for CampusGate backend"
  });
} else {
  console.warn("⚠ APPINSIGHTS_INSTRUMENTATIONKEY not found. Telemetry will NOT be sent.");
}
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import Joi from "joi";
import { v4 as uuid } from "uuid";
import { CosmosClient } from "@azure/cosmos";
import { classifyPurpose, summarizeToday } from "./ai.js";
            // Azure OpenAI classifier
import { enqueuePassRequest } from "./services/queue.js"; // <-- Queue helper

dotenv.config();

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

/* -------------------------------------------------------------------------- */
/* Cosmos setup (falls back to in-memory store if env not provided)           */
/* -------------------------------------------------------------------------- */
const useCosmos = !!process.env.COSMOS_DB_CONN;
let cosmos = null;

if (useCosmos) {
  const COSMOS_DB_CONN = process.env.COSMOS_DB_CONN;                  // AccountEndpoint=...;AccountKey=...
  const COSMOS_DB_NAME = process.env.COSMOS_DB_NAME || "campusgate";
  const COSMOS_CONTAINER = process.env.COSMOS_CONTAINER || "visitors";

  const client = new CosmosClient(COSMOS_DB_CONN);
  const database = client.database(COSMOS_DB_NAME);
  const container = database.container(COSMOS_CONTAINER);
  cosmos = { client, database, container };

  console.log(`[Cosmos] Connected DB='${COSMOS_DB_NAME}', container='${COSMOS_CONTAINER}'`);
} else {
  console.warn("[Cosmos] COSMOS_DB_CONN not set — using in-memory store.");
}

// In-memory fallback (for local dev without Cosmos)
const mem = { visitors: [] };

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */
const visitorSchema = Joi.object({
  firstName: Joi.string().max(60).required(),
  lastName: Joi.string().max(60).required(),
  phone: Joi.string().max(20).required(),
  email: Joi.string().email().required(),
  reasonForVisit: Joi.string().max(500).required(),
});

/* -------------------------------------------------------------------------- */
/* Data helpers                                                               */
/* -------------------------------------------------------------------------- */
async function saveVisitor(doc) {
  if (cosmos) {
    const toWrite = { ...doc, partitionKey: doc.id }; // if container PK is /partitionKey
    const { resource } = await cosmos.container.items.upsert(toWrite);
    return resource;
  }
  mem.visitors.unshift(doc);
  return doc;
}

async function fetchAll(limit = 100) {
  if (cosmos) {
    const { resources } = await cosmos.container.items
      .query({
        query: "SELECT TOP @limit * FROM c ORDER BY c._ts DESC",
        parameters: [{ name: "@limit", value: limit }],
      })
      .fetchAll();
    return resources;
  }
  return mem.visitors.slice(0, limit);
}

async function fetchRecent(limit = 10) {
  return fetchAll(limit);
}


async function countToday() {
  const now = new Date();
  const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const startEpoch = Math.floor(startUtc.getTime() / 1000); // _ts is seconds

  if (cosmos) {
    const { resources } = await cosmos.container.items
      .query({
        query: "SELECT VALUE COUNT(1) FROM c WHERE c._ts >= @start",
        parameters: [{ name: "@start", value: startEpoch }],
      })
      .fetchAll();
    return resources[0] ?? 0;
  }
  // memory fallback
  return mem.visitors.filter(v => (v._ts || 0) * 1000 >= startUtc.getTime()).length;
}

async function countByStatus(status) {
  if (cosmos) {
    const { resources } = await cosmos.container.items
      .query({
        query: "SELECT VALUE COUNT(1) FROM c WHERE c.status = @s",
        parameters: [{ name: "@s", value: status }],
      })
      .fetchAll();
    return resources[0] ?? 0;
  }
  return mem.visitors.filter(v => v.status === status).length;
}

async function countThisMonth() {
  const now = new Date();
  const monthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (cosmos) {
    const { resources } = await cosmos.container.items
      .query({
        query: "SELECT VALUE COUNT(1) FROM c WHERE STARTSWITH(c.date, @m, true)",
        parameters: [{ name: "@m", value: monthPrefix }],
      })
      .fetchAll();
    return resources[0] ?? 0;
  }
  return mem.visitors.filter(v => (v.date || "").startsWith(monthPrefix)).length;
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

// Health
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    storage: useCosmos ? "cosmos" : "memory",
  });
});

// Create visitor
app.post("/api/visitors", async (req, res) => {
  try {
    const { error, value } = visitorSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const id = `VIS-${new Date().getFullYear()}-${uuid().slice(0, 8)}`;
    const date = new Date().toISOString().slice(0, 10);

    // GenAI classification (safe fallback)
let label = "OTHER";
let labelConfidence = 0.5;
try {
  const { classifyWithConfidence } = await import("./ai.js");
  const out = await classifyWithConfidence(value.reasonForVisit);
  label = out.label;
  labelConfidence = out.confidence;
} catch {
  // keep defaults
}

const doc = {
  id,
  ...value,
  label,
  labelConfidence,           // << save it
  status: "PENDING",
  date,
  createdAt: new Date().toISOString(),
};


    const saved = await saveVisitor(doc);

    try { await enqueuePassRequest({ id: saved.id, email: saved.email }); } catch (e) {
      console.warn("enqueuePassRequest failed:", e?.message || e);
    }

    res.status(201).json({ ok: true, visitor: saved });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create visitor" });
  }
});

// List visitors (supports ?status=... & ?today=1). If you also want a hard limit, add &limit=200.
app.get("/api/visitors", async (req, res) => {
  try {
    const { status, today, limit } = req.query;
    let rows = await fetchAll(Math.min(parseInt(limit || "500", 10), 500));

    if (status) rows = rows.filter(v => (v.status || "PENDING") === status);

    if (today) {
      const now = new Date();
      const d = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")}`;
      rows = rows.filter(v => (v.date || "").startsWith(d));
    }

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch visitors" });
  }
});

// Admin stats (cards)
app.get("/api/admin/stats", async (_req, res) => {
  try {
    const [totalToday, insideNow, pending, monthTotal] = await Promise.all([
      countToday(),
      countByStatus("CHECKED_IN"),
      countByStatus("PENDING"),
      countThisMonth(),
    ]);
    res.json({ totalToday, insideNow, pending, monthTotal });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Admin recent list (dashboard table)
app.get("/api/admin/recent", async (_req, res) => {
  try {
    const rows = await fetchRecent(10);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch recent visitors" });
  }
});

// Admin combined (legacy)
app.get("/api/admin", async (_req, res) => {
  try {
    const [totalToday, insideNow, pending, monthTotal] = await Promise.all([
      countToday(),
      countByStatus("CHECKED_IN"),
      countByStatus("PENDING"),
      countThisMonth(),
    ]);
    const recent = await fetchRecent(10);
    res.json({ stats: { totalToday, insideNow, pending, monthTotal }, recent });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch admin data" });
  }
});

// Pending list (approvals page)
app.get("/api/admin/pending", async (_req, res) => {
  try {
    const rows = await fetchAll(500);
    res.json(rows.filter(v => (v.status || "PENDING") === "PENDING"));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch pending visitors" });
  }
});

// Update status (APPROVED | REJECTED | CHECKED_IN | CHECKED_OUT)
app.patch("/api/visitors/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = ["PENDING", "APPROVED", "REJECTED", "CHECKED_IN", "CHECKED_OUT"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

    // read current
    let doc;
    if (cosmos) {
      const { resources } = await cosmos.container.items
        .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] })
        .fetchAll();
      doc = resources?.[0];
    } else {
      doc = mem.visitors.find(v => v.id === id);
    }
    if (!doc) return res.status(404).json({ error: "Visitor not found" });

    // set status + timestamps
    const nowIso = new Date().toISOString();
    doc.status = status;
    doc.updatedAt = nowIso;
    if (status === "CHECKED_IN") doc.checkInAt = nowIso;
    if (status === "CHECKED_OUT") doc.checkOutAt = nowIso;

    const saved = await saveVisitor(doc); // upsert/persist
    res.json({ ok: true, visitor: saved });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// Send / re-send pass (enqueue QR/email job)
app.post("/api/visitors/:id/send-pass", async (req, res) => {
  try {
    const { id } = req.params;
    // find visitor
    let v = null;
    if (cosmos) {
      const { resources } = await cosmos.container.items
        .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] })
        .fetchAll();
      v = resources?.[0];
    } else {
      v = mem.visitors.find(x => x.id === id);
    }
    if (!v) return res.status(404).json({ error: "Visitor not found" });

    try { await enqueuePassRequest({ id: v.id, email: v.email }); } catch (e) {
      console.warn("enqueuePassRequest failed (continuing):", e?.message || e);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to enqueue pass email" });
  }
});

// Admin: manually override label
app.patch("/api/visitors/:id/label", async (req, res) => {
  try {
    const { id } = req.params;
    let { label } = req.body || {};
    if (!label) return res.status(400).json({ error: "label required" });

    label = String(label).toUpperCase();
    const allowed = new Set(["MEETING","DELIVERY","INTERVIEW","EVENT","SERVICE","ACADEMIC","ADMIN","VISIT","OTHER"]);
    if (!allowed.has(label)) return res.status(400).json({ error: "invalid label" });

    let doc = null;
    if (cosmos) {
      const { resources } = await cosmos.container.items
        .query({ query: "SELECT * FROM c WHERE c.id=@id", parameters: [{ name: "@id", value: id }] })
        .fetchAll();
      doc = resources?.[0];
      if (!doc) return res.status(404).json({ error: "not found" });
      doc.label = label;
      doc.labelConfidence = 1.0;  // manual = high confidence
      doc.updatedAt = new Date().toISOString();
      const { resource } = await cosmos.container.items.upsert({ ...doc, partitionKey: doc.id });
      return res.json({ ok: true, visitor: resource });
    } else {
      const i = mem.visitors.findIndex(v => v.id === id);
      if (i < 0) return res.status(404).json({ error: "not found" });
      mem.visitors[i].label = label;
      mem.visitors[i].labelConfidence = 1.0;
      mem.visitors[i].updatedAt = new Date().toISOString();
      return res.json({ ok: true, visitor: mem.visitors[i] });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update label" });
  }
});

// Reclassify ONE visitor via Azure/fallback
app.post("/api/ai/reclassify/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let doc = null;
    if (cosmos) {
      const { resources } = await cosmos.container.items
        .query({ query: "SELECT * FROM c WHERE c.id=@id", parameters: [{ name: "@id", value: id }] })
        .fetchAll();
      doc = resources?.[0];
    } else {
      doc = mem.visitors.find(v => v.id === id);
    }
    if (!doc) return res.status(404).json({ error: "not found" });

    const { classifyWithConfidence } = await import("./ai.js");
    const out = await classifyWithConfidence(doc.reasonForVisit);
    doc.label = out.label;
    doc.labelConfidence = out.confidence;
    doc.updatedAt = new Date().toISOString();

    const saved = await saveVisitor(doc);
    res.json({ ok: true, visitor: saved });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reclassify" });
  }
});

// Reclassify MANY (recent N)
app.post("/api/ai/reclassify-all", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const rows = await fetchAll(limit);

    const { classifyWithConfidence } = await import("./ai.js");
    const updates = [];
    for (const doc of rows) {
      const out = await classifyWithConfidence(doc.reasonForVisit);
      doc.label = out.label;
      doc.labelConfidence = out.confidence;
      doc.updatedAt = new Date().toISOString();
      updates.push(saveVisitor(doc));
    }
    await Promise.all(updates);
    res.json({ ok: true, updated: updates.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to reclassify-all" });
  }
});


// ===== AI endpoints =====
app.get("/api/ai/summary", async (_req, res) => {
  try {
    const [totalToday, insideNow, pending, monthTotal, recent] = await Promise.all([
      countToday(),
      countByStatus("CHECKED_IN"),
      countByStatus("PENDING"),
      countThisMonth(),
      fetchRecent(10),
    ]);

    const context = {
      totalToday,
      insideNow,
      pending,
      monthTotal,
      recentPurposes: recent.map(r => ({ reason: r.reasonForVisit, label: r.label })),
    };

    // default fallback
    let summary = `Today: ${totalToday} visitors; ${insideNow} inside; ${pending} pending; month total: ${monthTotal}.`;

    try {
      const { default: OpenAI } = await import("openai");

      const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
      const apiKey = process.env.AZURE_OPENAI_KEY || "";
      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "";
      const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

      if (!endpoint || !apiKey || !deployment) {
        console.warn("[AI] summary skipped — missing AZURE_OPENAI_* env vars");
      } else {
        const client = new OpenAI({
          apiKey,
          baseURL: `${endpoint}/openai`,         // ✅ Azure pattern
          defaultHeaders: { "api-key": apiKey },
          defaultQuery: { "api-version": apiVersion },
        });

        const r = await client.chat.completions.create({
          model: campusgate-ai,                      // ✅ pass your deployment name here
          temperature: 0.2,
          messages: [
            { role: "system", content: "You are a concise operations assistant for a campus visitor desk." },
            { role: "user", content: `Summarize today's visitor status in 3–4 sentences. Context (JSON): ${JSON.stringify(context)}` },
          ],
        });

        summary = r.choices?.[0]?.message?.content?.trim() || summary;
      }
    } catch (e) {
      // Surface real Azure errors in Log Stream
      const errMsg = e?.response?.data ?? e?.message ?? e;
      console.warn("[AI] summary error:", errMsg);
    }

    res.json({ ok: true, summary, metrics: context });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to build summary" });
  }
});


app.post("/api/ai/suggest-approval", async (req, res) => {
  try {
    const v = req.body?.visitor;
    if (!v) return res.status(400).json({ error: "visitor required" });

    let suggestion = { decision: "REVIEW", confidence: 0.5, reason: "Insufficient data" };

    try {
      const { default: OpenAI } = await import("openai");

      const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
      const apiKey = process.env.AZURE_OPENAI_KEY || "";
      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "";
      const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

      if (!endpoint || !apiKey || !deployment) {
        console.warn("[AI] suggest-approval skipped — missing AZURE_OPENAI_* env vars");
      } else {
        const client = new OpenAI({
          apiKey,
          baseURL: `${endpoint}/openai`,         // ✅ Azure pattern
          defaultHeaders: { "api-key": apiKey },
          defaultQuery: { "api-version": apiVersion },
        });

        const sys =
          "You are a risk-aware gate assistant. Respond ONLY with valid JSON " +
          "{decision:'APPROVE'|'DENY'|'REVIEW', confidence:number 0..1, reason:string}. Be conservative.";

        const usr = `Visitor: ${JSON.stringify({
          reasonForVisit: v.reasonForVisit,
          label: v.label || "OTHER",
          emailDomain: (v.email || "").split("@")[1] || "",
        })}`;

        const r = await client.chat.completions.create({
          model: campusgate-ai,                      // ✅ pass your deployment name here
          temperature: 0,
          messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
        });

        const raw = r.choices?.[0]?.message?.content || "";
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.decision) suggestion = parsed;
        } catch {
          console.warn("[AI] suggest-approval JSON parse failed; raw:", raw);
        }
      }
    } catch (e) {
      const errMsg = e?.response?.data ?? e?.message ?? e;
      console.warn("[AI] suggest-approval error:", errMsg);
    }

    res.json({ ok: true, suggestion });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to suggest" });
  }
});


/* -------------------------------------------------------------------------- */
/* Start server                                                               */
/* -------------------------------------------------------------------------- */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));

