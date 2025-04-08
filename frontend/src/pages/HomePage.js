import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <Container>
      {/* Hero Section */}
      <Row className="mb-5 text-center">
        <Col>
          <h1 className="display-4 mb-4">Personalized Email Generator</h1>
          <p className="lead mb-4">
            Generate targeted, personalized emails for your prospects using AI and customizable templates.
            Save time and increase engagement with professionally crafted messages.
          </p>
          
          {/* Video Section - Small Format */}
          <div className="video-container mb-4" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <iframe
              width="100%"
              height="315"
              src="https://www.youtube.com/embed/-jyEi7-fAaw"
              title="Tutoriel vidéo"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          
          <Button 
            as={Link} 
            to="/generate-emails" 
            size="lg" 
            variant="primary"
          >
            Get Started
          </Button>
        </Col>
      </Row>

      {/* Features Section */}
      <Row className="mb-5">
        <Col md={4} className="mb-4">
          <Card className="h-100 feature-card">
            <Card.Body className="text-center">
              <div className="feature-icon">
                <i className="bi bi-envelope-paper"></i>
              </div>
              <Card.Title>Email Generation</Card.Title>
              <Card.Text>
                Upload your contact list and generate personalized emails for each prospect.
                Choose between AI-powered generation or custom templates.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-4">
          <Card className="h-100 feature-card">
            <Card.Body className="text-center">
              <div className="feature-icon">
                <i className="bi bi-file-earmark-text"></i>
              </div>
              <Card.Title>Template Management</Card.Title>
              <Card.Text>
                Create and manage reusable email templates with personalization variables.
                Save your best-performing templates for future use.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-4">
          <Card className="h-100 feature-card">
            <Card.Body className="text-center">
              <div className="feature-icon">
                <i className="bi bi-gear"></i>
              </div>
              <Card.Title>Settings</Card.Title>
              <Card.Text>
                Configure your API keys, default templates, and other preferences
                to customize your email generation experience.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default HomePage; 