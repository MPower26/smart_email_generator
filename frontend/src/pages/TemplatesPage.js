import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Table, Modal, Tabs, Tab } from 'react-bootstrap';
import axios from 'axios';

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Pour le formulaire d'édition/création
  const [showModal, setShowModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState({
    id: null,
    name: '',
    subject: '',
    body: '',
    is_default: false
  });
  const [isEditing, setIsEditing] = useState(false);
  
  // Variables pour l'aperçu des placeholders
  const [activeTab, setActiveTab] = useState('editor');
  const placeholderData = {
    first_name: 'John',
    last_name: 'Smith',
    company: 'Acme Corporation',
    position: 'CTO',
    industry: 'Technology',
    technologies: 'AI, Cloud Computing'
  };

  // Charger les templates au chargement de la page
  useEffect(() => {
    loadTemplates();
  }, []);

  // Fonction pour charger les templates
  const loadTemplates = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get('/api/templates');
      setTemplates(response.data);
    } catch (err) {
      setError('Failed to load templates. Please try again later.');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir le modal de création de template
  const handleNewTemplate = () => {
    setCurrentTemplate({
      id: null,
      name: '',
      subject: '',
      body: '',
      is_default: false
    });
    setIsEditing(false);
    setShowModal(true);
    setActiveTab('editor');
  };

  // Ouvrir le modal d'édition avec un template existant
  const handleEditTemplate = (template) => {
    setCurrentTemplate({
      id: template.id,
      name: template.name,
      subject: template.subject,
      body: template.body,
      is_default: template.is_default
    });
    setIsEditing(true);
    setShowModal(true);
    setActiveTab('editor');
  };

  // Mettre à jour les champs du formulaire
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCurrentTemplate({
      ...currentTemplate,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // Sauvegarder un template (création ou modification)
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      let response;
      
      if (isEditing) {
        // Mettre à jour un template existant
        response = await axios.put(`/api/templates/${currentTemplate.id}`, currentTemplate);
        setSuccess('Template updated successfully!');
      } else {
        // Créer un nouveau template
        response = await axios.post('/api/templates', currentTemplate);
        setSuccess('New template created successfully!');
      }
      
      // Recharger la liste des templates
      await loadTemplates();
      setShowModal(false);
    } catch (err) {
      setError('Failed to save template. Please try again.');
      console.error('Error saving template:', err);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer un template
  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    
    setLoading(true);
    setError('');
    
    try {
      await axios.delete(`/api/templates/${id}`);
      setSuccess('Template deleted successfully!');
      // Recharger la liste des templates
      await loadTemplates();
    } catch (err) {
      setError('Failed to delete template. Please try again.');
      console.error('Error deleting template:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour afficher l'aperçu avec les placeholders remplacés
  const getPreviewContent = (content) => {
    if (!content) return '';
    
    let preview = content;
    
    // Remplacer les placeholders par les valeurs d'exemple
    Object.entries(placeholderData).forEach(([key, value]) => {
      const regex = new RegExp(`\\[${key}\\]`, 'gi');
      preview = preview.replace(regex, value);
    });
    
    return preview;
  };

  return (
    <Container>
      <h1 className="mb-4">Email Templates</h1>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}
      
      <div className="d-flex justify-content-end mb-4">
        <Button variant="primary" onClick={handleNewTemplate}>
          Create New Template
        </Button>
      </div>
      
      <Card>
        <Card.Body>
          {loading ? (
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : templates.length > 0 ? (
            <Table responsive striped>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                  <th style={{ width: '40%' }}>Preview</th>
                  <th>Default</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(template => (
                  <tr key={template.id}>
                    <td>{template.name}</td>
                    <td>{template.subject}</td>
                    <td className="text-truncate" style={{ maxWidth: '300px' }}>
                      {template.body.substring(0, 100)}...
                    </td>
                    <td>{template.is_default ? '✓' : ''}</td>
                    <td>
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        className="me-2"
                        onClick={() => handleEditTemplate(template)}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Alert variant="info">
              No templates found. Create your first template to get started.
            </Alert>
          )}
        </Card.Body>
      </Card>
      
      {/* Modal pour créer/éditer un template */}
      <Modal 
        show={showModal} 
        onHide={() => setShowModal(false)}
        size="lg"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? 'Edit Template' : 'Create Template'}</Modal.Title>
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
                  <Form.Label>Subject Line</Form.Label>
                  <Form.Control
                    type="text"
                    name="subject"
                    value={currentTemplate.subject}
                    onChange={handleInputChange}
                    required
                  />
                  <Form.Text className="text-muted">
                    You can use placeholders like [first_name], [company], etc.
                  </Form.Text>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Email Body</Form.Label>
                  <Form.Control
                    as="textarea"
                    name="body"
                    value={currentTemplate.body}
                    onChange={handleInputChange}
                    rows={10}
                    required
                  />
                  <Form.Text className="text-muted">
                    Available placeholders: [first_name], [last_name], [company], [position], [industry], [technologies]
                  </Form.Text>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Set as default template"
                    name="is_default"
                    checked={currentTemplate.is_default}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Form>
            </Tab>
            
            <Tab eventKey="preview" title="Preview">
              <Card className="bg-light">
                <Card.Header>
                  <strong>Subject:</strong> {getPreviewContent(currentTemplate.subject)}
                </Card.Header>
                <Card.Body>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {getPreviewContent(currentTemplate.body)}
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