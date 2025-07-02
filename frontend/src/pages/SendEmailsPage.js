import React, { useState, useEffect, useRef } from 'react';
import { emailService } from '../services/api';
import { Tabs, Tab, Button, ProgressBar } from 'react-bootstrap';

const STAGES = [
  { key: 'outreach', label: 'Outreach', batchLimit: 120 },
  { key: 'followup', label: 'Follow Up', batchLimit: null },
  { key: 'lastchance', label: 'Last Chance', batchLimit: null },
];

function SendEmailsPage() {
  const [stage, setStage] = useState('outreach');
  const [emails, setEmails] = useState([]);
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0, batch_size: 0 });
  const [polling, setPolling] = useState(false);
  const pollInterval = useRef(null);

  // Fetch emails for the current stage
  const fetchEmails = async () => {
    const res = await emailService.getEmailsByStage(stage);
    setEmails(res.data);
  };

  useEffect(() => {
    fetchEmails();
    setProgress({ sent: 0, total: 0, batch_size: 0 });
    setSending(false);
    setPaused(false);
    stopPolling();
    // Clean up polling on unmount
    return () => clearInterval(pollInterval.current);
  }, [stage]);

  // Poll for progress and update email list
  const startPolling = () => {
    setPolling(true);
    pollInterval.current = setInterval(async () => {
      await fetchEmails();
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
    const batchLimit = STAGES.find(s => s.key === stage).batchLimit;
    const totalToSend = batchLimit ? Math.min(batchLimit, emails.length) : emails.length;
    setProgress({ sent: 0, total: emails.length, batch_size: totalToSend });
    startPolling();
    let sent = 0;
    while (sent < totalToSend && !paused) {
      const sendCount = batchLimit ? 1 : Math.max(1, totalToSend - sent); // Outreach: 1 at a time, others: all at once
      const res = await emailService.sendBatch(stage, sendCount);
      sent += res.data.sent;
      setProgress(prev => ({ ...prev, sent }));
      await fetchEmails();
      if (res.data.sent === 0) break; // No more to send
      if (batchLimit === null) break; // For followup/lastchance, send all at once
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
      <h2>Send Emails</h2>
      <Tabs activeKey={stage} onSelect={setStage} className="mb-3">
        {STAGES.map(s => (
          <Tab eventKey={s.key} title={s.label} key={s.key} />
        ))}
      </Tabs>
      <Button onClick={handleSendAll} disabled={sending || emails.length === 0} variant="primary">Send All</Button>{' '}
      <Button onClick={handlePause} disabled={!sending || paused} variant="warning">Pause</Button>{' '}
      <Button onClick={handleResume} disabled={!paused} variant="success">Resume</Button>
      <div style={{ margin: '10px 0', maxWidth: 400 }}>
        <ProgressBar now={progress.sent} max={progress.batch_size} label={`${progress.sent}/${progress.batch_size} sent`} />
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
