
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import Joi from "joi";
import { v4 as uuid } from "uuid";
import { CosmosClient } from "@azure/cosmos";
import { classifyPurpose } from "./ai.js";            // Azure OpenAI classifier
import { enqueuePassRequest } from "./services/queue.js"; // <-- Queue helper
import dotenv from "dotenv";
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
  const today = new Date().toISOString().slice(0, 10);
  if (cosmos) {
    const { resources } = await cosmos.container.items
      .query({
        query: "SELECT VALUE COUNT(1) FROM c WHERE c.date = @d",
        parameters: [{ name: "@d", value: today }],
      })
      .fetchAll();
    return resources[0] ?? 0;
  }
  return mem.visitors.filter(v => v.date === today).length;
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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    storage: useCosmos ? "cosmos" : "memory",
  });
});

// Create visitor + classify + enqueue QR email job
// Create visitor + classify (NO QR here)
app.post("/api/visitors", async (req, res) => {
  try {
    const { error, value } = visitorSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const id = `VIS-${new Date().getFullYear()}-${uuid().slice(0, 8)}`;
    const date = new Date().toISOString().slice(0, 10);

    // GenAI classification (safe fallback if OpenAI not set)
    let label = "OTHER";
    try {
      label = await classifyPurpose(value.reasonForVisit);
    } catch {
      // ignore errors, keep label as OTHER
    }

    const doc = {
      id,
      ...value,
      label,
      status: "PENDING",
      date,
      createdAt: new Date().toISOString(),
    };

    const saved = await saveVisitor(doc);

    // ❌ NO enqueuePassRequest here – QR only on approval

    res.status(201).json({ ok: true, visitor: saved });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create visitor" });
  }
});


// Full list for VisitorLog (optional ?limit=200)


// Admin combined: alias for older UI that calls /api/admin
app.get("/api/admin", async (_req, res) => {
  try {
    const [totalToday, insideNow, pending, monthTotal] = await Promise.all([
      countToday(),
      countByStatus("CHECKED_IN"),
      countByStatus("PENDING"),
      countThisMonth(),
    ]);
    const recent = await fetchRecent(10);
    // Return a single JSON shape most dashboards expect
    res.json({
      stats: { totalToday, insideNow, pending, monthTotal },
      recent,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch admin data" });
  }
});


app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/visitors", async (req, res) => {
  try {
    const { status, today } = req.query;
    const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);

    let rows = await fetchAll(limit);

    // Filter by status
    if (status) {
      rows = rows.filter(v => v.status === status);
    }

    // Filter by today
    if (today) {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      rows = rows.filter(v => v.date === todayStr);
    }

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch visitors" });
  }
});


// Admin stats
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

// Admin recent
app.get("/api/admin/recent", async (_req, res) => {
  try {
    const rows = await fetchRecent(10);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch recent visitors" });
  }
});

/* -------------------------------------------------------------------------- */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));

// ===== AI: summarize today's activity for admins =====
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
      totalToday, insideNow, pending, monthTotal,
      recentPurposes: recent.map(r => r.label),
    };

    // Default fallback text (in case Azure OpenAI is not configured)
    let summary = `Today: ${totalToday} visitors; ${insideNow} inside; ${pending} pending; month total: ${monthTotal}.`;

    // Try Azure OpenAI if configured
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_KEY,
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
        defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
        defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview" },
      });

      const r = await client.chat.completions.create({
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are a concise operations assistant for a campus visitor desk." },
          { role: "user",   content: `Summarize today's visitor status in 3–4 sentences. Context (JSON): ${JSON.stringify(context)}` }
        ]
      });
      summary = r.choices?.[0]?.message?.content?.trim() || summary;
    } catch (e) {
      console.warn("[AI] summary fallback:", e?.message || e);
    }

    res.json({ ok: true, summary, metrics: context });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to build summary" });
  }
});

// ===== AI: suggestion for a single visitor (approve/deny/review) =====
app.post("/api/ai/suggest-approval", async (req, res) => {
  try {
    const v = req.body?.visitor;
    if (!v) return res.status(400).json({ error: "visitor required" });

    let suggestion = { decision: "REVIEW", confidence: 0.5, reason: "Insufficient data" };

    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_KEY,
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
        defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
        defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview" },
      });

      const sys = "You are a risk-aware gate assistant. Respond ONLY with valid JSON {decision:'APPROVE'|'DENY'|'REVIEW', confidence: number between 0 and 1, reason:string}. Be conservative.";
      const usr = `Visitor: ${JSON.stringify({
        reasonForVisit: v.reasonForVisit,
        label: v.label || "OTHER",
        emailDomain: (v.email || "").split("@")[1] || "",
      })}`;

      const r = await client.chat.completions.create({
        temperature: 0,
        messages: [
          { role: "system", content: sys },
          { role: "user",   content: usr }
        ]
      });

      const raw = r.choices?.[0]?.message?.content || "";
      suggestion = JSON.parse(raw);
    } catch (e) {
      console.warn("[AI] suggest-approval fallback:", e?.message || e);
    }

    res.json({ ok: true, suggestion });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to suggest" });
  }
});

app.post("/api/visitors/:id/send-pass", async (req, res) => {
  try {
    const { id } = req.params;

    // look up visitor to get the email
    let visitor = null;
    if (cosmos) {
      const { resources } = await cosmos.container.items
        .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: id }] })
        .fetchAll();
      visitor = resources?.[0];
    } else {
      visitor = mem.visitors.find(v => v.id === id);
    }
    if (!visitor) return res.status(404).json({ error: "Visitor not found" });

    // enqueue job for function to generate QR + email
    await enqueuePassRequest({ id: visitor.id, email: visitor.email });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to enqueue pass email" });
  }
});

// Approve / Reject a visitor
// body: { status: "APPROVED" | "REJECTED", approvedBy?: string }
app.patch("/api/visitors/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy } = req.body || {};

    const allowedStatuses = [
      "APPROVED",
      "REJECTED",
      "CHECKED_IN",
      "CHECKED_OUT",
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    let doc;

    if (cosmos) {
      const { resources } = await cosmos.container.items
        .query({
          query: "SELECT * FROM c WHERE c.id = @id",
          parameters: [{ name: "@id", value: id }],
        })
        .fetchAll();
      doc = resources?.[0];
    } else {
      doc = mem.visitors.find(v => v.id === id);
    }

    if (!doc) return res.status(404).json({ error: "Visitor not found" });

    const now = new Date().toISOString();

    doc.status = status;
    doc.updatedAt = now;

    if (status === "APPROVED") {
      doc.approvedAt = now;
      doc.approvedBy = approvedBy || "admin";
    }

    if (status === "CHECKED_IN") {
      doc.checkInAt = now;
    }

    if (status === "CHECKED_OUT") {
      doc.checkOutAt = now;
    }

    const saved = await saveVisitor(doc);

    res.json({ ok: true, visitor: saved });
  } catch (e) {
    console.error("Status update error:", e);
    res.status(500).json({ error: "Failed to update status" });
  }
});
app.get("/api/test-queue", async (req, res) => {
  try {
    const q = new (require("@azure/storage-queue").QueueClient)(
      process.env.AZURE_STORAGE_CONN,
      process.env.PASS_REQUESTS_QUEUE
    );

    await q.createIfNotExists();
    await q.sendMessage("test message");

    res.json({ ok: true, msg: "Queue working" });
  } catch (e) {
    console.error("Queue error:", e);
    res.status(500).json({ error: e.message });
  }
});

