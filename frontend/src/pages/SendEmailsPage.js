import React, { useState, useEffect, useRef } from 'react';
import { emailService } from '../services/api';

function SendEmailsPage() {
  const [emails, setEmails] = useState([]);
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0, batch_size: 0 });
  const [stage, setStage] = useState('outreach'); // or 'followup', etc.
  const [polling, setPolling] = useState(false);
  const pollInterval = useRef(null);
  const BATCH_LIMIT = 120;

  // Fetch emails for the current stage
  const fetchEmails = async () => {
    const res = await emailService.getEmailsByStage(stage);
    setEmails(res.data);
  };

  useEffect(() => {
    fetchEmails();
    // Clean up polling on unmount
    return () => clearInterval(pollInterval.current);
  }, [stage]);

  // Poll for progress and update email list
  const startPolling = () => {
    setPolling(true);
    pollInterval.current = setInterval(async () => {
      await fetchEmails();
      // Optionally, fetch progress from backend if you add a progress endpoint
    }, 2000);
  };
  const stopPolling = () => {
    setPolling(false);
    clearInterval(pollInterval.current);
  };

  // Start batch send
  const handleSendAll = async () => {
    setSending(true);
    setPaused(false);
    setProgress({ sent: 0, total: emails.length, batch_size: Math.min(BATCH_LIMIT, emails.length) });
    startPolling();
    let sent = 0;
    while (sent < BATCH_LIMIT && !paused) {
      const res = await emailService.sendBatch(stage, 1); // Send one at a time for live progress
      sent += res.data.sent;
      setProgress(prev => ({ ...prev, sent }));
      await fetchEmails();
      if (res.data.sent === 0) break; // No more to send
    }
    setSending(false);
    stopPolling();
    await fetchEmails();
  };

  // Pause sending
  const handlePause = () => {
    setPaused(true);
    stopPolling();
  };

  // Resume sending
  const handleResume = async () => {
    setPaused(false);
    setSending(true);
    startPolling();
    await handleSendAll();
  };

  return (
    <div>
      <h2>Send Emails ({stage})</h2>
      <button onClick={handleSendAll} disabled={sending || emails.length === 0}>Send All</button>
      <button onClick={handlePause} disabled={!sending || paused}>Pause</button>
      <button onClick={handleResume} disabled={!paused}>Resume</button>
      <div style={{ margin: '10px 0' }}>
        <progress value={progress.sent} max={progress.batch_size} style={{ width: 200 }} />
        <span> {progress.sent} / {progress.batch_size} sent</span>
      </div>
      <ul>
        {emails.map(email => (
          <li key={email.id}>
            To: {email.recipient_email} | Subject: {email.subject} | Status: {email.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
export default SendEmailsPage;

  );
}
export default SendEmailsPage;
