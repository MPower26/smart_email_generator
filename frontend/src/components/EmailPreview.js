import React, { useState, useEffect, useContext } from 'react';
import { Card, Button, Badge, Collapse, Alert, Spinner, Form, Modal } from 'react-bootstrap';
import { UserContext } from '../contexts/UserContext';
import { emailService } from '../services/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net';

// Countdown Timer Component
const CountdownTimer = ({ dueDate }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const due = new Date(dueDate).getTime();
      const difference = due - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
        setIsOverdue(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsOverdue(true);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [dueDate]);

  if (isOverdue) {
    return (
      <Badge bg="danger" text="white" className="ms-2">
        <i className="bi bi-exclamation-triangle me-1"></i>
        Overdue!
      </Badge>
    );
  }

  return (
    <Badge bg="warning" text="dark" className="ms-2">
      <i className="bi bi-clock me-1"></i>
      {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
    </Badge>
  );
};

const EmailPreview = ({ email, onSend, onUnmarkSent, onDelete, isCollapsed = false, isSentHighlight = false, isUnmarkedHighlight = false }) => {
  const { userProfile, fetchUserProfile } = useContext(UserContext);
  const [copied, setCopied] = useState(false);
  const [showBody, setShowBody] = useState(!isCollapsed);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedSubject, setEditedSubject] = useState(email.subject || '');
  const [editedContent, setEditedContent] = useState(email.body || email.content || '');
  const [showEditModal, setShowEditModal] = useState(false);

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
      
      // Start polling for Gmail connection status
      const checkConnection = setInterval(async () => {
        try {
          await fetchUserProfile(); // Refresh user profile
          if (userProfile?.gmail_access_token) {
            clearInterval(checkConnection);
            setIsConnecting(false);
            setError(null);
          }
        } catch (err) {
          console.error('Error checking Gmail connection:', err);
        }
      }, 2000);
      
      // Stop checking after 5 minutes
      setTimeout(() => {
        clearInterval(checkConnection);
        setIsConnecting(false);
      }, 300000);
      
      setError('Please complete Gmail authentication in the new window. The page will update automatically when connected.');
    } catch (error) {
      setError('Failed to start Gmail authentication.');
      setIsConnecting(false);
    }
  };

  // Handler for opening edit modal
  const handleEdit = (e) => {
    e.stopPropagation();
    setEditedSubject(email.subject || '');
    setEditedContent(email.body || email.content || '');
    setShowEditModal(true);
  };

  // Handler for saving edited email
  const handleSaveEdit = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      await emailService.updateEmailContent(email.id, {
        subject: editedSubject,
        content: editedContent
      });
      
      // Update local email object
      email.subject = editedSubject;
      email.content = editedContent;
      email.body = editedContent;
      
      setShowEditModal(false);
      setError(null);
    } catch (error) {
      console.error('Error saving email:', error);
      setError(error.message || 'Failed to save email changes.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for canceling edit
  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditedSubject(email.subject || '');
    setEditedContent(email.body || email.content || '');
    setError(null);
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
              <Badge bg={email.status === 'sent by friend' ? 'info' : email.status === 'outreach_sent' ? 'success' : email.status === 'followup_due' ? 'warning' : 'secondary'} className="ms-2">
                {email.status}
              </Badge>
            )}
            {email.followup_due_at && (
              <CountdownTimer dueDate={email.followup_due_at} />
            )}
            {userProfile?.gmail_access_token && (
              <Badge bg="success" className="ms-2">
                <i className="bi bi-envelope-check me-1"></i>
                Gmail Ready
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
            
            {userProfile?.gmail_access_token && (
              <Alert variant="info" className="py-2 mb-3">
                <i className="bi bi-info-circle me-2"></i>
                <small>Gmail is connected! Click "Send via Gmail" to send this email directly from your Gmail account.</small>
              </Alert>
            )}
            
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

                <Button 
                  variant="outline-info"
                  size="sm" 
                  className="me-2"
                  onClick={handleEdit}
                  title="Edit Email"
                >
                  <i className="bi bi-pencil-fill"></i> Edit
                </Button>

                {/* Primary action: Gmail if connected, Connect Gmail if not */}
                {userProfile?.gmail_access_token ? (
                  <Button 
                    variant="primary" 
                    size="sm"
                    className="me-2"
                    onClick={handleSendViaGmail}
                    disabled={isSending}
                    title="Send via Gmail API"
                  >
                    {isSending ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-1" />
                        Sending...
                      </>
                    ) : (
                      'Send via Gmail'
                    )}
                  </Button>
                ) : (
                  <Button 
                    variant="primary" 
                    size="sm"
                    className="me-2"
                    onClick={handleConnectGmail}
                    disabled={isConnecting}
                    title="Connect Gmail to send emails"
                  >
                    {isConnecting ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-1" />
                        Connecting...
                      </>
                    ) : (
                      'Connect Gmail'
                    )}
                  </Button>
                )}

                {/* Secondary action: Mark as Sent/Unmark */}
                {email.status === 'outreach_sent' ? (
                  <Button 
                    variant="outline-warning" 
                    size="sm"
                    onClick={(e) => handleUnmarkSent(e, email.id)}
                    title="Mark as Draft"
                  >
                    Unmark as Sent
                  </Button>
                ) : (
                  <Button 
                    variant="outline-success" 
                    size="sm"
                    onClick={(e) => handleMarkSent(e, email.id)}
                    title="Mark as Sent in App (manual tracking)"
                  >
                    Mark as Sent
                  </Button>
                )}
              </div>
            </div>
          </Card.Body>
        </div>
      </Collapse>

      {/* Edit Email Modal */}
      <Modal show={showEditModal} onHide={handleCancelEdit} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Email</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Subject</Form.Label>
              <Form.Control
                type="text"
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
                placeholder="Email subject"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Content</Form.Label>
              <Form.Control
                as="textarea"
                rows={15}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder="Email content"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancelEdit}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveEdit}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Spinner animation="border" size="sm" className="me-1" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default EmailPreview; 
