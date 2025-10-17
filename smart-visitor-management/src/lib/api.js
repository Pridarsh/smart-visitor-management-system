const base = import.meta.env.VITE_API_BASE_URL || ""; // leave empty in dev to use proxy

export async function createVisitor(payload) {
  const url = base ? `${base}/api/visitors` : "/api/visitors";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAdminStats() {
  const url = base ? `${base}/api/admin/stats` : "/api/admin/stats";
  const res = await fetch(url);
  return res.json();
}

export async function getRecentVisitors() {
  const url = base ? `${base}/api/admin/recent` : "/api/admin/recent";
  const res = await fetch(url);
  return res.json();
}
