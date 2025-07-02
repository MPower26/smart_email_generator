import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Tabs, Tab, Badge, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import FileUpload from '../components/FileUpload';
import EmailPreview from '../components/EmailPreview';
import ProgressTracker from '../components/ProgressTracker';
import GroupedEmails from '../components/GroupedEmails';
import { emailService, templateService } from '../services/api';
import { UserContext } from '../contexts/UserContext';
import '../styles/GroupedEmails.css';
import websocketService from '../services/websocket';

const PreRequisiteError = ({ error, onClear }) => {
    if (!error) return null;

    const hasProfileError = error.includes("profile");
    const hasTemplateError = error.includes("template");

    return (
        <Alert variant="warning" onClose={onClear} dismissible className="mt-3">
            <Alert.Heading>Action Required</Alert.Heading>
            <p>{error}</p>
            <hr />
            <div className="d-flex justify-content-end">
                {hasProfileError && (
                    <Button as="a" href="/settings" variant="outline-primary" className="me-2">
                        Go to Settings
                    </Button>
                )}
                {hasTemplateError && (
                    <Button as="a" href="/templates" variant="outline-primary">
                        Go to Templates
                    </Button>
                )}
            </div>
        </Alert>
    );
};

const GenerateEmailsPage = () => {
  const { userProfile } = useContext(UserContext);
  const [file, setFile] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preRequisiteError, setPreRequisiteError] = useState('');
  const [activeTab, setActiveTab] = useState('generation');
  const [emailStage, setEmailStage] = useState('outreach');
  const [isSending, setIsSending] = useState(false);
  const [paused, setPaused] = useState(false);
  
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
  
  const [sendingProgress, setSendingProgress] = useState({
    type: 'sending',
    current: 0,
    total: 0,
    startTime: null,
    speed: 0,
    status: 'idle'
  });

  const [generationProgress, setGenerationProgress] = useState(null);
  const [currentProgressId, setCurrentProgressId] = useState(null);

  // Polling for progress updates
  const pollingIntervalRef = useRef(null);
  const pollingRetryCountRef = useRef(0);
  const maxRetries = 5;

  const [generationStartTime, setGenerationStartTime] = useState(null);

  const hasStartedReceivingProgressRef = useRef(false);

  const [warmingUp, setWarmingUp] = useState(false);
  const [warmingUpTimer, setWarmingUpTimer] = useState(15);
  const warmingUpIntervalRef = useRef(null);
  const progressSectionRef = useRef(null);

  // Load emails by stage - moved before functions that reference it
  const loadEmailsByStage = async () => {
    setLoadingEmails(true);
    try {
      if (!userProfile?.email) {
        setError('You must be logged in to view emails');
        setLoadingEmails(false);
        return;
      }
      
      // Fetch all stages in parallel for better performance
      const [outreachRes, followupRes, lastChanceRes] = await Promise.all([
        emailService.getEmailsByStage('outreach'),
        emailService.getEmailsByStage('followup'),
        emailService.getEmailsByStage('lastchance')
      ]);

      // Process outreach emails
      const outreachData = outreachRes.data || [];
      setOutreachEmails(outreachData.filter(email => email.status !== 'outreach_sent'));
        
      // Process followup emails
      const followupData = followupRes.data || [];
      // Filter out emails that have been sent and now belong in the last chance stage
      const followupSentEmails = followupData.filter(email => email.status === 'followup_sent');
      setFollowupEmails(followupData.filter(email => email.status !== 'followup_sent'));

      // Process last chance emails
      const lastChanceData = lastChanceRes.data || [];
      // Combine existing last chance emails with the ones that just moved from followup
      const combinedLastChanceEmails = [...lastChanceData, ...followupSentEmails];
      setLastChanceEmails(combinedLastChanceEmails);
      
    } catch (err) {
      console.error('General error loading emails:', err);
      setError('Failed to load emails. Please try again.');
    } finally {
      setLoadingEmails(false);
    }
  };

  // Define functions before useMemo hooks to avoid hoisting issues
  const handleMarkAsSent = async (emailId) => {
    setError(null); // Clear previous errors
    try {
      await emailService.sendEmail(emailId);
      setLastAction({ id: emailId, type: 'sent' }); // <-- Set action type to 'sent'
      // Reload emails for all stages to see the new follow-up
      loadEmailsByStage();
    } catch (err) {
      console.error('Error marking email as sent:', err);
      setError('Failed to send email and generate next stage.');
      setLastAction({ id: null, type: null }); // Clear highlight on error
    }
  };

  // Unmark an email as sent (sets status back to draft)
  const handleUnmarkAsSent = async (emailId) => {
    setError(null); // Clear previous errors
    try {
      // This still uses the status endpoint, which is now correctly limited
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
    const templateUrl = process.env.REACT_APP_FRONTEND_TEMPLATE_URL || 'https://jolly-bush-0bae83703.6.azurestaticapps.net/templates';
    window.open(templateUrl, '_blank');
  };

  const pollProgress = async (progressId) => {
    try {
      if (!progressId) {
        console.warn("pollProgress called without a progressId.");
        return;
      }
      const response = await emailService.getGenerationProgressById(progressId);
      const progress = response.data;

      // Reset retry count on successful request
      pollingRetryCountRef.current = 0;

      // Calculate elapsed, speed, and ETA
      let elapsed = 0;
      let speed = 0;
      let eta = 0;
      if (generationStartTime && progress.generated_emails > 0) {
        elapsed = (Date.now() - generationStartTime) / 1000;
        speed = progress.generated_emails / Math.max(1, elapsed);
        eta = (progress.total_contacts - progress.generated_emails) / Math.max(0.1, speed);
      }

      // Only stop polling when status is completed AND all emails are generated
      if (progress.status === 'processing' || (progress.status === 'completed' && progress.generated_emails < progress.total_contacts)) {
        setGenerationProgress({
          type: 'generation',
          current: progress.generated_emails,
          total: progress.total_contacts,
          startTime: generationStartTime,
          speed,
          eta,
          status: progress.status
        });
        // Do not stop polling
      } else if (progress.status === 'completed' && progress.generated_emails >= progress.total_contacts) {
        setGenerationProgress(prev => ({ ...prev, current: prev.total, status: 'completed', speed, eta }));
        stopProgressPolling();
        setTimeout(() => {
          setIsGenerating(false);
          loadEmailsByStage();
          setActiveTab('outreach');
        }, 1500);
      } else if (progress.status === 'error' || (progress.status === 'idle' && isGenerating)) {
        setGenerationProgress(prev => ({ ...prev, status: 'error' }));
        setError(`Email generation failed: ${progress.error_message || 'Unknown error'}`);
        stopProgressPolling();
        setTimeout(() => setIsGenerating(false), 5000);
      } else if (progress.status === 'not_found') {
        // This is okay on the first 1-2 polls, just means the backend is setting up.
        console.log("Progress record not found yet, will retry...");
      }

      // Force refresh when first valid progress arrives
      if (progress.generated_emails > 0 && !hasStartedReceivingProgressRef.current) {
        hasStartedReceivingProgressRef.current = true;
        loadEmailsByStage(); // Soft refresh
      }
    } catch (error) {
      console.error("Progress polling error:", error);
      
      // Handle network errors with exponential backoff
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.code === 'ECONNABORTED') {
        pollingRetryCountRef.current += 1;
        
        if (pollingRetryCountRef.current <= maxRetries) {
          // Calculate exponential backoff delay (2^retry * 1000ms, max 30 seconds)
          const delay = Math.min(Math.pow(2, pollingRetryCountRef.current) * 1000, 30000);
          console.log(`Network error, retrying in ${delay}ms (attempt ${pollingRetryCountRef.current}/${maxRetries})`);
          
          // Update progress to show retry status
          setGenerationProgress(prev => ({
            ...prev,
            status: 'retrying',
            retryCount: pollingRetryCountRef.current,
            retryDelay: delay
          }));
          
          // Schedule retry
          setTimeout(() => pollProgress(progressId), delay);
          return;
        } else {
          // Max retries exceeded
          console.error("Max retries exceeded for progress polling");
          setError("Progress tracking error: Network connection lost. Email generation may still be running in the background.");
          stopProgressPolling();
          setIsGenerating(false);
        }
      } else {
        // Non-network error
        setError("Progress tracking error: " + (error.response?.data?.detail || error.message || 'Unknown error'));
        stopProgressPolling();
        setIsGenerating(false);
      }
    }
  };
  
  const startProgressPolling = (progressId) => {
    if (!progressId) return; // Guard: do not start polling without a valid progressId
    stopProgressPolling(); 
    pollingRetryCountRef.current = 0; // Reset retry count
    const poller = () => pollProgress(progressId);
    poller(); // Poll immediately once
    pollingIntervalRef.current = setInterval(poller, 2000); // Then poll every 2 seconds
  };
  
  const stopProgressPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('Progress polling stopped.');
    }
  };

  useEffect(() => {
    // This effect runs when the component unmounts
    return () => {
      stopProgressPolling();
    };
  }, []); // Empty array ensures this runs only once on mount and cleanup on unmount

  // Load data when component mounts or user profile changes
  useEffect(() => {
    // Check for ongoing generation when the page loads
    const checkInitialProgress = async () => {
      // Skip initial progress check if disabled via environment variable
      if (process.env.REACT_APP_DISABLE_INITIAL_PROGRESS_CHECK === 'true') {
        console.log("Initial progress check disabled via environment variable");
        return;
      }

      try {
        console.log("Checking for ongoing email generation...");
        const response = await emailService.getGenerationProgress();
        if (response.data?.status === 'processing' && response.data?.progress_id) {
          console.log("Found ongoing generation, starting progress tracking...");
          setIsGenerating(true);
          setCurrentProgressId(response.data.progress_id);
          startProgressPolling(response.data.progress_id);
        } else {
          console.log("No ongoing generation found");
        }
      } catch (error) {
        console.error("Failed to check initial progress", error);
        // Don't show error to user for initial check - it's not critical
        // Just log it and continue with normal page loading
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          console.log("Initial progress check timed out - this is normal for slow connections");
        }
      }
    };

    loadTemplates();
    loadEmailsByStage();
    
    // Run initial progress check with a small delay to avoid blocking page load
    setTimeout(checkInitialProgress, 1000);
  }, [userProfile]);

  // Debug user profile
  useEffect(() => {
    console.log('Current user profile:', userProfile);
    // Check localStorage for debugging
    const storedProfile = localStorage.getItem('userProfile');
    console.log('Profile in localStorage:', storedProfile ? JSON.parse(storedProfile) : null);
  }, [userProfile]);

  // Warming up effect
  useEffect(() => {
    if (warmingUp) {
      setWarmingUpTimer(15);
      warmingUpIntervalRef.current = setInterval(() => {
        setWarmingUpTimer(prev => {
          if (prev <= 1) {
            clearInterval(warmingUpIntervalRef.current);
            // After timer, refresh and scroll to progress
            window.location.reload();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (warmingUpIntervalRef.current) clearInterval(warmingUpIntervalRef.current);
    }
    return () => {
      if (warmingUpIntervalRef.current) clearInterval(warmingUpIntervalRef.current);
    };
  }, [warmingUp]);

  // Scroll to progress section after reload
  useEffect(() => {
    if (window.location.hash === '#progress-section' && progressSectionRef.current) {
      progressSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Generate emails
  const handleGenerateEmails = async () => {
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }
    setLoading(true);
    setError('');
    setPreRequisiteError('');
    setIsGenerating(true);
    setWarmingUp(true); // Start warming up
    // Reset progress trackers
    setUploadProgress(prev => ({ ...prev, status: 'processing', current: 0, total: file.size, startTime: Date.now() }));
    setGenerationProgress(prev => ({ ...prev, status: 'processing', current: 0, total: 0 }));
    setSendingProgress(prev => ({ ...prev, status: 'idle', current: 0, total: 0 }));
    setGenerationStartTime(Date.now());
    try {
      const response = await emailService.generateEmails(
        file,
        selectedTemplate,
        emailStage,
        avoidDuplicates,
        (event) => {
          setUploadProgress(prev => ({
            ...prev,
            current: event.loaded,
            total: event.total,
            speed: prev.startTime ? (event.loaded / ((Date.now() - prev.startTime) / 1000)) : 0
          }));
        }
      );
      setUploadProgress(prev => ({ ...prev, status: 'completed', current: prev.total }));
      setGenerationProgress({
        type: 'generation',
        current: 0,
        total: response.data.total_contacts,
        startTime: Date.now(),
        status: 'starting'
      });
      setIsGenerating(true);
      setCurrentProgressId(response.data.progress_id);
      // Instead of starting polling, let the warming up timer handle the refresh
      // window.location.hash = '#progress-section';
    } catch (err) {
      if (err.response && err.response.status === 412) {
        setPreRequisiteError(err.response.data.detail);
        setIsGenerating(false);
      } else {
        const errorMessage = err.response?.data?.detail || 'An unexpected error occurred during email generation.';
        setError(errorMessage);
        console.error('Email generation failed:', err);
      }
      setUploadProgress(prev => ({ ...prev, status: 'error' }));
      setGenerationProgress(prev => ({ ...prev, status: 'error' }));
      setIsGenerating(false);
      setWarmingUp(false);
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
  
  // Handle send all emails in a stage
  const handleSendAll = async () => {
    setError('');
    setIsSending(true);
    setPaused(false);
    setSendingProgress(prev => ({ ...prev, status: 'sending', current: 0, total: 0 }));

    // Determine which emails to send based on stage
    let emailsToSend = [];
    if (emailStage === 'outreach') emailsToSend = outreachEmails;
    else if (emailStage === 'followup') emailsToSend = followupEmails;
    else if (emailStage === 'lastchance') emailsToSend = lastChanceEmails;
    const totalToSend = emailsToSend.length;
    const batchLimit = emailStage === 'outreach' ? 1 : totalToSend;

    setSendingProgress(prev => ({ ...prev, status: 'sending', current: 0, total: totalToSend }));

    let sent = 0;
    while (sent < totalToSend) {
      if (paused) break;
      const sendCount = Math.min(batchLimit, totalToSend - sent);
      try {
        const res = await emailService.sendBatch(emailStage, sendCount);
        sent += res.data.sent;
        setSendingProgress(prev => ({ ...prev, current: sent, total: totalToSend }));
        await loadEmailsByStage();
        if (res.data.sent === 0) break; // No more to send
        if (batchLimit === totalToSend) break; // For followup/lastchance, send all at once
      } catch (err) {
        setError('An error occurred while sending emails.');
        setSendingProgress(prev => ({ ...prev, status: 'error' }));
        break;
      }
    }
    setIsSending(false);
    if (!paused) setSendingProgress(prev => ({ ...prev, status: 'complete' }));
  };

  const handlePause = () => {
    setPaused(true);
  };

  const handleResume = async () => {
    setPaused(false);
    setIsSending(true);
    await handleSendAll();
  };

  const [isGenerating, setIsGenerating] = useState(false);

  // Memoize the sorted and mapped email components to prevent re-sorting on every render
  const outreachEmailComponents = useMemo(() => 
    [...outreachEmails]
      .sort((a, b) => {
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
      )), 
    [outreachEmails, activeTab, lastAction]
  );

  const followupEmailComponents = useMemo(() =>
    [...followupEmails]
      .sort((a, b) => {
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
      )),
    [followupEmails, activeTab, lastAction]
  );

  const lastChanceEmailComponents = useMemo(() =>
    [...lastChanceEmails]
      .sort((a, b) => {
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
      )),
    [lastChanceEmails, activeTab, lastAction]
  );

  useEffect(() => {
    websocketService.onProgress((data) => {
      if (data.type === 'sending_error') {
      setError(
          data.error?.includes('Gmail token')
            ? (
              <span>
                Your Gmail connection has expired. Please <a href="/settings">reconnect your account</a> to send emails.
              </span>
            )
            : data.error
        );
      }
      // ... handle other types as needed ...
    });
    // Cleanup on unmount
    return () => websocketService.onProgress(null);
  }, []);

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

                <PreRequisiteError error={preRequisiteError} onClear={() => setPreRequisiteError('')} />
                {error && <Alert variant="danger">{error}</Alert>}

                {/* Progress Trackers */}
                {warmingUp ? (
                  <div className="warming-up-container text-center my-4">
                    <div className="warming-up-effect">
                      <h3>🤖 AI is warming up, hang on a sec...</h3>
                      <div className="warming-up-timer" style={{ fontSize: '2rem', margin: '1rem 0' }}>{warmingUpTimer}s</div>
                      <div className="warming-up-bar" style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden', margin: '0 auto', maxWidth: '400px' }}>
                        <div style={{ width: `${(15-warmingUpTimer)/15*100}%`, height: '100%', background: 'linear-gradient(90deg, #D8400D, #ffb347)', transition: 'width 1s' }}></div>
                      </div>
                      <div style={{ marginTop: '1rem', color: '#888' }}>
                        <em>Preparing your personalized emails...</em>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {uploadProgress.status !== 'idle' && (
                      <ProgressTracker {...uploadProgress} />
                    )}
                    {generationProgress && (
                      <ProgressTracker {...generationProgress} />
                    )}
                    {sendingProgress.status !== 'idle' && (
                      <ProgressTracker {...sendingProgress} />
                    )}
                  </>
                )}

                <div className="d-grid mt-4">
                  <Button
                    variant="primary"
                    onClick={handleGenerateEmails}
                    disabled={isGenerating || loading || !file}
                  >
                    {isGenerating ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Generating...
                      </>
                    ) : (
                      'Generate Emails'
                    )}
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
                        onClick={handleSendAll}
                        disabled={isSending || !userProfile?.gmail_access_token}
                        title={!userProfile?.gmail_access_token ? "Connect Gmail first" : "Send all outreach emails"}
                      >
                        {isSending ? (
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
                    {outreachEmailComponents}
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
                <GroupedEmails stage="followup" />
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
                <GroupedEmails stage="lastchance" />
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
      {activeTab !== 'generation' && (
        <div className="mb-3">
          <Button onClick={handleSendAll} disabled={isSending || (sendingProgress.status === 'sending')} variant="primary">Send All</Button>{' '}
          <Button onClick={handlePause} disabled={!isSending || paused} variant="warning">Pause</Button>{' '}
          <Button onClick={handleResume} disabled={!paused} variant="success">Resume</Button>
          <div style={{ margin: '10px 0', maxWidth: 400 }}>
            <ProgressTracker
              type="sending"
              current={sendingProgress.current}
              total={sendingProgress.total}
              status={sendingProgress.status}
            />
          </div>
        </div>
      )}
      {/* Progress Section Anchor */}
      <div ref={progressSectionRef} id="progress-section"></div>
    </Container>
  );
};

export default GenerateEmailsPage; 
