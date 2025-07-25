import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Navigation from './components/Navigation';
import WaitlistPage from './pages/WaitlistPage';
import './App.css';
import Footer from './components/Footer';

const AppContent = () => {
  const location = useLocation();
  const isWaitlistPage = location.pathname === '/';

  return (
    <div className={`App ${isWaitlistPage ? 'waitlist-page' : ''}`}>
      <Routes>
        <Route path="/" element={<WaitlistPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App; 

