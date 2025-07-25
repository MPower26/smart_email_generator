import React, { useState } from 'react';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const WaitlistPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company: '',
    email: '',
    subscribe_to_updates: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/waitlist', formData);
      setSuccess(true);
      // Clear form
      setFormData({
        first_name: '',
        last_name: '',
        company: '',
        email: '',
        subscribe_to_updates: false
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
      <img src="/hermesslogo.svg" alt="Background Logo" className="background-logo" />
      <Card className="shadow fade-in-down" style={{ width: '900px', minHeight: '480px', transform: 'translateY(30px)' }}>
        <Card.Body className="p-5">
          <div className="text-center mb-4">
            <h2>Join Our Waitlist</h2>
            <p className="text-muted">Be among the first to experience our powerful email generation tool.</p>
          </div>

          {success ? (
            <div className="text-center">
              <Alert variant="success">
                <h4>Thank you for joining our waitlist!</h4>
                <p>We'll notify you as soon as access becomes available.</p>
              </Alert>
            </div>
          ) : (
            <Form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>First Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>Last Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </div>
              </div>

              <Form.Group className="mb-3">
                <Form.Label>Company</Form.Label>
                <Form.Control
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email Address</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Check
                  type="checkbox"
                  name="subscribe_to_updates"
                  checked={formData.subscribe_to_updates}
                  onChange={handleInputChange}
                  label="Keep me updated about new features and tools"
                />
              </Form.Group>

              {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

              <div className="text-center">
                <Button
                  variant="primary"
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="px-5"
                >
                  {loading ? 'Submitting...' : 'Join Waitlist'}
                </Button>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default WaitlistPage; 