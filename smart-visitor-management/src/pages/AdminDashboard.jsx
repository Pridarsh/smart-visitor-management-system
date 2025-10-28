import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { getAdminStats, getRecentVisitors } from '../lib/api';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalToday: 0,
    insideNow: 0,
    pending: 0,
    monthTotal: 0
  });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, r] = await Promise.all([getAdminStats(), getRecentVisitors()]);
        setStats(s || { totalToday: 0, insideNow: 0, pending: 0, monthTotal: 0 });
        setRecent(Array.isArray(r) ? r : []);
      } catch (e) {
        console.error(e);
        alert('Failed to load admin data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Layout>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Admin Dashboard</h1>

          {/* === Buttons === */}
          <div className="button-group" style={{ display: 'flex', gap: 12 }}>
            {/* ✅ New Approvals button */}
            <Link to="/approvals" className="view-log-btn">
              Approvals ✅
            </Link>
            <Link className="view-log-btn" to="/checkins">Check-Ins 🛎️</Link>

            {/* Existing AI link */}
            <Link to="/ai" className="view-log-btn" style={{ background: '#6a00ff' }}>
              AI Assistant 🤖
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Visitors Today</h3>
            <p className="stat-number">{loading ? '—' : stats.totalToday}</p>
          </div>
          <div className="stat-card">
            <h3>Currently Inside</h3>
            <p className="stat-number">{loading ? '—' : stats.insideNow}</p>
          </div>
          <div className="stat-card">
            <h3>Pending Approvals</h3>
            <p className="stat-number">{loading ? '—' : stats.pending}</p>
          </div>
          <div className="stat-card">
            <h3>Total This Month</h3>
            <p className="stat-number">{loading ? '—' : stats.monthTotal}</p>
          </div>
        </div>

        {/* Recent Visitors */}
        <div className="recent-visitors">
          <h2>Recent Visitors</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Purpose</th>
                  <th>Check-in Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ opacity: 0.7 }}>
                      {loading ? 'Loading…' : 'No recent visitors.'}
                    </td>
                  </tr>
                )}
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.firstName} {r.lastName}</td>

                    {/* ✅ Prefer AI label when available */}
                    <td>{r.reasonForVisit || "—"}</td>

                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : '—'}</td>
                    <td>
                      <span
                        className={`status ${
                          r.status === 'CHECKED_IN'
                            ? 'checked-in'
                            : r.status === 'CHECKED_OUT'
                            ? 'checked-out'
                            : ''
                        }`}
                      >
                        {r.status || 'PENDING'}
                      </span>
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
};

export default AdminDashboard;
