// src/pages/AiOperationsAssistant.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { getAiSummary, getRecentVisitors } from "../lib/api";

export default function AiOperationsAssistant() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("Click the button to summarize today’s activity.");
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const rows = await getRecentVisitors();
        setRecent(Array.isArray(rows) ? rows : []);
      } catch {
        setRecent([]);
      }
    })();
  }, []);

  async function handleSummary() {
    setLoading(true);
    try {
      const r = await getAiSummary(); // { ok, summary, metrics }
      setSummary(r?.summary || "No summary available.");
    } catch {
      setSummary("AI Summary failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>AI Operations Assistant</h1>
          <Link to="/admin-dashboard" className="view-log-btn">Back to Dashboard</Link>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <button className="view-log-btn" onClick={handleSummary} disabled={loading} aria-busy={loading}>
            {loading ? "Summarizing…" : "Summarize Today’s Activity"}
          </button>
        </div>

        <div className="safe-card" style={{ padding: 20, marginBottom: 30 }}>
          <h3 style={{ textAlign: "center" }}>AI Summary</h3>
          <p style={{ textAlign: "center", opacity: 0.9 }}>{summary}</p>
        </div>

        <div className="table-container">
          <h3>AI-Classified Purposes (Recent)</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>User-Typed Reason</th>
                <th>AI Label</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ opacity: 0.7, textAlign: "center" }}>No recent visitors.</td>
                </tr>
              ) : (
                recent.map(v => (
                  <tr key={v.id}>
                    <td>{v.firstName} {v.lastName}</td>
                    <td>{v.reasonForVisit}</td>
                    <td><span className="status">{(v.label || "OTHER").toUpperCase()}</span></td>
                    <td>{v.createdAt ? new Date(v.createdAt).toLocaleString() : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <p style={{ marginTop: 10, fontSize: 13 }}>
            Note: The <b>Dashboard</b> shows the original reason. This <b>AI page</b> shows the AI-classified label
            (e.g., MEETING, DELIVERY, INTERVIEW, OTHER) alongside the original text.
          </p>
        </div>
      </div>
    </Layout>
  );
}
