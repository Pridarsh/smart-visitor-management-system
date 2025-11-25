import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import {
  getPendingVisitors,
  updateVisitorStatus,
  sendPassEmail,
} from "../lib/api";

export default function Approvals() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getPendingVisitors(300); // safe client-side filter
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      alert("Failed to load pending visitors.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(id, action) {
    setBusy(true);
    try {
      if (action === "APPROVE") {
        // 1) Always try to approve first
        await updateVisitorStatus(id, "APPROVED");
  
        // 2) Try to send QR, but don't break approval if it fails
        try {
          await sendPassEmail(id);
        } catch (e) {
          console.error("sendPassEmail failed:", e);
          alert("Visitor APPROVED, but QR email could not be sent. Please check the backend queue/email configuration.");
        }
      } else {
        // REJECT path
        await updateVisitorStatus(id, "REJECTED");
      }
  
      setActive(null);
      await load();
    } catch (e) {
      console.error(e);
      alert(
        `Could not ${action === "APPROVE" ? "approve" : "reject"}.\n` +
        `If this persists, check backend PATCH /api/visitors/:id/status.`
      );
    } finally {
      setBusy(false);
    }
  }
    

  return (
    <Layout>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Pending Approvals</h1>
          <a href="/admin-dashboard" className="view-log-btn">Back to Dashboard</a>
        </div>

        <div className="recent-visitors">
          <h2>Review Visitors</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Reason</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="6" style={{opacity:.7}}>Loading…</td></tr>}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan="6" style={{opacity:.7}}>No pending visitors.</td></tr>
                )}
                {rows.map(v => (
                  <tr key={v.id}>
                    <td>{v.id}</td>
                    <td>{v.firstName} {v.lastName}</td>
                    <td>{v.email}</td>
                    <td>{v.label || v.reasonForVisit}</td>
                    <td>{v.createdAt ? new Date(v.createdAt).toLocaleString() : "—"}</td>
                    <td>
                      <button className="view-log-btn" onClick={() => setActive(v)}>Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {active && (
          <div className="ai-overlay" onClick={() => !busy && setActive(null)}>
            <div className="ai-box" onClick={(e) => e.stopPropagation()}>
              <h3>Visitor Approval</h3>
              <p><b>Name:</b> {active.firstName} {active.lastName}</p>
              <p><b>Email:</b> {active.email}</p>
              <p><b>Reason:</b> {active.reasonForVisit}</p>
              <p><b>Classification:</b> {active.label || "OTHER"}</p>

              <div style={{ display:"flex", gap:12, marginTop:10 }}>
                <button
                  className="view-log-btn"
                  disabled={busy}
                  onClick={() => act(active.id, "APPROVE")}
                >
                  {busy ? "Approving…" : "Approve & Send QR"}
                </button>
                <button
                  className="view-log-btn"
                  style={{ background:"#933" }}
                  disabled={busy}
                  onClick={() => act(active.id, "REJECT")}
                >
                  {busy ? "Rejecting…" : "Reject"}
                </button>
                <button className="view-log-btn" disabled={busy} onClick={() => setActive(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
