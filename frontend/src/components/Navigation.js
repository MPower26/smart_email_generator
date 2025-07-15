import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const location = useLocation();
  
  return (
    <Navbar expand="lg" className="mb-4" style={{ padding: '0.5rem 0' }}>
      <Container>
        <Navbar.Brand>
          <a href="https://wesi.ltd/" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <img src="/hermesslogo.svg" alt="Hermes Logo" className="hermes-logo-animated" style={{ height: '50px', width: '50px', marginRight: '10px', verticalAlign: 'middle' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="hermes-title-compact">HERMES</span>
              <span className="hermes-subtitle-compact">By Wesi.ltd</span>
            </div>
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
              to="/settings" 
              className={location.pathname.includes('/settings') ? 'active' : ''}
            >
              Settings
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/domains" 
              className={location.pathname.includes('/domains') ? 'active' : ''}
            >
              Domains
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation; 

};

export default Navigation; 
