// src/lib/api.js

// In dev (vite), leave empty to use proxy; in prod set VITE_API_BASE_URL
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.replace(/\/+$/, ""); // strip trailing slash

function makeUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p; // dev => relative, prod => absolute
}

async function jfetch(path, opts = {}) {
  const res = await fetch(makeUrl(path), {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

/* ----------------- Public API ----------------- */

// Create visitor (VisitorForm)
export async function createVisitor(payload) {
  return jfetch("/api/visitors", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Dashboard cards
export async function getAdminStats() {
  return jfetch("/api/admin/stats");
}

// Dashboard table
export async function getRecentVisitors() {
  return jfetch("/api/admin/recent");
}

// List all (bounded)
export async function getVisitors(limit = 200) {
  return jfetch(`/api/visitors?limit=${limit}`);
}

// PENDING list
export async function getPendingVisitors(limit = 200) {
  const all = await getVisitors(limit);
  return Array.isArray(all) ? all.filter(v => (v.status || "PENDING") === "PENDING") : [];
}

// Update status
export async function updateVisitorStatus(id, status) {
  return jfetch(`/api/visitors/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// Send / re-send QR pass email
export async function sendPassEmail(id) {
  return jfetch(`/api/visitors/${encodeURIComponent(id)}/send-pass`, { method: "POST" });
}

// Filter by status and/or today
export async function listVisitorsByStatus(status, today = false) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (today) qs.set("today", "1");
  return jfetch(`/api/visitors?${qs.toString()}`);
}

// Convenience
export const checkIn  = (id) => updateVisitorStatus(id, "CHECKED_IN");
export const checkOut = (id) => updateVisitorStatus(id, "CHECKED_OUT");

// AI
export async function getAiSummary() {
  return jfetch("/api/ai/summary");
}
