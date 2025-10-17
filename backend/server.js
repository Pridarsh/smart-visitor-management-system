// server.js — CampusGate API
// Phase-6/7: Cosmos DB + GenAI classifyPurpose + Queue trigger for pass generation

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import Joi from "joi";
import { v4 as uuid } from "uuid";
import { CosmosClient } from "@azure/cosmos";
import { classifyPurpose } from "./ai.js";            // Azure OpenAI classifier
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

    // Enqueue background job for Azure Function to generate QR + email
    try {
      await enqueuePassRequest({ id: saved.id, email: saved.email });
    } catch (e) {
      console.error("enqueuePassRequest failed:", e);
    }

    res.status(201).json({ ok: true, visitor: saved });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create visitor" });
  }
});

// Full list for VisitorLog (optional ?limit=200)
Backend quick fix (add an alias that returns what the UI expects)

Add this route to server.js (near the other admin routes):

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
    const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
    const rows = await fetchAll(limit);
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
