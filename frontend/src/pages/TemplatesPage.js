import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Modal, Tabs, Tab, Accordion, Badge } from 'react-bootstrap';
import { templateService } from '../services/api';


const TemplatesPage = () => {
  const [templatesByCategory, setTemplatesByCategory] = useState({
    outreach: [],
    followup: [],
    lastchance: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState({
    id: null,
    name: '',
    content: '',
    category: 'outreach',
    is_default: false
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('outreach');
  
  // Variables pour l'aperçu des placeholders
  const [activeTab, setActiveTab] = useState('editor');
  const placeholderData = {
    'Recipient Name': 'John Smith',
    'Company Name': 'Acme Corporation',
    'Your Name': 'Jane Doe',
    'Your Position': 'Sales Manager',
    'Your Company': 'Tech Solutions Inc.'
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
      const response = await templateService.getTemplatesByCategory();
      setTemplatesByCategory(response.data);
    } catch (err) {
      setError('Failed to load templates. Please try again later.');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir le modal de création de template
  const handleNewTemplate = (category) => {
    setSelectedCategory(category);
    setCurrentTemplate({
      id: null,
      name: '',
      content: '',
      category: category,
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
      content: template.content,
      category: template.category,
      is_default: template.is_default
    });
    setSelectedCategory(template.category);
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
        response = await templateService.updateTemplate(currentTemplate.id, currentTemplate);
        setSuccess('Template updated successfully!');
      } else {
        // Créer un nouveau template
        response = await templateService.createTemplate(currentTemplate);
        setSuccess('New template created successfully!');
      }
      
      // Recharger la liste des templates
      await loadTemplates();
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save template. Please try again.');
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
      await templateService.deleteTemplate(id);
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

  // Set template as default
  const handleSetDefault = async (templateId) => {
    setLoading(true);
    setError('');
    
    try {
      await templateService.setDefaultTemplate(templateId);
      setSuccess('Default template updated successfully!');
      await loadTemplates();
    } catch (err) {
      setError('Failed to set default template. Please try again.');
      console.error('Error setting default template:', err);
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

  // Get category display name
  const getCategoryDisplayName = (category) => {
    switch (category) {
      case 'outreach': return 'Initial Outreach';
      case 'followup': return 'Follow Up';
      case 'lastchance': return 'Last Chance';
      default: return category;
    }
  };

  // Get category description
  const getCategoryDescription = (category) => {
    switch (category) {
      case 'outreach': return 'Templates for initial contact emails';
      case 'followup': return 'Templates for follow-up emails after no response';
      case 'lastchance': return 'Templates for final follow-up attempts';
      default: return '';
    }
  };

  // Render template card
  const renderTemplateCard = (template) => (
    <Card key={template.id} className="mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center mb-2">
              <h6 className="mb-0 me-2">{template.name}</h6>
              {template.is_default && (
                <Badge bg="success">Default</Badge>
              )}
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
                onClick={() => handleSetDefault(template.id)}
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
              onClick={() => handleDeleteTemplate(template.id)}
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
      {success && <Alert variant="success" onClose={() => setSuccess('')} dismissible>{success}</Alert>}
      
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
                  {templatesByCategory[category].map(template => renderTemplateCard(template))}
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
      
      {/* Modal pour créer/éditer un template */}
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
                    disabled={isEditing} // Don't allow changing category when editing
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
                    placeholder="Subject: Your Subject Here

Dear [Recipient Name],

Your email content here...

Best regards,
[Your Name]
[Your Position]
[Your Company]"
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
