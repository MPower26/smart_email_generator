import React, { useState, useEffect, useRef } from 'react';
import { emailService } from '../services/api.js';
import { Card, Button, Badge, Collapse, Alert, Spinner, Form, Modal } from 'react-bootstrap';
import websocketService from '../services/websocket';
import EnhancedTemplateEditor from './EnhancedTemplateEditor';
import ProgressBar from 'react-bootstrap/ProgressBar';

// This new component will handle the display and actions for a single email
const EmailRow = ({ email, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedSubject, setEditedSubject] = useState(email.subject || '');
  const [editedContent, setEditedContent] = useState(email.body || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);

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
    setSendError(null); // Clear previous errors
    try {
        await emailService.sendEmail(email.id);
        onUpdate();
    } catch (error) {
        console.error('Failed to send email:', error);
        if (error.response && error.response.status === 401) {
            // Specific error for expired token
            setSendError(
                <span>
                    Gmail token is invalid. Please <a href="/settings">reconnect your account here</a>.
                </span>
            );
        } else {
            // Generic error
            setSendError('Failed to send email. Please try again.');
        }
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
            {sendError && <Alert variant="danger">{sendError}</Alert>}
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
              <EnhancedTemplateEditor
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={15}
                showPreview={false}
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
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [currentGroupForRegen, setCurrentGroupForRegen] = useState(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [sendingGroups, setSendingGroups] = useState(new Set());
  const [searchQueries, setSearchQueries] = useState({}); // { [groupId]: searchString }
  const [groupProgress, setGroupProgress] = useState({}); // { [groupId]: {status, current, total, sent_count, failed_count} }
  const [pausedGroups, setPausedGroups] = useState(new Set());
  const pollingIntervals = useRef({}); // { [groupId]: intervalId }

  useEffect(() => {
    loadGroupedEmails();
  }, [stage]);

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
      if (data.type && data.group_id) {
        setGroupProgress(prev => ({
          ...prev,
          [data.group_id]: {
            status: data.type,
            current: data.current ?? prev[data.group_id]?.current ?? 0,
            total: data.total ?? prev[data.group_id]?.total ?? 0,
            sent_count: data.sent_count ?? prev[data.group_id]?.sent_count ?? 0,
            failed_count: data.failed_count ?? prev[data.group_id]?.failed_count ?? 0,
            error: data.error || null
          }
        }));
      }
      // ... handle other types as needed ...
    });
    // Cleanup on unmount
    return () => websocketService.onProgress(null);
  }, []);

  const loadGroupedEmails = async () => {
    try {
      setLoading(true);
      const response = await emailService.getEmailsByStageGrouped(stage);
      let groupsData = response.data.groups || [];
      // Filter out groups with no due emails for the current stage
      const dueKey = stage === 'followup' ? 'followup_due' : (stage === 'lastchance' ? 'lastchance_due' : null);
      if (dueKey) {
        groupsData = groupsData.filter(group => group.status_counts?.[dueKey] > 0);
      }
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

  const handleOpenRegenerateModal = (group) => {
    setCurrentGroupForRegen(group);
    setShowRegenerateModal(true);
    setRegeneratePrompt(''); // Reset prompt
  };

  const handleCloseRegenerateModal = () => {
    setShowRegenerateModal(false);
    setCurrentGroupForRegen(null);
  };

  const handleRegenerateGroup = async () => {
    if (!currentGroupForRegen || !regeneratePrompt) return;

    setIsRegenerating(true);
    setError(null);

    try {
      await emailService.regenerateGroupEmails(currentGroupForRegen.group_id, regeneratePrompt);
      await loadGroupedEmails(); // Reload to see the new content
    } catch (err) {
      console.error('Error regenerating emails:', err);
      setError('Failed to re-generate emails in the group. Please try again.');
    } finally {
      setIsRegenerating(false);
      handleCloseRegenerateModal();
    }
  };

  // Poll progress for a group
  const pollGroupProgress = async (groupId, progressId) => {
    try {
      const response = await emailService.getGenerationProgressById(progressId);
      const progress = response.data;
      console.log('Polling progress for group:', groupId, 'progress:', progress);
      setGroupProgress(prev => ({
        ...prev,
        [progress.group_id]: {
          status: progress.status,
          current: progress.processed_contacts,
          total: progress.total_contacts,
          sent_count: progress.generated_emails,
          failed_count: progress.total_contacts - progress.generated_emails,
          progress_id: progressId // <-- Store progress_id for pause/resume
        }
      }));
      if (progress.status === 'completed' || progress.status === 'error') {
        clearInterval(pollingIntervals.current[groupId]);
        pollingIntervals.current[groupId] = null;
      }
    } catch (err) {
      // Optionally handle polling error
      console.error('Polling error for group', groupId, err);
    }
  };

  const startPollingGroup = (groupId, progressId) => {
    if (pollingIntervals.current[groupId]) {
      clearInterval(pollingIntervals.current[groupId]);
    }
    pollGroupProgress(groupId, progressId); // Poll immediately
    pollingIntervals.current[groupId] = setInterval(() => pollGroupProgress(groupId, progressId), 2000);
  };

  const handleSendAllInGroup = async (groupId) => {
    setError(null);
    setSendingGroups(prev => new Set(prev).add(groupId));
    try {
      const res = await emailService.sendAllByGroup(stage, groupId);
      if (res.data && res.data.progress_id) {
        startPollingGroup(groupId, res.data.progress_id);
      }
      await loadGroupedEmails();
    } catch (err) {
      console.error('Error sending all emails in group:', err);
      if (err.response && (err.response.status === 401 || err.response.data?.detail?.includes("token"))) {
        setError(
          <span>
            Your Gmail connection has expired. Please <a href="/settings">reconnect your account</a> to send emails.
          </span>
        );
      } else {
        setError('Failed to send emails in group. Please try again.');
      }
    } finally {
      setSendingGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(groupId);
        return newSet;
      });
    }
  };

  const handlePauseGroup = async (groupId) => {
    const progress = groupProgress[groupId];
    if (progress && progress.progress_id) {
      try {
        await emailService.pauseGroupProgress(progress.progress_id);
        setPausedGroups(prev => new Set(prev).add(groupId));
      } catch (err) {
        console.error('Failed to pause group:', err);
      }
    }
  };
  const handleResumeGroup = async (groupId) => {
    const progress = groupProgress[groupId];
    if (progress && progress.progress_id) {
      try {
        await emailService.resumeGroupProgress(progress.progress_id);
        setPausedGroups(prev => {
          const newSet = new Set(prev);
          newSet.delete(groupId);
          return newSet;
        });
      } catch (err) {
        console.error('Failed to resume group:', err);
      }
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

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingIntervals.current).forEach(intervalId => {
        if (intervalId) clearInterval(intervalId);
      });
    };
  }, []);

  if (loading) return <div>Loading grouped emails...</div>;
  if (error) return <div className="error">{error}</div>;
  if (groups.length === 0) return <div>No grouped emails found for {stage} stage.</div>;

  return (
    <div className="grouped-emails">
      <h3>Grouped Emails - {stage.charAt(0).toUpperCase() + stage.slice(1)}</h3>
      
      {groups.map((group) => {
        const searchQuery = searchQueries[group.group_id] || '';
        const handleSearchChange = (e) => {
          setSearchQueries(prev => ({ ...prev, [group.group_id]: e.target.value }));
        };
        // Filter emails by search query
        const filteredEmails = group.emails.filter(email => {
          const q = searchQuery.toLowerCase();
          return (
            (email.recipient_name && email.recipient_name.toLowerCase().includes(q)) ||
            (email.recipient_email && email.recipient_email.toLowerCase().includes(q)) ||
            (email.to && email.to.toLowerCase().includes(q))
          );
        });
        const emailsToShow = filteredEmails.slice(0, visibleCounts[group.group_id] || 15);
        // --- DEBUG LOG ---
        console.log('Rendering group:', group.group_id, 'progress:', groupProgress[group.group_id]);
        // --- Always show progress bar, even if not started ---
        let progress = groupProgress[group.group_id];
        if (!progress) {
          progress = {
            status: 'idle',
            current: 0,
            total: group.email_count,
            sent_count: 0,
            failed_count: 0,
          };
        }
        const isPaused = pausedGroups.has(group.group_id);
        return (
          <div key={group.group_id} className="email-group">
            <div className="group-header">
              <h4>Batch: {group.group_id}</h4>
              <div className="group-stats">
                <span>Total: {group.email_count}</span>
                <span>Due: {group.status_counts?.followup_due || group.status_counts?.lastchance_due || 0}</span>
                <span>Sent: {group.status_counts?.followup_sent || group.status_counts?.lastchance_sent || 0}</span>
              </div>
              <CountdownTimer dueDate={group.earliest_due_date} />
              <Button variant="outline-secondary" size="sm" onClick={() => handleOpenRegenerateModal(group)} disabled={isRegenerating}>
                <i className="bi bi-arrow-clockwise"></i> Re-generate
              </Button>
            </div>
            {/* Search box for this group */}
            <div className="mb-2">
              <input
                type="text"
                className="form-control"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </div>
            {/* Always show per-group progress bar */}
            <div className="group-progress-bar" style={{ margin: '10px 0' }}>
              <ProgressBar
                now={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                label={`${progress.current}/${progress.total}`}
                variant={progress.status === 'completed' ? 'success' : progress.status === 'error' ? 'danger' : 'primary'}
                animated={progress.status === 'processing'}
                striped
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span>Status: {progress.status}</span>
                <span>Sent: {progress.sent_count} | Failed: {progress.failed_count}</span>
                <div>
                  <Button size="sm" variant="light" onClick={() => handlePauseGroup(group.group_id)} disabled={isPaused || progress.status === 'group_sending_complete'}>Pause</Button>
                  <Button size="sm" variant="light" onClick={() => handleResumeGroup(group.group_id)} disabled={!isPaused}>Resume</Button>
                </div>
              </div>
              {progress.error && <Alert variant="danger">{progress.error}</Alert>}
            </div>
            <div className="group-actions">
              <button 
                onClick={() => !isPaused && handleSendAllInGroup(group.group_id)}
                disabled={
                  !(group.status_counts?.followup_due || group.status_counts?.lastchance_due) ||
                  sendingGroups.has(group.group_id) ||
                  isPaused ||
                  progress.status === 'processing' // <-- Disable if sending in progress
                }
                className="send-all-btn"
              >
                {sendingGroups.has(group.group_id) ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-1" />
                    Sending...
                  </>
                ) : (
                  `Send All in Group (${group.status_counts?.followup_due || group.status_counts?.lastchance_due || 0})`
                )}
              </button>
            </div>
            <div className="emails-list">
              {emailsToShow.length === 0 ? (
                <div className="text-muted">No emails found.</div>
              ) : (
                emailsToShow.map((email) => (
                  <EmailRow key={email.id} email={email} onUpdate={loadGroupedEmails} />
                ))
              )}
              {(filteredEmails.length > (visibleCounts[group.group_id] || 15)) && (
                <div className="more-emails">
                  <Button variant="link" onClick={() => handleShowMore(group.group_id)}>
                      See more... ({filteredEmails.length - (visibleCounts[group.group_id] || 15)} remaining)
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <Modal show={showRegenerateModal} onHide={handleCloseRegenerateModal}>
        <Modal.Header closeButton>
          <Modal.Title>Re-generate Emails</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Enter a new prompt to re-generate all emails in batch <strong>{currentGroupForRegen?.group_id}</strong>. This will only update the subject and body.</p>
          <Form.Group>
            <Form.Label>New Prompt</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={regeneratePrompt}
              onChange={(e) => setRegeneratePrompt(e.target.value)}
              placeholder="e.g., 'Make the tone more casual and mention our new feature X.'"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseRegenerateModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRegenerateGroup} disabled={isRegenerating || !regeneratePrompt}>
            {isRegenerating ? <Spinner as="span" animation="border" size="sm" /> : 'Re-generate Now'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default GroupedEmails; 
