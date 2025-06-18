import React, { useState, useEffect, useContext } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('generation');
  const [emailStage, setEmailStage] = useState('outreach');
  
  // Stage-specific email arrays
  const [outreachEmails, setOutreachEmails] = useState([]);
  const [followupEmails, setFollowupEmails] = useState([]);
  const [lastChanceEmails, setLastChanceEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [lastAction, setLastAction] = useState({ id: null, type: null }); // { id: emailId, type: 'sent' | 'unmarked' }

  // Track which tab's emails should be collapsed
  const isTabCollapsed = (tabName) => {
    // Return true if this is not the active tab, meaning emails should be collapsed
    return activeTab !== tabName;
  };

  // Handle tab change
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    // No need for additional logic, the isCollapsed prop will trigger useEffect in EmailPreview
  };

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
      console.log('Loading emails by stage...');
      
      // Get the user profile for authentication
      const userEmail = userProfile?.email;
      console.log('Current user email for auth:', userEmail);
      
      if (!userEmail) {
        console.error('No user email available for authentication');
        setError('You must be logged in to view emails');
        return;
      }
      
      // Simple approach - fetch outreach emails directly
      try {
        const response = await fetch('https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net/api/emails/by-stage/outreach', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userEmail}`
          },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Outreach data:', data);
          setOutreachEmails(data);
        } else {
          console.error('Failed to fetch outreach emails:', response.status);
        }
      } catch (err) {
        console.error('Error fetching outreach emails:', err);
      }
      
      // Fetch follow-up emails
      try {
        const response = await fetch('https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net/api/emails/by-stage/followup', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userEmail}`
          },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Follow-up data:', data);
          setFollowupEmails(data);
        } else {
          console.error('Failed to fetch follow-up emails:', response.status);
        }
      } catch (err) {
        console.error('Error fetching follow-up emails:', err);
      }
      
      // Fetch last chance emails
      try {
        const response = await fetch('https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net/api/emails/by-stage/lastchance', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userEmail}`
          },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Last chance data:', data);
          setLastChanceEmails(data);
        } else {
          console.error('Failed to fetch last chance emails:', response.status);
        }
      } catch (err) {
        console.error('Error fetching last chance emails:', err);
      }
      
    } catch (err) {
      console.error('General error loading emails:', err);
      setError('Failed to load emails. Please try again.');
    } finally {
      setLoadingEmails(false);
    }
  };

  // Load data when component mounts or user profile changes
  useEffect(() => {
    loadTemplates();
    loadEmailsByStage();

    // Add event listener for email updates from friend sharing
    const handleEmailsUpdated = (event) => {
      const updatedEmails = event.detail;
      
      // Update each email in the appropriate list
      updatedEmails.forEach(updatedEmail => {
        switch (updatedEmail.stage) {
          case 'outreach':
            setOutreachEmails(prevEmails => {
              const newEmails = [...prevEmails];
              const index = newEmails.findIndex(e => e.id === updatedEmail.id);
              if (index !== -1) {
                newEmails[index] = updatedEmail;
              }
              return newEmails;
            });
            break;
          case 'followup':
            setFollowupEmails(prevEmails => {
              const newEmails = [...prevEmails];
              const index = newEmails.findIndex(e => e.id === updatedEmail.id);
              if (index !== -1) {
                newEmails[index] = updatedEmail;
              }
              return newEmails;
            });
            break;
          case 'lastchance':
            setLastChanceEmails(prevEmails => {
              const newEmails = [...prevEmails];
              const index = newEmails.findIndex(e => e.id === updatedEmail.id);
              if (index !== -1) {
                newEmails[index] = updatedEmail;
              }
              return newEmails;
            });
            break;
        }
      });
    };

    window.addEventListener('emailsUpdated', handleEmailsUpdated);

    return () => {
      window.removeEventListener('emailsUpdated', handleEmailsUpdated);
    };
  }, [userProfile]);

  // Debug user profile
  useEffect(() => {
    console.log('Current user profile:', userProfile);
    // Check localStorage for debugging
    const storedProfile = localStorage.getItem('userProfile');
    console.log('Profile in localStorage:', storedProfile ? JSON.parse(storedProfile) : null);
  }, [userProfile]);

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
    
    // Add user profile information if available
    if (userProfile) {
      if (userProfile.full_name) formData.append('your_name', userProfile.full_name);
      if (userProfile.position) formData.append('your_position', userProfile.position);
      if (userProfile.company_name) formData.append('company_name', userProfile.company_name);
      if (userProfile.email) formData.append('your_contact', userProfile.email);
    }
    
    if (generationMethod === 'template' && selectedTemplate) {
      formData.append('template_id', selectedTemplate);
    }

    try {
      const response = await emailService.generateEmails(formData);
      
      if (response.data && response.data.emails) {
        // Reload emails after generation is complete
        await loadEmailsByStage();
        
        // Switch to appropriate tab based on the stage of generated emails
        setActiveTab(emailStage);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error generating emails:', err);
      setError(
        err.response?.data?.detail || err.response?.data?.message || 
        'Failed to generate emails. Please check your file and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Export emails from a specific stage
  const handleExportStage = (stageEmails, stageName) => {
    if (stageEmails.length === 0) {
      setError(`No ${stageName} emails to export.`);
      return;
    }

    let content = '';
    stageEmails.forEach(email => {
      content += `TO: ${email.to}\n`;
      content += `SUBJECT: ${email.subject}\n`;
      content += `BODY:\n${email.body}\n\n`;
      content += '-----------------------------------\n\n';
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stageName}-emails.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Mark an email as sent (updates status in DB only)
  const handleMarkAsSent = async (emailId) => {
    setError(null); // Clear previous errors
    try {
      await emailService.updateEmailStatus(emailId, { status: 'sent' });
      setLastAction({ id: emailId, type: 'sent' }); // <-- Set action type to 'sent'
      loadEmailsByStage(); // Reload to reflect status change
    } catch (err) {
      console.error('Error marking email as sent:', err);
      setError('Failed to update email status.');
      setLastAction({ id: null, type: null }); // Clear highlight on error
    }
  };

  // Unmark an email as sent (sets status back to draft)
  const handleUnmarkAsSent = async (emailId) => {
    setError(null); // Clear previous errors
    try {
      await emailService.updateEmailStatus(emailId, { status: 'draft' });
      setLastAction({ id: emailId, type: 'unmarked' }); // <-- Set action type to 'unmarked'
      loadEmailsByStage(); // Reload to reflect status change
    } catch (err) {
      console.error('Error unmarking email:', err);
      setError('Failed to unmark email.');
      setLastAction({ id: null, type: null }); // Clear highlight on error
    }
  };

  // Delete an email
  const handleDeleteEmail = async (emailId) => {
    console.log(`[GenerateEmailsPage] handleDeleteEmail called for ID: ${emailId}`); // <-- Log entry
    setError(null); // Clear previous errors
    // Remove this line for now, error handling in child handles it
    // setLastAction({ id: null, type: null }); 
    try {
      console.log(`[GenerateEmailsPage] Calling emailService.deleteEmail for ID: ${emailId}`);
      await emailService.deleteEmail(emailId);
      console.log(`[GenerateEmailsPage] deleteEmail service call finished for ID: ${emailId}`);
      loadEmailsByStage(); // Reload to reflect deletion
    } catch (err) {
      console.error('[GenerateEmailsPage] Error deleting email:', err);
      const errorDetail = err.response?.data?.detail || err.message || 'An unknown error occurred';
      setError(`Failed to delete email: ${errorDetail}`);
      // Re-throw so the preview component can handle its loading state
      console.log('[GenerateEmailsPage] Re-throwing error after delete failure.');
      throw new Error(`Failed to delete email: ${errorDetail}`); 
    }
  };

  return (
    <Container>
      <h1 className="mb-4">Email Campaign Manager</h1>

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => handleTabChange(k)}
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

        <Tab eventKey="outreach" title={<span>Outreach {outreachEmails.length > 0 && <Badge bg="primary">{outreachEmails.length}</Badge>}</span>}>
          <Card>
            <Card.Body>
              {loadingEmails ? (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : outreachEmails.length === 0 ? (
                <div className="text-center p-4 bg-light rounded">
                  <p className="mb-0">No outreach emails found. Generate emails with the "Initial Outreach" stage to see them here.</p>
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5>Outreach Emails ({outreachEmails.length})</h5>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => handleExportStage(outreachEmails, 'outreach')}
                    >
                      Export Outreach Emails
                    </Button>
                  </div>
                  <div className="email-list">
                    {[...outreachEmails]
                      .sort((a, b) => {
                        // First sort by status
                        const statusOrder = { 'sent': 0, 'draft': 1, 'sent by friend': 2 };
                        const statusA = statusOrder[a.status] || 3;
                        const statusB = statusOrder[b.status] || 3;
                        return statusA - statusB;
                      })
                      .map((email, index) => (
                        <div key={index} className="mb-2">
                          <EmailPreview 
                            email={email} 
                            onSend={handleMarkAsSent}
                            onUnmarkSent={handleUnmarkAsSent}
                            onDelete={handleDeleteEmail}
                            isCollapsed={isTabCollapsed('outreach')}
                            isSentHighlight={lastAction.type === 'sent' && lastAction.id === email.id}
                            isUnmarkedHighlight={lastAction.type === 'unmarked' && lastAction.id === email.id}
                          />
                        </div>
                      ))}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="followup" title={<span>Follow-Up {followupEmails.length > 0 && <Badge bg="primary">{followupEmails.length}</Badge>}</span>}>
          <Card>
            <Card.Body>
              {loadingEmails ? (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : followupEmails.length === 0 ? (
                <div className="text-center p-4 bg-light rounded">
                  <p className="mb-0">No follow-up emails found. Generate emails with the "Follow-Up" stage or move outreach emails to this stage.</p>
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5>Follow-Up Emails ({followupEmails.length})</h5>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => handleExportStage(followupEmails, 'followup')}
                    >
                      Export Follow-Up Emails
                    </Button>
                  </div>
                  <div className="email-list">
                    {[...followupEmails]
                      .sort((a, b) => {
                        // First sort by status
                        const statusOrder = { 'sent': 0, 'draft': 1, 'sent by friend': 2 };
                        const statusA = statusOrder[a.status] || 3;
                        const statusB = statusOrder[b.status] || 3;
                        return statusA - statusB;
                      })
                      .map((email, index) => (
                        <div key={index} className="mb-2">
                          <EmailPreview 
                            email={email} 
                            onSend={handleMarkAsSent}
                            onUnmarkSent={handleUnmarkAsSent}
                            onDelete={handleDeleteEmail}
                            isCollapsed={isTabCollapsed('followup')}
                            isSentHighlight={lastAction.type === 'sent' && lastAction.id === email.id}
                            isUnmarkedHighlight={lastAction.type === 'unmarked' && lastAction.id === email.id}
                          />
                        </div>
                      ))}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="lastChance" title={<span>Last Chance {lastChanceEmails.length > 0 && <Badge bg="primary">{lastChanceEmails.length}</Badge>}</span>}>
          <Card>
            <Card.Body>
              {loadingEmails ? (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : lastChanceEmails.length === 0 ? (
                <div className="text-center p-4 bg-light rounded">
                  <p className="mb-0">No last chance emails found. Generate emails with the "Last Chance" stage or move follow-up emails to this stage.</p>
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5>Last Chance Emails ({lastChanceEmails.length})</h5>
                    <Button 
                      variant="outline-secondary" 
                      size="sm"
                      onClick={() => handleExportStage(lastChanceEmails, 'lastchance')}
                    >
                      Export Last Chance Emails
                    </Button>
                  </div>
                  <div className="email-list">
                    {[...lastChanceEmails]
                      .sort((a, b) => {
                        // First sort by status
                        const statusOrder = { 'sent': 0, 'draft': 1, 'sent by friend': 2 };
                        const statusA = statusOrder[a.status] || 3;
                        const statusB = statusOrder[b.status] || 3;
                        return statusA - statusB;
                      })
                      .map((email, index) => (
                        <div key={index} className="mb-2">
                          <EmailPreview 
                            email={email} 
                            onSend={handleMarkAsSent}
                            onUnmarkSent={handleUnmarkAsSent}
                            onDelete={handleDeleteEmail}
                            isCollapsed={isTabCollapsed('lastChance')}
                            isSentHighlight={lastAction.type === 'sent' && lastAction.id === email.id}
                            isUnmarkedHighlight={lastAction.type === 'unmarked' && lastAction.id === email.id}
                          />
                        </div>
                      ))}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default GenerateEmailsPage; 
