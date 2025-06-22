import React, { useState, useEffect } from 'react';
import { emailService } from '../services/api.js';

const GroupedEmails = ({ stage }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGroupedEmails();
  }, [stage]);

  const loadGroupedEmails = async () => {
    try {
      setLoading(true);
      const response = await emailService.getEmailsByStageGrouped(stage);
      setGroups(response.data.groups || []);
    } catch (err) {
      console.error('Error loading grouped emails:', err);
      setError('Failed to load grouped emails');
    } finally {
      setLoading(false);
    }
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
            {group.emails.slice(0, 3).map((email) => (
              <div key={email.id} className="email-item">
                <span className="email-to">{email.to}</span>
                <span className="email-status">{email.status}</span>
              </div>
            ))}
            {group.emails.length > 3 && (
              <div className="more-emails">
                ... and {group.emails.length - 3} more emails
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default GroupedEmails; 
