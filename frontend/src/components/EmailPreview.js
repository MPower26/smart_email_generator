import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Collapse, Alert } from 'react-bootstrap';

const EmailPreview = ({ email, onSend, onUnmarkSent, onDelete, isCollapsed = false, isSentHighlight = false, isUnmarkedHighlight = false }) => {
  const [copied, setCopied] = useState(false);
  const [showBody, setShowBody] = useState(false); // Always start collapsed
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    try {
      navigator.clipboard.writeText(text);
      handleCopy();
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      setError('Failed to copy to clipboard. Try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Toggle body visibility
  const toggleBody = (e) => {
    e.stopPropagation();
    setShowBody(!showBody);
  };

  // Safe handler for marking as sent
  const handleMarkSent = (e, id) => {
    e.stopPropagation();
    try {
      onSend(id);
    } catch (error) {
      console.error('Error marking email as sent:', error);
      setError('Failed to mark email as sent. Try again.');
      setTimeout(() => setError(null), 3000);
    }
  };
  
  // Handler for unmarking as sent
  const handleUnmarkSent = (e, id) => {
    e.stopPropagation();
    setError(null); // Clear previous errors
    try {
      onUnmarkSent(id);
    } catch (error) {
      console.error('Error unmarking email:', error);
      setError('Failed to unmark email.');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Handler to open default email client AND mark as sent
  const handleOpenMailClient = (e) => {
    e.stopPropagation();
    setError(null); // Clear error first
    
    try {
      // Mark as sent FIRST to ensure the API call is initiated
      handleMarkSent(e, email.id);

      // Now, try to open the mail client
      const subject = encodeURIComponent(email.subject || '');
      const body = encodeURIComponent(email.body || '');
      const recipient = encodeURIComponent(email.to || '');
      
      if (!recipient) {
        // We still might want to show an error, even if marked as sent
        setError('No recipient email address found for mailto link.');
        setTimeout(() => setError(null), 3000);
        return; // Stop before trying mailto
      }
      
      const mailtoLink = `mailto:${recipient}?subject=${subject}&body=${body}`;
      
      if (mailtoLink.length > 2000) {
          setError('Email content too long for mailto link. Marked as sent, but client might not open.');
          setTimeout(() => setError(null), 5000);
          // Decide if you still want to try opening
          // window.location.href = mailtoLink;
          return; 
      }

      // Try opening the client
      window.location.href = mailtoLink;
      
    } catch (err) {
      // Error could be from handleMarkSent OR mailto link creation
      console.error('Error in handleOpenMailClient:', err);
      // If handleMarkSent failed, its internal error state might already be set
      // Add a general fallback error if not already set by handleMarkSent
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
              <Badge bg={email.status === 'sent' ? 'success' : 'secondary'} className="ms-2">
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

                {email.status === 'sent' ? (
                  <Button 
                    variant="warning" 
                    size="sm"
                    onClick={(e) => handleUnmarkSent(e, email.id)}
                    title="Mark as Draft"
                  >
                    Unmark as Sent
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="primary" 
                      size="sm"
                      className="me-2"
                      onClick={handleOpenMailClient} 
                      title="Open in default email client"
                    >
                      Send via Email Client
                    </Button>
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={(e) => handleMarkSent(e, email.id)}
                      title="Mark as Sent in App"
                    >
                      Mark as Sent
                    </Button>
                  </>
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