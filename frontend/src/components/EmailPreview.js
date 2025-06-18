import React, { useState, useEffect, useContext } from 'react';
import { Card, Button, Badge, Collapse, Alert, Spinner } from 'react-bootstrap';
import { UserContext } from '../contexts/UserContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net';

const EmailPreview = ({ email, onSend, onUnmarkSent, onDelete, isCollapsed = false, isSentHighlight = false, isUnmarkedHighlight = false }) => {
  const { userProfile } = useContext(UserContext);
  const [copied, setCopied] = useState(false);
  const [showBody, setShowBody] = useState(!isCollapsed);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // This effect will collapse emails when tab changes
  useEffect(() => {
    if (isCollapsed) {
      setShowBody(false);
    }
  }, [isCollapsed]);

  // Reset copy status after 2 seconds
  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        handleCopy();
      }).catch(err => {
        console.error('Failed to copy: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        handleCopy();
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      handleCopy();
    }
  };

  // Toggle body visibility
  const toggleBody = (e) => {
    e.stopPropagation();
    setShowBody(!showBody);
  };

  // Handler for marking email as sent
  const handleMarkSent = async (e, id) => {
    e.stopPropagation();
    setError(null);
    
    if (typeof onSend === 'function') {
      try {
        await onSend(id);
      } catch (error) {
        console.error('Error marking as sent:', error);
        setError(error.message || 'Failed to mark as sent.');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  // Handler for unmarking email as sent
  const handleUnmarkSent = async (e, id) => {
    e.stopPropagation();
    setError(null);
    
    if (typeof onUnmarkSent === 'function') {
      try {
        await onUnmarkSent(id);
      } catch (error) {
        console.error('Error unmarking as sent:', error);
        setError(error.message || 'Failed to unmark as sent.');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  // Handler for sending via Gmail
  const handleSendViaGmail = async (e) => {
    e.stopPropagation();
    setError(null);
    
    if (!userProfile?.gmail_access_token) {
      setError('Gmail not connected. Please connect your Gmail account in Settings first.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/emails/send_via_gmail?email_id=${email.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userProfile.email}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Email sent via Gmail:', result);
        
        // Mark as sent in the app
        if (typeof onSend === 'function') {
          await onSend(email.id);
        }
        
        setError(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send email via Gmail');
      }
    } catch (error) {
      console.error('Error sending via Gmail:', error);
      setError(error.message || 'Failed to send email via Gmail. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSending(false);
    }
  };

  // Handler for opening mail client (fallback)
  const handleOpenMailClient = async (e) => {
    e.stopPropagation();
    setError(null);
    
    try {
      // First mark as sent in the app
      if (typeof onSend === 'function') {
        await onSend(email.id);
      }
      
      // Then create mailto link
      const recipient = email.recipient_email || email.to || '';
      const subject = encodeURIComponent(email.subject || '');
      const body = encodeURIComponent(email.body || email.content || '');
      
      const mailtoLink = `mailto:${recipient}?subject=${subject}&body=${body}`;
      
      if (mailtoLink.length > 10000) {
          setError('Email content too long for mailto link. Marked as sent, but client might not open.');
          setTimeout(() => setError(null), 5000);
          return; 
      }

      // Try opening the client
      window.location.href = mailtoLink;
      
    } catch (err) {
      console.error('Error in handleOpenMailClient:', err);
      if (!error) {
        setError('Operation failed (check console).');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  // Handler for deleting the email
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    setError(null);
    
    console.log(`[EmailPreview ID: ${id}] handleDelete called. Checking onDelete prop.`);
    console.log(`[EmailPreview ID: ${id}] typeof onDelete:`, typeof onDelete);

    // Confirmation dialog
    if (window.confirm('Are you sure you want to permanently delete this email?')) {
      // Check if onDelete is actually a function before calling
      if (typeof onDelete === 'function') {
          setIsDeleting(true);
          try {
            console.log(`[EmailPreview ID: ${id}] Calling onDelete...`);
            await onDelete(id); // Call the parent handler
            console.log(`[EmailPreview ID: ${id}] onDelete call finished.`);
            // Parent should reload the list, no further action needed here
          } catch (error) { 
            console.error(`[EmailPreview ID: ${id}] Error during onDelete call:`, error);
            setError(error.message || 'Failed to delete email.');
          } finally {
            setIsDeleting(false);
          }
      } else {
          console.error(`[EmailPreview ID: ${id}] onDelete is not a function! Prop received:`, onDelete);
          setError('Delete function is not available. Cannot proceed.');
      }
    } else {
        console.log(`[EmailPreview ID: ${id}] Delete cancelled by user.`);
    }
  };

  // Gmail connect logic (moved from SettingsPage.js)
  const handleConnectGmail = async (e) => {
    if (e) e.stopPropagation();
    setIsConnecting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/gmail/auth/start?email=${encodeURIComponent(userProfile.email)}`);
      const data = await res.json();
      window.open(data.auth_url, "_blank", "width=500,height=600");
      setError('Please complete Gmail authentication in the new window, then refresh this page.');
    } catch (error) {
      setError('Failed to start Gmail authentication.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Determine highlight classes based on props
  const getHighlightClasses = () => {
    if (isSentHighlight) {
      return 'border border-info border-2'; // Blue border for sent
    } else if (isUnmarkedHighlight) {
      return 'border border-warning border-2'; // Yellow border for unmarked
    } else {
      return ''; // No border highlight
    }
  };
  
  const getHeaderHighlightClass = () => {
     if (isSentHighlight) {
      return 'bg-info-subtle'; // Light blue background for sent
    } else if (isUnmarkedHighlight) {
      return 'bg-warning-subtle'; // Light yellow background for unmarked
    } else {
      return ''; // No background highlight
    }
  };

  return (
    <Card className={error ? 'border-danger mb-3' : `mb-3 ${getHighlightClasses()}`}>
      {error && (
        <Alert variant="danger" className="m-2 p-2" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}
      <Card.Header 
        onClick={toggleBody} 
        style={{ cursor: 'pointer' }}
        className={`d-flex justify-content-between align-items-center ${showBody ? 'bg-light border-bottom-0' : ''} ${getHeaderHighlightClass()}`}
      >
        <div className="d-flex align-items-center">
          <div>
            <strong className="text-primary">To: </strong> 
            <span className="fw-semibold">{email.to || 'No recipient'}</span>
            {email.status && (
              <Badge bg={email.status === 'sent by friend' ? 'info' : email.status === 'sent' ? 'success' : 'secondary'} className="ms-2">
                {email.status}
              </Badge>
            )}
          </div>
          <div className="ms-3 text-muted small">
            <Badge bg="light" text="dark" pill>
              {showBody ? 'Click to collapse' : 'Click to expand'}
            </Badge>
          </div>
        </div>
        <div className={`text-${showBody ? 'primary' : 'secondary'}`}>
          <i className={`bi ${showBody ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
        </div>
      </Card.Header>
      
      <Collapse in={showBody}>
        <div>
          <Card.Body className="bg-white">
            <div className="email-subject mb-3">
              <strong className="text-primary">Subject: </strong>
              <span className="fw-semibold">{email.subject}</span>
            </div>
            
            <div className="email-body p-3 border rounded mb-3">
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, color: '#212529' }}>
                {email.body}
              </pre>
            </div>
            
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div>
                <Button 
                  variant="outline-danger" 
                  size="sm"
                  className="p-1"
                  onClick={(e) => handleDelete(e, email.id)}
                  disabled={isDeleting}
                  title="Delete Email"
                >
                  {isDeleting ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    <i className="bi bi-trash-fill"></i>
                  )}
                </Button>
              </div>

              <div>
                <Button 
                  variant="outline-secondary"
                  size="sm" 
                  className="me-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(email.body);
                  }}
                  title="Copy Email Body"
                >
                  {copied ? 'Copied!' : 'Copy Body'}
                </Button>

                {/* Always show Send via Gmail button */}
                <Button 
                  variant="primary" 
                  size="sm"
                  className="me-2"
                  onClick={userProfile?.gmail_access_token ? handleSendViaGmail : handleConnectGmail}
                  disabled={isSending || isConnecting}
                  title={userProfile?.gmail_access_token ? "Send via Gmail API" : "Connect Gmail"}
                >
                  {isSending ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-1" />
                      Sending...
                    </>
                  ) : isConnecting ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-1" />
                      Connecting...
                    </>
                  ) : (
                    'Send via Gmail'
                  )}
                </Button>

                {email.status === 'outreach_sent' ? (
                  <Button 
                    variant="warning" 
                    size="sm"
                    onClick={(e) => handleUnmarkSent(e, email.id)}
                    title="Mark as Draft"
                  >
                    Unmark as Sent
                  </Button>
                ) : (
                  <Button 
                    variant="success" 
                    size="sm"
                    onClick={(e) => handleMarkSent(e, email.id)}
                    title="Mark as Sent in App"
                  >
                    Mark as Sent
                  </Button>
                )}
              </div>
            </div>
          </Card.Body>
        </div>
      </Collapse>
    </Card>
  );
};

export default EmailPreview; 
