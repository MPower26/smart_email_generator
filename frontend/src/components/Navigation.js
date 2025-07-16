import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const location = useLocation();
  
  return (
    <Navbar expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand>
          <a href="https://wesi.ltd/" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <img src="/hermesslogo.svg" alt="Logo" style={{ height: '40px', width: '40px', marginRight: '10px', verticalAlign: 'middle' }} />
            <span style={{ fontFamily: 'Syne-ExtraBold, Syne, Poppins, sans-serif', fontWeight: 800, fontSize: '2rem', letterSpacing: '0.03em', textTransform: 'uppercase', color: '#D8400D', marginRight: '10px' }}>Hermes</span>
            <span style={{ fontSize: '0.95rem', color: '#888', fontWeight: 400, letterSpacing: '0.01em', marginLeft: '2px', alignSelf: 'flex-end' }}>powered by wesi</span>
          </a>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <Nav.Link 
              as={Link} 
              to="/" 
              className={location.pathname === '/' ? 'active' : ''}
            >
              Home
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/generate-emails" 
              className={location.pathname.includes('/generate-emails') ? 'active' : ''}
            >
              Generate Emails
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/templates" 
              className={location.pathname.includes('/templates') ? 'active' : ''}
            >
              Templates
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/spam-verification" 
              className={location.pathname.includes('/spam-verification') ? 'active' : ''}
            >
              Spam Verification
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/settings" 
              className={location.pathname.includes('/settings') ? 'active' : ''}
            >
              Settings
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation; 