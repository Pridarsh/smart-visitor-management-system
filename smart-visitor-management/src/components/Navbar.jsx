import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <div className="logo-icon">🏛️</div>
          <span>CampusGate</span>
        </Link>
        <Link to="/" className="nav-home">
          Home
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
