import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { FaGlobe } from 'react-icons/fa';
import { createVisitor } from '../lib/api';

const VisitorForm = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    reasonForVisit: ''
  });

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { ok, visitor } = await createVisitor(formData);
      if (ok) {
        alert(`Registration successful! Your Visitor ID: ${visitor.id}`);
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to register. ${err.message || 'Please try again.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="form-page-container">
        <div className="form-card">
          <h2 className="form-title">Contact us</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="firstName">First name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                placeholder="First name"
                value={formData.firstName}
                onChange={handleChange}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                placeholder="Last name"
                value={formData.lastName}
                onChange={handleChange}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <div className="phone-input-wrapper">
                <FaGlobe className="phone-icon" />
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="reasonForVisit">Reason of Visit *</label>
              <textarea
                id="reasonForVisit"
                name="reasonForVisit"
                placeholder="Message"
                rows="4"
                value={formData.reasonForVisit}
                onChange={handleChange}
                required
                disabled={submitting}
              />
            </div>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default VisitorForm;
