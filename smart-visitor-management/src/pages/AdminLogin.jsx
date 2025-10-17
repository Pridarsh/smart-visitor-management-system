import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle login - for demo, use admin/admin123
    if (credentials.username === 'admin' && credentials.password === 'admin123') {
      navigate('/admin-dashboard');
    } else {
      alert('Invalid credentials! Use admin/admin123 for demo');
    }
  };

  return (
    <Layout>
      <div className="form-page-container">
        <div className="form-card">
          <h2 className="form-title">LOGIN</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username *</label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="First name"
                value={credentials.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Password"
                value={credentials.password}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="submit-btn">
              Login
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default AdminLogin;
