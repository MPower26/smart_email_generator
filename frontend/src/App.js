import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import GenerateEmailsPage from './pages/GenerateEmailsPage';
import TemplatesPage from './pages/TemplatesPage';
import SettingsPage from './pages/SettingsPage';
import WatchPage from './pages/WatchPage';
import WaitlistPage from './pages/WaitlistPage';
import FriendsButton from './components/FriendsButton';
import AuthScreen from './components/AuthScreen';
import { UserProvider, useUser } from './contexts/UserContext';
import GmailSuccess from './pages/GmailSuccess';
import DevPreviewPage from './pages/DevPreviewPage';
import SpamVerificationPage from './pages/SpamVerificationPage';
import './App.css';
import Footer from './components/Footer';

// Composant de routes protégées
const ProtectedRoutes = () => {
  const { authenticated, loading } = useUser();
  
  // Si le chargement est en cours, on n'affiche rien
  if (loading) {
    return <div className="text-center p-5">Chargement...</div>;
  }
  
  // Si l'utilisateur n'est pas authentifié, on le redirige vers la page d'accueil
  if (!authenticated) {
    return <AuthScreen />;
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
          <Route path="/spam-verification" element={<SpamVerificationPage />} />
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
            <Route path="/waitlist" element={<WaitlistPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
          <Footer />
        </div>
      </Router>
    </UserProvider>
  );
}

export default App; 

