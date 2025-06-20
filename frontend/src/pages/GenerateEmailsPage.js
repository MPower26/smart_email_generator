import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Tabs, Tab, Badge, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import FileUpload from '../components/FileUpload';
import EmailPreview from '../components/EmailPreview';
import ProgressTracker from '../components/ProgressTracker';
import { emailService, templateService } from '../services/api';
import { UserContext } from '../contexts/UserContext';
import WebSocketService from '../services/websocket';

const GenerateEmailsPage = () => {
  const { userProfile } = useContext(UserContext);
  const [file, setFile] = useState(null);
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
  const [avoidDuplicates, setAvoidDuplicates] = useState(true);

  // Progress tracking state
  const [uploadProgress, setUploadProgress] = useState({
    type: 'upload',
    current: 0,
    total: 0,
    fileSize: 0,
    startTime: null,
    speed: 0,
    status: 'idle'
  });
  
  const [generationProgress, setGenerationProgress] = useState({
    type: 'generation',
    current: 0,
    total: 0,
    startTime: null,
    speed: 0,
    status: 'idle'
  });
  
  const [sendingProgress, setSendingProgress] = useState({
    type: 'sending',
    current: 0,
    total: 0,
    startTime: null,
    speed: 0,
    status: 'idle'
  });

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
      // Load templates filtered by the current email stage
      const response = await templateService.getTemplatesByCategoryFilter(emailStage);
      setTemplates(response.data);
      
      // Set default template for the current stage
      if (response.data.length > 0) {
        const defaultTemplate = response.data.find(t => t.is_default);
        setSelectedTemplate(defaultTemplate ? defaultTemplate.id : response.data[0].id);
      } else {
        setSelectedTemplate('ai_generated'); // Use AI generated when no templates exist
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates. Please try again later.');
      setSelectedTemplate('ai_generated'); // Fallback to AI generated
    }
  };

  // Load all templates for validation (not just stage-specific)
  const loadAllTemplates = async () => {
    try {
      const response = await templateService.getAllTemplates();
      return response.data;
    } catch (err) {
      console.error('Error loading all templates:', err);
      return [];
    }
  };

  // Load templates when email stage changes
  useEffect(() => {
    loadTemplates();
  }, [emailStage]);
  
  // Handle template selection change
  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
  };

  // Handle add template button click
  const handleAddTemplate = () => {
    window.open('https://jolly-bush-0bae83703.6.azurestaticapps.net/templates', '_blank');
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
      
      let outreachSentEmails = []; // Store outreach_sent emails to add to Follow-Up
      
      // Fetch outreach emails and filter out outreach_sent (they belong in Follow-Up)
      try {
        const response = await emailService.getEmailsByStage('outreach');
        console.log('Outreach data:', response.data);
        // Filter out outreach_sent emails - they belong in Follow-Up
        const filteredOutreachEmails = response.data.filter(email => email.status !== 'outreach_sent');
        setOutreachEmails(filteredOutreachEmails);
        
        // Store outreach_sent emails to add to Follow-Up
        outreachSentEmails = response.data.filter(email => email.status === 'outreach_sent' && email.followup_due_at);
      } catch (err) {
        console.error('Error fetching outreach emails:', err);
      }
      
      // Fetch follow-up emails and combine with outreach_sent emails
      try {
        const response = await emailService.getEmailsByStage('followup');
        console.log('Follow-up data:', response.data);
        console.log('Outreach_sent emails to add:', outreachSentEmails);
        
        // Combine followup emails with outreach_sent emails that have followup_due_at
        const combinedFollowupEmails = [...response.data, ...outreachSentEmails];
        setFollowupEmails(combinedFollowupEmails);
      } catch (err) {
        console.error('Error fetching follow-up emails:', err);
      }
      
      // Fetch last chance emails
      try {
        const response = await emailService.getEmailsByStage('lastchance');
        console.log('Last chance data:', response.data);
        setLastChanceEmails(response.data);
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

    // Connect to WebSocket for real-time progress updates
    if (userProfile?.email) {
      WebSocketService.connect(userProfile.email);
      WebSocketService.onProgress(handleProgressUpdate);
    }

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
      WebSocketService.disconnect();
    };
  }, [userProfile]);

  // Debug user profile
  useEffect(() => {
    console.log('Current user profile:', userProfile);
    // Check localStorage for debugging
    const storedProfile = localStorage.getItem('userProfile');
    console.log('Profile in localStorage:', storedProfile ? JSON.parse(storedProfile) : null);
  }, [userProfile]);

  // Handle real-time progress updates from WebSocket
  const handleProgressUpdate = (data) => {
    console.log('Progress update received:', data);
    
    switch (data.type) {
      case 'generation_start':
        setGenerationProgress({
          type: 'generation',
          current: 0,
          total: data.total_contacts,
          startTime: Date.now(),
          speed: 0,
          status: 'processing'
        });
        break;
        
      case 'generation_progress':
        setGenerationProgress(prev => ({
          ...prev,
          current: data.current,
          total: data.total,
          speed: data.speed || 0,
          status: 'processing'
        }));
        break;
        
      case 'generation_complete':
        setGenerationProgress(prev => ({
          ...prev,
          current: data.total_generated,
          status: 'completed'
        }));
        break;
        
      case 'generation_error':
        setGenerationProgress(prev => ({
          ...prev,
          status: 'error'
        }));
        setError(data.error);
        break;
        
      case 'sending_start':
        setSendingProgress({
          type: 'sending',
          current: 0,
          total: data.total_emails,
          startTime: Date.now(),
          speed: 0,
          status: 'processing'
        });
        break;
        
      case 'sending_progress':
        setSendingProgress(prev => ({
          ...prev,
          current: data.current,
          total: data.total,
          speed: data.current / Math.max(1, (Date.now() - prev.startTime) / 1000),
          status: 'processing'
        }));
        break;
        
      case 'sending_complete':
        setSendingProgress(prev => ({
          ...prev,
          current: data.total_sent,
          status: 'completed'
        }));
        break;
        
      case 'sending_error':
        setSendingProgress(prev => ({
          ...prev,
          status: 'error'
        }));
        setError(`Failed to send email to ${data.recipient}: ${data.error}`);
        break;
    }
  };

  // Generate emails
  const handleGenerateEmails = async () => {
    if (!file) {
      setError('Please select a CSV file.');
      return;
    }

    // Load all templates for validation
    const allTemplates = await loadAllTemplates();
    console.log('All templates loaded for validation:', allTemplates);
    
    // Check if templates exist for all categories
    const hasOutreachTemplate = allTemplates.some(t => t.category === 'outreach');
    const hasFollowupTemplate = allTemplates.some(t => t.category === 'followup');
    const hasLastchanceTemplate = allTemplates.some(t => t.category === 'lastchance');

    console.log('Template validation results:', {
      hasOutreachTemplate,
      hasFollowupTemplate,
      hasLastchanceTemplate,
      outreachTemplates: allTemplates.filter(t => t.category === 'outreach'),
      followupTemplates: allTemplates.filter(t => t.category === 'followup'),
      lastchanceTemplates: allTemplates.filter(t => t.category === 'lastchance')
    });

    if (!hasOutreachTemplate || !hasFollowupTemplate || !hasLastchanceTemplate) {
      const missingTemplates = [];
      if (!hasOutreachTemplate) missingTemplates.push('Initial Outreach');
      if (!hasFollowupTemplate) missingTemplates.push('Follow-Up');
      if (!hasLastchanceTemplate) missingTemplates.push('Last Chance');
      
      setError(
        'You must create templates for all email stages before generating emails. ' +
        'Please create templates for: ' + missingTemplates.join(', ') +
        '. You can create templates in the Templates section.'
      );
      return;
    }

    setLoading(true);
    setError('');

    // Start upload progress tracking
    const uploadStartTime = Date.now();
    const fileSize = file.size;
    setUploadProgress({
      type: 'upload',
      current: 0,
      total: fileSize,
      fileSize: fileSize,
      startTime: uploadStartTime,
      speed: 0,
      status: 'processing'
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('use_ai', selectedTemplate === 'ai_generated');
    formData.append('stage', emailStage);
    formData.append('avoid_duplicates', avoidDuplicates);
    
    // Add user profile information if available
    if (userProfile) {
      if (userProfile.full_name) formData.append('your_name', userProfile.full_name);
      if (userProfile.position) formData.append('your_position', userProfile.position);
      if (userProfile.company_name) formData.append('company_name', userProfile.company_name);
      if (userProfile.email) formData.append('your_contact', userProfile.email);
    }
    
    // Only add template_id if a specific template is selected (not AI generated)
    if (selectedTemplate && selectedTemplate !== 'ai_generated') {
      formData.append('template_id', selectedTemplate);
    }

    try {
      // Simulate upload progress (since we can't track actual upload progress with FormData)
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          const elapsed = (Date.now() - uploadStartTime) / 1000;
          const speed = prev.current / elapsed;
          const newCurrent = Math.min(prev.current + fileSize * 0.1, fileSize);
          
          if (newCurrent >= fileSize) {
            clearInterval(uploadInterval);
            return { ...prev, current: fileSize, speed, status: 'completed' };
          }
          
          return { ...prev, current: newCurrent, speed };
        });
      }, 100);

      const response = await emailService.generateEmails(formData);
      
      // Complete upload progress
      setUploadProgress(prev => ({ ...prev, status: 'completed' }));
      
      // Generation progress is now handled by WebSocket updates
      
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
      
      // Mark progress as error
      setUploadProgress(prev => ({ ...prev, status: 'error' }));
      setGenerationProgress(prev => ({ ...prev, status: 'error' }));
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
      await emailService.updateEmailStatus(emailId, { status: 'outreach_sent' });
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

  // Handle send all emails in a stage
  const handleSendAll = async (stage) => {
    if (!userProfile?.gmail_access_token) {
      setError('Gmail not connected. Please connect your Gmail account in Settings first.');
      return;
    }

    const stageEmails = stage === 'outreach' ? outreachEmails : 
                       stage === 'followup' ? followupEmails : 
                       lastChanceEmails;
    
    const unsentEmails = stageEmails.filter(email => 
      email.status === 'draft' || email.status === 'outreach_pending' || email.status === 'followup_due'
    );

    if (unsentEmails.length === 0) {
      setError(`No emails to send for ${stage} stage.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to send all ${unsentEmails.length} emails in the ${stage} stage? This will send them via Gmail and queue follow-up emails.`)) {
      return;
    }

    setLoading(true);
    setError('');

    // Sending progress is now handled by WebSocket updates

    try {
      const response = await emailService.sendAllViaGmail(stage);
      
      if (response.data.success) {
        setError(`Successfully sent ${response.data.sent_count} emails. ${response.data.failed_count > 0 ? `${response.data.failed_count} failed.` : ''}`);
        
        // Reload emails to reflect the changes
        await loadEmailsByStage();
        
        // Show success message
        setTimeout(() => setError(''), 5000);
      } else {
        throw new Error(response.data.message || 'Failed to send emails');
      }
    } catch (err) {
      console.error('Error sending all emails:', err);
      setError(
        err.response?.data?.detail || err.response?.data?.message || 
        'Failed to send emails. Please try again.'
      );
      
      // Mark progress as error
      setSendingProgress(prev => ({ ...prev, status: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="templates-page">
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
              
              {/* Template Reminder */}
              <Alert variant="info" className="mb-3">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Pro Tip:</strong> Before generating emails, make sure you have created templates for Initial Outreach, Follow-Up, and Last Chance stages. 
                This will ensure your emails are personalized and consistent. 
                <Button 
                  variant="link" 
                  className="p-0 ms-2" 
                  onClick={handleAddTemplate}
                  style={{ textDecoration: 'none' }}
                >
                  Create templates now →
                </Button>
              </Alert>
              
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
                  <Form.Label>Template Selection</Form.Label>
                  <div className="d-flex gap-2 align-items-start">
                    <div className="flex-grow-1">
                      <Form.Select
                        value={selectedTemplate}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                      >
                        {templates.length > 0 ? (
                          templates.map(template => (
                            <option key={template.id} value={template.id}>
                              {template.name} {template.is_default && '(Default)'}
                            </option>
                          ))
                        ) : (
                          <option value="ai_generated">AI Generated</option>
                        )}
                      </Form.Select>
                      {templates.length === 0 && (
                        <Form.Text className="text-muted">
                          No templates available for {emailStage === 'outreach' ? 'Initial Outreach' : 
                                                     emailStage === 'followup' ? 'Follow-Up' : 'Last Chance'}. 
                          Emails will be generated using AI.
                        </Form.Text>
                      )}
                    </div>
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={handleAddTemplate}
                      className="mt-0"
                    >
                      Add Template
                    </Button>
                  </div>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label={
                      <span>
                        Avoid duplicates
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            <Tooltip id="avoid-duplicates-tooltip">
                              <strong>Avoid Duplicates:</strong><br/>
                              When enabled, the system will check if you've already sent emails to these contacts and skip them. 
                              This prevents accidentally sending multiple emails to the same person.
                            </Tooltip>
                          }
                        >
                          <i className="bi bi-info-circle ms-2 text-muted" style={{ cursor: 'help' }}></i>
                        </OverlayTrigger>
                      </span>
                    }
                    checked={avoidDuplicates}
                    onChange={e => setAvoidDuplicates(e.target.checked)}
                    className="mb-3"
                  />
                </Form.Group>

                {error && <Alert variant="danger">{error}</Alert>}

                {/* Progress Trackers */}
                {uploadProgress.status !== 'idle' && (
                  <ProgressTracker {...uploadProgress} />
                )}
                
                {generationProgress.status !== 'idle' && (
                  <ProgressTracker {...generationProgress} />
                )}
                
                {sendingProgress.status !== 'idle' && (
                  <ProgressTracker {...sendingProgress} />
                )}

                <div className="d-grid mt-4">
                  <Button
                    variant="primary"
                    onClick={handleGenerateEmails}
                    disabled={loading || !file}
                  >
                    {loading ? 'Generating...' : 'Generate Emails'}
                  </Button>
                  
                  {/* Test button for WebSocket debugging */}
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    className="mt-2"
                    onClick={async () => {
                      console.log('Testing WebSocket connection...');
                      try {
                        // Test the simple WebSocket endpoint
                        const testResult = await WebSocketService.testConnection();
                        console.log('WebSocket test successful:', testResult);
                        alert('WebSocket connection test successful! Check console for details.');
                        
                        // Also test the progress WebSocket
                        WebSocketService.sendMessage({
                          type: 'test',
                          message: 'Testing WebSocket connection'
                        });
                        
                        // Simulate a progress update for testing
                        handleProgressUpdate({
                          type: 'generation_start',
                          total_contacts: 100,
                          current: 0
                        });
                      } catch (error) {
                        console.error('WebSocket test failed:', error);
                        alert(`WebSocket connection test failed: ${error.message}`);
                      }
                    }}
                  >
                    Test WebSocket Connection
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
                    <div>
                      <Button 
                        variant="success" 
                        size="sm"
                        className="me-2"
                        onClick={() => handleSendAll('outreach')}
                        disabled={loading || !userProfile?.gmail_access_token}
                        title={!userProfile?.gmail_access_token ? "Connect Gmail first" : "Send all outreach emails"}
                      >
                        {loading ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-1" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send-fill me-1"></i>
                            Send All
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => handleExportStage(outreachEmails, 'outreach')}
                      >
                        Export Outreach Emails
                      </Button>
                    </div>
                  </div>
                  <div className="email-list">
                    {[...outreachEmails]
                      .sort((a, b) => {
                        // First sort by status
                        const statusOrder = { 'outreach_sent': 0, 'draft': 1, 'sent by friend': 2 };
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
                    <div>
                      <Button 
                        variant="success" 
                        size="sm"
                        className="me-2"
                        onClick={() => handleSendAll('followup')}
                        disabled={loading || !userProfile?.gmail_access_token}
                        title={!userProfile?.gmail_access_token ? "Connect Gmail first" : "Send all follow-up emails"}
                      >
                        {loading ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-1" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send-fill me-1"></i>
                            Send All
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => handleExportStage(followupEmails, 'followup')}
                      >
                        Export Follow-Up Emails
                      </Button>
                    </div>
                  </div>
                  <div className="email-list">
                    {[...followupEmails]
                      .sort((a, b) => {
                        // First sort by status
                        const statusOrder = { 'outreach_sent': 0, 'draft': 1, 'sent by friend': 2 };
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
                    <div>
                      <Button 
                        variant="success" 
                        size="sm"
                        className="me-2"
                        onClick={() => handleSendAll('lastchance')}
                        disabled={loading || !userProfile?.gmail_access_token}
                        title={!userProfile?.gmail_access_token ? "Connect Gmail first" : "Send all last chance emails"}
                      >
                        {loading ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-1" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send-fill me-1"></i>
                            Send All
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => handleExportStage(lastChanceEmails, 'lastchance')}
                      >
                        Export Last Chance Emails
                      </Button>
                    </div>
                  </div>
                  <div className="email-list">
                    {[...lastChanceEmails]
                      .sort((a, b) => {
                        // First sort by status
                        const statusOrder = { 'outreach_sent': 0, 'draft': 1, 'sent by friend': 2 };
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
