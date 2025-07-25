import React, { useState } from 'react';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import { api } from '../services/api';

const WaitlistPage = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    subscribeToUpdates: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: '', message: '' });

    try {
      await api.post('/waitlist', formData);
      setSubmitStatus({
        type: 'success',
        message: 'Thank you for joining our waitlist! We will keep you updated.'
      });
      setFormData({
        firstName: '',
        lastName: '',
        company: '',
        email: '',
        subscribeToUpdates: false
      });
    } catch (error) {
      setSubmitStatus({
        type: 'danger',
        message: error.response?.data?.detail || 'An error occurred. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container className="py-5">
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="text-center mb-4">Join Our Waitlist</h1>
          {submitStatus.message && (
            <Alert variant={submitStatus.type} className="mb-4">
              {submitStatus.message}
            </Alert>
          )}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>First Name</Form.Label>
              <Form.Control
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="Enter your first name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Last Name</Form.Label>
              <Form.Control
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Enter your last name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Company</Form.Label>
              <Form.Control
                type="text"
                name="company"
                value={formData.company}
                onChange={handleChange}
                required
                placeholder="Enter your company name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="Enter your email address"
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Check
                type="checkbox"
                name="subscribeToUpdates"
                checked={formData.subscribeToUpdates}
                onChange={handleChange}
                label="Keep me updated about new features and tool updates"
              />
            </Form.Group>

            <div className="d-grid">
              <Button
                variant="primary"
                type="submit"
                disabled={isSubmitting}
                size="lg"
              >
                {isSubmitting ? 'Submitting...' : 'Join Waitlist'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default WaitlistPage; 