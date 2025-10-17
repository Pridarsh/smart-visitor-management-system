import React, { useState } from 'react';
import Layout from '../components/Layout';

const VisitorLog = () => {
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  // Mock data
  const visitors = [
    {
      id: 1,
      name: 'John Doe',
      mobile: '+1234567890',
      email: 'john@example.com',
      purpose: 'Business Meeting',
      visitorId: 'VIS-2024-001',
      staffName: 'Dr. Smith',
      designation: 'Professor',
      staffCode: 'EMP-101',
      photo: null
    },
    {
      id: 2,
      name: 'Jane Smith',
      mobile: '+0987654321',
      email: 'jane@example.com',
      purpose: 'Job Interview',
      visitorId: 'VIS-2024-002',
      staffName: 'Mr. Johnson',
      designation: 'HR Manager',
      staffCode: 'EMP-102',
      photo: null
    }
  ];

  return (
    <Layout>
      <div className="visitor-log-container">
        <div className="visitor-log-grid">
          {/* Left Panel - Visitor Details */}
          <div className="visitor-details-panel">
            <div className="staff-card">
              <div className="staff-photo">
                <div className="photo-placeholder">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              </div>
              <div className="staff-info">
                <div className="info-row">
                  <span className="info-label">NAME:</span>
                  <span className="info-value">{selectedVisitor?.staffName || '___________'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">DESIGNATION:</span>
                  <span className="info-value">{selectedVisitor?.designation || '___________'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">STAFF CODE:</span>
                  <span className="info-value">{selectedVisitor?.staffCode || '___________'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Visitor Log */}
          <div className="visitor-log-panel">
            <h2 className="panel-title">VISITOR LOG</h2>
            
            {selectedVisitor ? (
              <div className="visitor-info">
                <div className="log-field">
                  <span className="field-label">Name:</span>
                  <span className="field-value">{selectedVisitor.name}</span>
                </div>
                <div className="log-field">
                  <span className="field-label">Mobile No:</span>
                  <span className="field-value">{selectedVisitor.mobile}</span>
                </div>
                <div className="log-field">
                  <span className="field-label">Email Address:</span>
                  <span className="field-value">{selectedVisitor.email}</span>
                </div>
                <div className="log-field">
                  <span className="field-label">Purpose Of Visit:</span>
                  <span className="field-value">{selectedVisitor.purpose}</span>
                </div>
                <div className="log-field">
                  <span className="field-label">Visitor ID:</span>
                  <span className="field-value">{selectedVisitor.visitorId}</span>
                </div>
              </div>
            ) : (
              <div className="visitor-info">
                <div className="log-field">
                  <span className="field-label">Name:</span>
                </div>
                <div className="log-field">
                  <span className="field-label">Mobile No:</span>
                </div>
                <div className="log-field">
                  <span className="field-label">Email Address:</span>
                </div>
                <div className="log-field">
                  <span className="field-label">Purpose Of Visit:</span>
                </div>
                <div className="log-field">
                  <span className="field-label">Visitor ID:</span>
                </div>
              </div>
            )}

            {/* Visitor List */}
            <div className="visitor-list">
              <h3>Select a visitor:</h3>
              <div className="visitor-cards">
                {visitors.map(visitor => (
                  <div 
                    key={visitor.id}
                    className={`visitor-card ${selectedVisitor?.id === visitor.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVisitor(visitor)}
                  >
                    <h4>{visitor.name}</h4>
                    <p>{visitor.visitorId}</p>
                    <p>{visitor.purpose}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VisitorLog;
