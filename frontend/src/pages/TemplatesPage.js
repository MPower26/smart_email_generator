import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Modal, Tabs, Tab, Accordion, Badge } from 'react-bootstrap';
import { templateService } from '../services/api'; // <--- Make sure this uses HTTPS!

const TemplatesPage = () => {
  const [templatesByCategory, setTemplatesByCategory] = useState({
    outreach: [],
    followup: [],
    lastchance: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState({
    id: null,
    name: '',
    content: '',
    category: 'outreach',
    is_default: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('outreach');
  const [activeTab, setActiveTab] = useState('editor');

  // Example placeholder data for preview
  const placeholderData = {
    'Recipient Name': 'John Smith',
    'Company Name': 'Acme Corporation',
    'Your Name': 'Jane Doe',
    'Your Position': 'Sales Manager',
    'Your Company': 'Tech Solutions Inc.',
  };

  // Load templates from API on mount
  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await templateService.getTemplatesByCategory();
        setTemplatesByCategory(response.data);
      } catch (err) {
        setError('Failed to load templates from backend. (This will help us debug mixed content errors!)');
        console.error('Error loading templates:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, []);

  // Modal open: new template (local only)
  const handleNewTemplate = (category) => {
    setSelectedCategory(category);
    setCurrentTemplate({
      id: null,
      name: '',
      content: '',
      category: category,
      is_default: false,
    });
    setIsEditing(false);
    setShowModal(true);
    setActiveTab('editor');
  };

  // Modal open: edit existing (local only)
  const handleEditTemplate = (template) => {
    setCurrentTemplate({ ...template });
    setSelectedCategory(template.category);
    setIsEditing(true);
    setShowModal(true);
    setActiveTab('editor');
  };

  // Form change (local only)
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCurrentTemplate({
      ...currentTemplate,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // Save (add/edit): local only
  const handleSaveTemplate = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      setTemplatesByCategory((prev) => {
        const cat = currentTemplate.category;
        let newCatArr = [...prev[cat]];
        if (isEditing) {
          newCatArr = newCatArr.map((t) =>
            t.id === currentTemplate.id ? { ...currentTemplate } : t
          );
          setSuccess('Template updated (locally)');
        } else {
          const newTemplate = {
            ...currentTemplate,
            id: Date.now(),
            created_at: new Date().toISOString(),
          };
          newCatArr.push(newTemplate);
          setSuccess('New template created (locally)');
        }
        return { ...prev, [cat]: newCatArr };
      });
      setShowModal(false);
      setLoading(false);
    }, 400);
  };

  // Delete: local only
  const handleDeleteTemplate = (id, category) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    setTemplatesByCategory((prev) => ({
      ...prev,
      [category]: prev[category].filter((t) => t.id !== id),
    }));
    setSuccess('Template deleted (locally)');
  };

  // Set as default: local only
  const handleSetDefault = (templateId, category) => {
    setTemplatesByCategory((prev) => ({
      ...prev,
      [category]: prev[category].map((t) => ({
        ...t,
        is_default: t.id === templateId,
      })),
    }));
    setSuccess('Default template set (locally)');
  };

  // Preview
  const getPreviewContent = (content) => {
    if (!content) return '';
    let preview = content;
    Object.entries(placeholderData).forEach(([key, value]) => {
      const regex = new RegExp(`\\[${key}\\]`, 'gi');
      preview = preview.replace(regex, value);
    });
    return preview;
  };

  // Labels
  const getCategoryDisplayName = (category) => {
    switch (category) {
      case 'outreach':
        return 'Initial Outreach';
      case 'followup':
        return 'Follow Up';
      case 'lastchance':
        return 'Last Chance';
      default:
        return category;
    }
  };
  const getCategoryDescription = (category) => {
    switch (category) {
      case 'outreach':
        return 'Templates for initial contact emails';
      case 'followup':
        return 'Templates for follow-up emails after no response';
      case 'lastchance':
        return 'Templates for final follow-up attempts';
      default:
        return '';
    }
  };

  // Render card
  const renderTemplateCard = (template, category) => (
    <Card key={template.id} className="mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center mb-2">
              <h6 className="mb-0 me-2">{template.name}</h6>
              {template.is_default && <Badge bg="success">Default</Badge>}
            </div>
            <p className="text-muted small mb-2">
              {template.content.substring(0, 150)}...
            </p>
            <small className="text-muted">
              Created: {new Date(template.created_at).toLocaleDateString()}
            </small>
          </div>
          <div className="d-flex flex-column gap-1">
            {!template.is_default && (
              <Button
                variant="outline-success"
                size="sm"
                onClick={() => handleSetDefault(template.id, category)}
                disabled={loading}
              >
                Set Default
              </Button>
            )}
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => handleEditTemplate(template)}
            >
              Edit
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => handleDeleteTemplate(template.id, category)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  return (
    <Container>
      <h1 className="mb-4">Email Templates</h1>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && (
        <Alert variant="success" onClose={() => setSuccess('')} dismissible>
          {success}
        </Alert>
      )}

      {loading && (
        <div className="text-center mb-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      <Accordion defaultActiveKey="outreach">
        {['outreach', 'followup', 'lastchance'].map((category) => (
          <Accordion.Item key={category} eventKey={category}>
            <Accordion.Header>
              <div className="d-flex justify-content-between align-items-center w-100 me-3">
                <span>{getCategoryDisplayName(category)}</span>
                <div className="d-flex align-items-center">
                  <Badge bg="secondary" className="me-2">
                    {templatesByCategory[category]?.length || 0}/3
                  </Badge>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNewTemplate(category);
                    }}
                    disabled={(templatesByCategory[category]?.length || 0) >= 3}
                  >
                    Add Template
                  </Button>
                </div>
              </div>
            </Accordion.Header>
            <Accordion.Body>
              <p className="text-muted mb-3">{getCategoryDescription(category)}</p>

              {templatesByCategory[category]?.length > 0 ? (
                <div>
                  {templatesByCategory[category].map((template) =>
                    renderTemplateCard(template, category)
                  )}
                </div>
              ) : (
                <Alert variant="info">
                  No templates in this category. Create your first {getCategoryDisplayName(category).toLowerCase()} template to get started.
                </Alert>
              )}
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>

      {/* Modal for create/edit */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="lg"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? 'Edit Template' : 'Create Template'} - {getCategoryDisplayName(selectedCategory)}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
          >
            <Tab eventKey="editor" title="Editor">
              <Form onSubmit={handleSaveTemplate}>
                <Form.Group className="mb-3">
                  <Form.Label>Template Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={currentTemplate.name}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Category</Form.Label>
                  <Form.Select
                    name="category"
                    value={currentTemplate.category}
                    onChange={handleInputChange}
                    disabled={isEditing}
                  >
                    <option value="outreach">Initial Outreach</option>
                    <option value="followup">Follow Up</option>
                    <option value="lastchance">Last Chance</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email Content</Form.Label>
                  <Form.Control
                    as="textarea"
                    name="content"
                    value={currentTemplate.content}
                    onChange={handleInputChange}
                    rows={12}
                    required
                    placeholder={`Subject: Your Subject Here

Dear [Recipient Name],

Your email content here...

Best regards,
[Your Name]
[Your Position]
[Your Company]`}
                  />
                  <Form.Text className="text-muted">
                    Available placeholders: [Recipient Name], [Company Name], [Your Name], [Your Position], [Your Company]
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Set as default template for this category"
                    name="is_default"
                    checked={currentTemplate.is_default}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Form>
            </Tab>

            <Tab eventKey="preview" title="Preview">
              <Card className="bg-light">
                <Card.Body>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {getPreviewContent(currentTemplate.content)}
                  </div>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveTemplate}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Template'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default TemplatesPage;
