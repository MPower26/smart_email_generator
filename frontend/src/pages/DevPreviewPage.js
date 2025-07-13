import React from 'react';
import { Link } from 'react-router-dom';
import { Container, Card } from 'react-bootstrap';

const DevPreviewPage = () => (
  <Container className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
    <Card className="p-4" style={{ maxWidth: 480, width: '100%', marginTop: 40 }}>
      <h2 className="mb-4 text-center" style={{ color: '#D8400D' }}>Design Preview Navigation</h2>
      <ul style={{ listStyle: 'none', padding: 0, fontSize: '1.2rem' }}>
        <li className="mb-3"><Link to="/" style={{ textDecoration: 'none', color: '#333' }}>Home Page</Link></li>
        <li className="mb-3"><Link to="/generate-emails" style={{ textDecoration: 'none', color: '#333' }}>Generate Emails Page</Link></li>
        <li className="mb-3"><Link to="/templates" style={{ textDecoration: 'none', color: '#333' }}>Templates Page</Link></li>
        <li className="mb-3"><Link to="/settings" style={{ textDecoration: 'none', color: '#333' }}>Settings Page</Link></li>
        <li className="mb-3"><Link to="/watch" style={{ textDecoration: 'none', color: '#333' }}>Watch Page</Link></li>
        <li className="mb-3"><Link to="/gmail/success" style={{ textDecoration: 'none', color: '#333' }}>Gmail Success Page</Link></li>
        <li className="mb-3"><Link to="/auth" style={{ textDecoration: 'none', color: '#333' }}>Authentication Screen</Link></li>
      </ul>
      <div className="text-muted text-center mt-3" style={{ fontSize: '0.95rem' }}>
        (This page is for design/development navigation only)
      </div>
    </Card>
  </Container>
);

export default DevPreviewPage; 