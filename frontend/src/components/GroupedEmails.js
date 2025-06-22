import React, { useState, useEffect } from 'react';
import { emailService } from '../services/api.js';
import { Card, Button, Badge, Collapse, Alert, Spinner, Form, Modal } from 'react-bootstrap';

// This new component will handle the display and actions for a single email
const EmailRow = ({ email, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedSubject, setEditedSubject] = useState(email.subject);
  const [editedContent, setEditedContent] = useState(email.body);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleToggleExpand = () => setIsExpanded(!isExpanded);
  const handleShowEditModal = () => setShowEditModal(true);
  const handleCloseEditModal = () => setShowEditModal(false);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await emailService.updateEmailContent(email.id, {
        subject: editedSubject,
        body: editedContent,
      });
      onUpdate(); // This will trigger a reload of the groups
      handleCloseEditModal();
    } catch (error) {
      console.error('Failed to save changes:', error);
      // You could show an error message to the user here
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this email permanently?')) {
      setIsDeleting(true);
      try {
        await emailService.deleteEmail(email.id);
        onUpdate();
      } catch (error) {
        console.error('Failed to delete email:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
        await emailService.sendEmail(email.id);
        onUpdate();
    } catch (error) {
        console.error('Failed to send email:', error);
    } finally {
        setIsSending(false);
    }
  };

  return (
    <>
      <div className="email-item-container">
        <div className="email-item-header" onClick={handleToggleExpand}>
          <span className="email-to">{email.to}</span>
          <div className="email-item-actions-preview">
             <Badge bg="secondary">{email.status}</Badge>
            <Button variant="link" size="sm">
              {isExpanded ? 'Collapse' : 'Expand'} <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
            </Button>
          </div>
        </div>
        <Collapse in={isExpanded}>
          <div className="email-item-body">
            <div className="email-content">
              <strong>Subject:</strong> {email.subject}
              <hr />
              <div dangerouslySetInnerHTML={{ __html: email.body }} />
            </div>
            <div className="email-item-actions">
              <Button variant="outline-primary" size="sm" onClick={handleShowEditModal} disabled={isSaving || isDeleting || isSending}>
                <i className="bi bi-pencil-square"></i> Edit
              </Button>
              <Button variant="outline-danger" size="sm" onClick={handleDelete} disabled={isSaving || isDeleting || isSending}>
                 {isDeleting ? <Spinner as="span" animation="border" size="sm" /> : <i className="bi bi-trash"></i>} Delete
              </Button>
               <Button variant="primary" size="sm" onClick={handleSend} disabled={isSaving || isDeleting || isSending || email.status.endsWith('_sent')}>
                {isSending ? <Spinner as="span" animation="border" size="sm" /> : <i className="bi bi-send"></i>} Send Independently
              </Button>
            </div>
          </div>
        </Collapse>
      </div>

      <Modal show={showEditModal} onHide={handleCloseEditModal} size="lg">
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
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Content</Form.Label>
              <Form.Control
                as="textarea"
                rows={15}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseEditModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving ? <Spinner as="span" animation="border" size="sm" /> : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

const GroupedEmails = ({ stage }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCounts, setVisibleCounts] = useState({});

  useEffect(() => {
    loadGroupedEmails();
  }, [stage]);

  const loadGroupedEmails = async () => {
    try {
      setLoading(true);
      const response = await emailService.getEmailsByStageGrouped(stage);
      const groupsData = response.data.groups || [];
      setGroups(groupsData);
      // Initialize visible counts for each group
      const initialCounts = {};
      groupsData.forEach(group => {
          initialCounts[group.group_id] = 15;
      });
      setVisibleCounts(initialCounts);
    } catch (err) {
      console.error('Error loading grouped emails:', err);
      setError('Failed to load grouped emails');
    } finally {
      setLoading(false);
    }
  };

  const handleShowMore = (groupId) => {
      setVisibleCounts(prevCounts => ({
          ...prevCounts,
          [groupId]: (prevCounts[groupId] || 15) + 15
      }));
  };

  const handleSendAllInGroup = async (groupId) => {
    try {
      const response = await emailService.sendAllByGroup(stage, groupId);
      console.log('Sent all emails in group:', response);
      // Reload the groups to update the status
      await loadGroupedEmails();
    } catch (err) {
      console.error('Error sending all emails in group:', err);
      setError('Failed to send emails in group');
    }
  };

  const CountdownTimer = ({ dueDate }) => {
    const [timeLeft, setTimeLeft] = useState({});

    useEffect(() => {
      if (!dueDate) return;

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
        } else {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }
      };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);

      return () => clearInterval(timer);
    }, [dueDate]);

    if (!dueDate) return <span>No due date set</span>;

    const isOverdue = new Date(dueDate) < new Date();
    
    return (
      <div className={`countdown-timer ${isOverdue ? 'overdue' : ''}`}>
        {isOverdue ? (
          <span className="overdue-text">OVERDUE</span>
        ) : (
          <span>
            {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
          </span>
        )}
      </div>
    );
  };

  if (loading) return <div>Loading grouped emails...</div>;
  if (error) return <div className="error">{error}</div>;
  if (groups.length === 0) return <div>No grouped emails found for {stage} stage.</div>;

  return (
    <div className="grouped-emails">
      <h3>Grouped Emails - {stage.charAt(0).toUpperCase() + stage.slice(1)}</h3>
      
      {groups.map((group) => (
        <div key={group.group_id} className="email-group">
          <div className="group-header">
            <h4>Batch: {group.group_id}</h4>
            <div className="group-stats">
              <span>Total: {group.email_count}</span>
              <span>Due: {group.status_counts?.followup_due || group.status_counts?.lastchance_due || 0}</span>
              <span>Sent: {group.status_counts?.followup_sent || group.status_counts?.lastchance_sent || 0}</span>
            </div>
            <CountdownTimer dueDate={group.earliest_due_date} />
          </div>
          
          <div className="group-actions">
            <button 
              onClick={() => handleSendAllInGroup(group.group_id)}
              disabled={!(group.status_counts?.followup_due || group.status_counts?.lastchance_due)}
              className="send-all-btn"
            >
              Send All in Group ({group.status_counts?.followup_due || group.status_counts?.lastchance_due || 0})
            </button>
          </div>
          
          <div className="emails-list">
            {group.emails.slice(0, visibleCounts[group.group_id] || 15).map((email) => (
                <EmailRow key={email.id} email={email} onUpdate={loadGroupedEmails} />
            ))}
            {(group.emails.length > (visibleCounts[group.group_id] || 15)) && (
              <div className="more-emails">
                <Button variant="link" onClick={() => handleShowMore(group.group_id)}>
                    See more... ({group.emails.length - (visibleCounts[group.group_id] || 15)} remaining)
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default GroupedEmails; 
