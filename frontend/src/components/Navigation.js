import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const location = useLocation();
  
  return (
    <Navbar expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand as={Link} to="/">
          Email Generator
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
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation; 