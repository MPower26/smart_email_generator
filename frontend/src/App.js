import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import GenerateEmailsPage from './pages/GenerateEmailsPage';
import TemplatesPage from './pages/TemplatesPage';
import SettingsPage from './pages/SettingsPage';
import WatchPage from './pages/WatchPage';
import FriendsButton from './components/FriendsButton';
import AuthScreen from './components/AuthScreen';
import { UserProvider, useUser } from './contexts/UserContext';
import GmailSuccess from './pages/GmailSuccess';
import DevPreviewPage from './pages/DevPreviewPage';
import Footer from './components/Footer';
import './App.css';

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Composant de routes protégées
const ProtectedRoutes = () => {
  const { authenticated, loading } = useUser();
  
  // If loading is in progress, don't display anything
  if (loading) {
    return <div className="text-center p-5">Loading...</div>;
  }
  
  // If user is not authenticated, redirect to home page
  if (!authenticated) {
    return <AuthScreen />;
  }

  if (isMobileDevice()) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#D8400D', fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', padding: '2rem' }}>
        <img src="/hermesslogo.svg" alt="Hermes Logo" className="hermes-logo-animated" style={{ height: 80, width: 80, marginBottom: 24 }} />
        <div>This app is only available on desktop devices.<br />Please access it from a computer.</div>
      </div>
    );
  }
  
  // Sinon, on affiche les routes protégées
  return (
    <>
      <Navigation />
      <Container className="flex-grow-1 py-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/generate-emails" element={<GenerateEmailsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
      <FriendsButton />
    </>
  );
};

function App() {
  return (
    <UserProvider>
      <Router>
        <div className="App d-flex flex-column min-vh-100">
          {/* Background logo for all pages */}
          <img src="/hermesslogo.svg" alt="Background Logo" className="background-logo" />
          <Routes>
            <Route path="/dev-preview" element={<DevPreviewPage />} />
            <Route path="/gmail/success" element={<GmailSuccess />} />
            <Route path="/watch" element={<WatchPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
          <Footer />
        </div>
      </Router>
    </UserProvider>
  );
}

export default App; 
