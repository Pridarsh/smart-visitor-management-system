import React from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import AiAssistant from "../components/AiAssistant";

export default function AiOperationsAssistant() {
  return (
    <Layout>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>AI Operations Assistant</h1>

          {/* same purple pill style as other pages */}
          <Link to="/admin-dashboard" className="view-log-btn">
            Back to Dashboard
          </Link>
        </div>

        <div className="recent-visitors" style={{ marginTop: 16 }}>
          <h2>Insights & Actions</h2>
          <div className="table-container" style={{ padding: 16 }}>
            <AiAssistant />
          </div>
        </div>
      </div>
    </Layout>
  );
}
