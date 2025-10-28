import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import VisitorForm from './pages/VisitorForm';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AiOperationsAssistant from './pages/AiOperationsAssistant'; // ✅ NEW PAGE
import Approvals from "./pages/Approvals";   // <-- add this line
import CheckIns from "./pages/CheckIns";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/visitor" element={<VisitorForm />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/checkins" element={<CheckIns />} />



        {/* ✅ NEW AI PAGE */}
        <Route path="/ai" element={<AiOperationsAssistant />} />
        


        {/* ❌ Removed Visitor Log Page */}
        {/* <Route path="/visitor-log" element={<VisitorLog />} /> */}
      </Routes>
    </Router>
  );
}

export default App;