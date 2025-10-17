import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

const Home = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="home-container">
        <div className="home-content">
          <div className="home-logo">
            <div className="logo-icon-large">🏛️</div>
            <h1>CampusGate</h1>
          </div>
          <div className="home-buttons">
            <button 
              className="home-btn"
              onClick={() => navigate('/visitor')}
            >
              Visitor
            </button>
            <button 
              className="home-btn"
              onClick={() => navigate('/admin-login')}
            >
              Admin
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Home;