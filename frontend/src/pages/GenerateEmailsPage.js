import React, { useState, useContext, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Tabs, Tab, Badge } from 'react-bootstrap';
import FileUpload from '../components/FileUpload';
import EmailPreview from '../components/EmailPreview';
import { emailService } from '../services/api';
import { UserContext } from '../contexts/UserContext';

const GenerateEmailsPage = () => {
  const { userProfile } = useContext(UserContext);
  const [file, setFile] = useState(null);
  const [generationMethod, setGenerationMethod] = useState('ai');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('generation');
  const [emailStage, setEmailStage] = useState('outreach');
  
  // Pour les onglets de suivi
  const [outreachEmails, setOutreachEmails] = useState([]);
  const [followupEmails, setFollowupEmails] = useState([]);
  const [lastChanceEmails, setLastChanceEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Handle file change
  const handleFileChange = (selectedFile) => {
    setFile(selectedFile);
    setError('');
  };

  // Load templates from the backend
  const loadTemplates = async () => {
    try {
      const response = await emailService.getTemplates();
      setTemplates(response.data);
      if (response.data.length > 0) {
        const defaultTemplate = response.data.find(t => t.is_default);
        setSelectedTemplate(defaultTemplate ? defaultTemplate.id : response.data[0].id);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates. Please try again later.');
    }
  };
  
  // Load emails by stage
  const loadEmailsByStage = async () => {
    setLoadingEmails(true);
    try {
      const [outreach, followup, lastChance] = await Promise.all([
        emailService.getEmailsByStage('outreach'),
        emailService.getEmailsByStage('followup'),
        emailService.getEmailsByStage('lastchance')
      ]);
      
      setOutreachEmails(outreach.data || []);
      setFollowupEmails(followup.data || []);
      setLastChanceEmails(lastChance.data || []);
    } catch (err) {
      console.error('Error loading emails by stage:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    loadTemplates();
    loadEmailsByStage();
  }, []);

  // Generate emails
  const handleGenerateEmails = async () => {
    if (!file) {
      setError('Please select a CSV file.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('use_ai', generationMethod === 'ai');
    formData.append('stage', emailStage);
    
    // Ajouter les informations du profil utilisateur si disponibles
    if (userProfile) {
      if (userProfile.name) formData.append('your_name', userProfile.name);
      if (userProfile.position) formData.append('your_position', userProfile.position);
      if (userProfile.companyName) formData.append('company_name', userProfile.companyName);
      if (userProfile.email) formData.append('your_contact', userProfile.email);
    }
    
    if (generationMethod === 'template' && selectedTemplate) {
      formData.append('template_id', selectedTemplate);
    }

    try {
      const response = await emailService.generateEmails(formData);
      
      if (response.data && response.data.emails) {
        setEmails(response.data.emails);
        setActiveTab('preview');
        setLoading(false);
        
        // Recharger les emails après une génération réussie
        loadEmailsByStage();
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error generating emails:', err);
      setError(
        err.response?.data?.detail || err.response?.data?.message || 
        'Failed to generate emails. Please check your file and try again.'
      );
      setLoading(false);
    }
  };

  // Export all emails
  const handleExportAll = () => {
    if (emails.length === 0) return;

    let content = '';
    emails.forEach(email => {
      content += `TO: ${email.to}\n`;
      content += `SUBJECT: ${email.subject}\n`;
      content += `BODY:\n${email.body}\n\n`;
      content += '-----------------------------------\n\n';
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-emails.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Marquer un email comme envoyé
  const handleMarkAsSent = async (emailId, stage) => {
    try {
      await emailService.updateEmailStatus(emailId, { status: 'sent' });
      // Recharger les emails après
      loadEmailsByStage();
    } catch (err) {
      console.error('Error marking email as sent:', err);
      setError('Failed to update email status.');
    }
  };
  
  // Déplacer un email vers l'étape suivante (Outreach -> FollowUp -> LastChance)
  const handleMoveToNextStage = async (emailId, currentStage) => {
    let nextStage;
    
    if (currentStage === 'outreach') {
      nextStage = 'followup';
    } else if (currentStage === 'followup') {
      nextStage = 'lastchance';
    } else {
      return; // Déjà dans la dernière étape
    }
    
    try {
      await emailService.updateEmailStage(emailId, { stage: nextStage });
      // Recharger les emails après
      loadEmailsByStage();
    } catch (err) {
      console.error('Error moving email to next stage:', err);
      setError('Failed to update email stage.');
    }
  };

  return (
    <Container>
      <h1 className="mb-4">Email Campaign Manager</h1>

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="generation" title="Generation">
          <Card>
            <Card.Body>
              <h5 className="mb-4">Import Contacts</h5>
              <FileUpload onFileSelect={handleFileChange} acceptedTypes=".csv" />

              <h5 className="mt-4 mb-3">Generation Options</h5>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Email Stage</Form.Label>
                  <div>
                    <Form.Check
                      type="radio"
                      label="Initial Outreach"
                      name="emailStage"
                      id="outreachStage"
                      checked={emailStage === 'outreach'}
                      onChange={() => setEmailStage('outreach')}
                      className="mb-2"
                    />
                    <Form.Check
                      type="radio"
                      label="Follow-Up"
                      name="emailStage"
                      id="followupStage"
                      checked={emailStage === 'followup'}
                      onChange={() => setEmailStage('followup')}
                      className="mb-2"
                    />
                    <Form.Check
                      type="radio"
                      label="Last Chance"
                      name="emailStage"
                      id="lastChanceStage"
                      checked={emailStage === 'lastchance'}
                      onChange={() => setEmailStage('lastchance')}
                    />
                  </div>
                </Form.Group>
              
                <Form.Group className="mb-3">
                  <Form.Label>Generation Method</Form.Label>
                  <div>
                    <Form.Check
                      type="radio"
                      label="AI Generation (Azure OpenAI)"
                      name="generationMethod"
                      id="aiMethod"
                      checked={generationMethod === 'ai'}
                      onChange={() => setGenerationMethod('ai')}
                      className="mb-2"
                    />
                    <Form.Check
                      type="radio"
                      label="Use Template"
                      name="generationMethod"
                      id="templateMethod"
                      checked={generationMethod === 'template'}
                      onChange={() => {
                        setGenerationMethod('template');
                        loadTemplates();
                      }}
                    />
                  </div>
                </Form.Group>

                {generationMethod === 'template' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Select Template</Form.Label>
                    <Form.Select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                    >
                      {templates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name} {template.is_default && '(Default)'}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                )}

                {error && <Alert variant="danger">{error}</Alert>}

                <div className="d-grid mt-4">
                  <Button
                    variant="primary"
                    onClick={handleGenerateEmails}
                    disabled={loading || !file}
                  >
                    {loading ? 'Generating...' : 'Generate Emails'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="preview" title="Preview">
          <Card>
            <Card.Body>
              {emails.length > 0 ? (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5>Generated Emails ({emails.length})</h5>
                    <Button 
                      variant="success" 
                      onClick={handleExportAll}
                    >
                      Export All
                    </Button>
                  </div>
                  
                  {emails.map((email, index) => (
                    <EmailPreview 
                      key={index} 
                      email={email} 
                      index={index} 
                    />
                  ))}
                </>
              ) : (
                <Alert variant="info">
                  No emails generated. Please return to the 'Generation' tab to start.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="outreach" title={<span>Outreach <Badge bg="primary">{outreachEmails.length}</Badge></span>}>
          <Card>
            <Card.Body>
              <h5 className="mb-4">Initial Outreach Emails</h5>
              {loadingEmails ? (
                <div className="text-center my-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : outreachEmails.length > 0 ? (
                outreachEmails.map((email, index) => (
                  <Card key={index} className="mb-3">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>To:</strong> {email.to}
                      </div>
                      <div>
                        <Badge bg={email.status === 'sent' ? 'success' : 'warning'}>
                          {email.status || 'Not Sent'}
                        </Badge>
                      </div>
                    </Card.Header>
                    <Card.Body>
                      <h6>Subject: {email.subject}</h6>
                      <p className="email-body">{email.body}</p>
                    </Card.Body>
                    <Card.Footer className="d-flex justify-content-end">
                      {email.status !== 'sent' && (
                        <Button 
                          variant="outline-success" 
                          size="sm" 
                          className="me-2"
                          onClick={() => handleMarkAsSent(email.id, 'outreach')}
                        >
                          Mark as Sent
                        </Button>
                      )}
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => handleMoveToNextStage(email.id, 'outreach')}
                      >
                        Move to Follow-Up
                      </Button>
                    </Card.Footer>
                  </Card>
                ))
              ) : (
                <Alert variant="info">No outreach emails found.</Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="followup" title={<span>Follow-Up <Badge bg="primary">{followupEmails.length}</Badge></span>}>
          <Card>
            <Card.Body>
              <h5 className="mb-4">Follow-Up Emails</h5>
              {loadingEmails ? (
                <div className="text-center my-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : followupEmails.length > 0 ? (
                followupEmails.map((email, index) => (
                  <Card key={index} className="mb-3">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>To:</strong> {email.to}
                      </div>
                      <div>
                        <Badge bg={email.status === 'sent' ? 'success' : 'warning'}>
                          {email.status || 'Not Sent'}
                        </Badge>
                      </div>
                    </Card.Header>
                    <Card.Body>
                      <h6>Subject: {email.subject}</h6>
                      <p className="email-body">{email.body}</p>
                    </Card.Body>
                    <Card.Footer className="d-flex justify-content-end">
                      {email.status !== 'sent' && (
                        <Button 
                          variant="outline-success" 
                          size="sm" 
                          className="me-2"
                          onClick={() => handleMarkAsSent(email.id, 'followup')}
                        >
                          Mark as Sent
                        </Button>
                      )}
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => handleMoveToNextStage(email.id, 'followup')}
                      >
                        Move to Last Chance
                      </Button>
                    </Card.Footer>
                  </Card>
                ))
              ) : (
                <Alert variant="info">No follow-up emails found.</Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="lastchance" title={<span>Last Chance <Badge bg="primary">{lastChanceEmails.length}</Badge></span>}>
          <Card>
            <Card.Body>
              <h5 className="mb-4">Last Chance Emails</h5>
              {loadingEmails ? (
                <div className="text-center my-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : lastChanceEmails.length > 0 ? (
                lastChanceEmails.map((email, index) => (
                  <Card key={index} className="mb-3">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>To:</strong> {email.to}
                      </div>
                      <div>
                        <Badge bg={email.status === 'sent' ? 'success' : 'warning'}>
                          {email.status || 'Not Sent'}
                        </Badge>
                      </div>
                    </Card.Header>
                    <Card.Body>
                      <h6>Subject: {email.subject}</h6>
                      <p className="email-body">{email.body}</p>
                    </Card.Body>
                    <Card.Footer className="d-flex justify-content-end">
                      {email.status !== 'sent' && (
                        <Button 
                          variant="outline-success" 
                          size="sm" 
                          className="me-2"
                          onClick={() => handleMarkAsSent(email.id, 'lastchance')}
                        >
                          Mark as Sent
                        </Button>
                      )}
                    </Card.Footer>
                  </Card>
                ))
              ) : (
                <Alert variant="info">No last chance emails found.</Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default GenerateEmailsPage; 