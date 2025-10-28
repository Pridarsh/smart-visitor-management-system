import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { listVisitorsByStatus, checkIn, checkOut } from "../lib/api";

export default function CheckIns() {
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState([]);
  const [inside, setInside] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [a, i] = await Promise.all([
        listVisitorsByStatus("APPROVED", true),   // today’s approved
        listVisitorsByStatus("CHECKED_IN", true), // today’s checked in
      ]);
      setApproved(a);
      setInside(i);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onCheckIn(id) {
    setBusy(true);
    try { await checkIn(id); await load(); } finally { setBusy(false); }
  }
  async function onCheckOut(id) {
    setBusy(true);
    try { await checkOut(id); await load(); } finally { setBusy(false); }
  }

  const cellTime = (v) => v.checkInAt || v.createdAt || "—";

  return (
    <Layout>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Check-In / Check-Out</h1>
          <a href="/admin-dashboard" className="view-log-btn">Back to Dashboard</a>
        </div>

        <div className="recent-visitors">
          <h2>Approved (not yet inside)</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Purpose</th><th>Approved At</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="4">Loading…</td></tr>}
                {!loading && approved.length === 0 && <tr><td colSpan="4" style={{opacity:.7}}>None.</td></tr>}
                {approved.map(v => (
                  <tr key={v.id}>
                    <td>{v.firstName} {v.lastName}</td>
                    <td>{v.label || v.reasonForVisit}</td>
                    <td>{v.createdAt ? new Date(v.createdAt).toLocaleTimeString() : "—"}</td>
                    <td>
                      <button className="view-log-btn" disabled={busy} onClick={() => onCheckIn(v.id)}>
                        {busy ? "Working…" : "Check-In"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="recent-visitors" style={{marginTop:24}}>
          <h2>Currently Inside</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Purpose</th><th>Checked-In</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="4">Loading…</td></tr>}
                {!loading && inside.length === 0 && <tr><td colSpan="4" style={{opacity:.7}}>No one inside.</td></tr>}
                {inside.map(v => (
                  <tr key={v.id}>
                    <td>{v.firstName} {v.lastName}</td>
                    <td>{v.label || v.reasonForVisit}</td>
                    <td>{cellTime(v) !== "—" ? new Date(cellTime(v)).toLocaleTimeString() : "—"}</td>
                    <td>
                      <button className="view-log-btn" disabled={busy} onClick={() => onCheckOut(v.id)}>
                        {busy ? "Working…" : "Check-Out"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Layout>
  );
}
