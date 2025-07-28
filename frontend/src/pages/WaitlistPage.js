import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './WaitlistPage.css';

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

  useEffect(() => {
    document.body.classList.add('waitlist-page');
    return () => {
      document.body.classList.remove('waitlist-page');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/waitlist', formData);
      setSuccess(true);
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
    <div className="waitlist-page">
      <Container className="waitlist-container">
        <div className="logo-container">
          <img src="/hermesslogo.svg" alt="Herm4s Logo" className="logo" />
        </div>
        
        <div className="waitlist-card">
          <div className="text-center mb-4">
            <h1 className="waitlist-title">Join Our Waitlist</h1>
            <p className="waitlist-subtitle">
              Be among the first to experience our powerful email generation tool
            </p>
          </div>

          {success ? (
            <div className="success-message text-center">
              <div className="success-icon">✓</div>
              <h4>Thank you for joining our waitlist!</h4>
              <p>We'll notify you as soon as access becomes available.</p>
              <div className="social-links mt-4">
                <a href="https://twitter.com/herm4s" target="_blank" rel="noopener noreferrer" className="social-link">
                  Follow us on Twitter
                </a>
                <a href="https://linkedin.com/company/herm4s" target="_blank" rel="noopener noreferrer" className="social-link">
                  Connect on LinkedIn
                </a>
              </div>
            </div>
          ) : (
            <Form onSubmit={handleSubmit} className="waitlist-form">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <Form.Group>
                    <Form.Label>First Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      required
                      className="form-input"
                      placeholder="Enter your first name"
                    />
                  </Form.Group>
                </div>
                <div className="col-12 col-md-6">
                  <Form.Group>
                    <Form.Label>Last Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      required
                      className="form-input"
                      placeholder="Enter your last name"
                    />
                  </Form.Group>
                </div>
              </div>

              <Form.Group className="mt-3">
                <Form.Label>Company</Form.Label>
                <Form.Control
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                  placeholder="Enter your company name"
                />
              </Form.Group>

              <Form.Group className="mt-3">
                <Form.Label>Email Address</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="form-input"
                  placeholder="Enter your email address"
                />
              </Form.Group>

              <Form.Group className="mt-4 subscription-checkbox">
                <Form.Check
                  id="subscribe-checkbox"
                  type="checkbox"
                  name="subscribe_to_updates"
                  checked={formData.subscribe_to_updates}
                  onChange={handleInputChange}
                  label="Keep me updated about new features and tools"
                  className="custom-checkbox"
                />
              </Form.Group>

              {error && (
                <Alert variant="danger" className="mt-3">
                  {error}
                </Alert>
              )}

              <div className="text-center mt-4">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  className="submit-button"
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Joining...
                    </>
                  ) : (
                    'Join Waitlist'
                  )}
                </Button>
              </div>
            </Form>
          )}
        </div>
      </Container>
    </div>
  );
};

export default WaitlistPage; 