import React, { useState } from 'react';
import { Form, Button, Card, Alert } from 'react-bootstrap';

const EmailTemplateForm = ({ onSave, initialTemplate = { name: '', subject: '', body: '' } }) => {
  const [template, setTemplate] = useState(initialTemplate);
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTemplate(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }

    if (!template.name.trim() || !template.subject.trim() || !template.body.trim()) {
      setError('All fields are required.');
      return;
    }

    try {
      onSave(template);
      setSuccess('Template saved successfully!');
      setError('');
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError('Error saving template: ' + err.message);
    }
  };

  return (
    <Card>
      <Card.Body>
        <Card.Title>
          {initialTemplate.id ? 'Edit Template' : 'Create New Template'}
        </Card.Title>
        
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        
        <Form noValidate validated={validated} onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="templateName">
            <Form.Label>Template Name</Form.Label>
            <Form.Control
              type="text"
              name="name"
              value={template.name}
              onChange={handleChange}
              required
              placeholder="Enter a descriptive name"
            />
            <Form.Control.Feedback type="invalid">
              Please provide a template name.
            </Form.Control.Feedback>
          </Form.Group>
          
          <Form.Group className="mb-3" controlId="templateSubject">
            <Form.Label>Email Subject</Form.Label>
            <Form.Control
              type="text"
              name="subject"
              value={template.subject}
              onChange={handleChange}
              required
              placeholder="Enter subject line"
            />
            <Form.Control.Feedback type="invalid">
              Please provide a subject line.
            </Form.Control.Feedback>
          </Form.Group>
          
          <Form.Group className="mb-3" controlId="templateBody">
            <Form.Label>Email Body</Form.Label>
            <Form.Text className="text-muted d-block mb-2">
              Use variables like {"{first_name}"}, {"{company_name}"}, {"{technology}"} to personalize the email.
            </Form.Text>
            <Form.Control
              as="textarea"
              rows={10}
              name="body"
              value={template.body}
              onChange={handleChange}
              required
              placeholder="Write your email template here"
            />
            <Form.Control.Feedback type="invalid">
              Please provide the email body.
            </Form.Control.Feedback>
          </Form.Group>
          
          <div className="d-grid gap-2">
            <Button variant="primary" type="submit">
              Save Template
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default EmailTemplateForm; 