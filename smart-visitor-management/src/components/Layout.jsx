import React from 'react';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <div className="app-container">
      <Navbar />
      <div className="content-container">
        {children}
      </div>
    </div>
  );
};

export default Layout;