import React, { useState, useEffect } from 'react';

function SendEmailsPage() {
  const [emails, setEmails] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    // Fetch generated emails from backend
    fetch('/api/emails/queue')
      .then(res => res.json())
      .then(data => setEmails(data.emails));
  }, []);

  const handleSend = async () => {
    const email = emails[currentIdx];
    await fetch(`/api/emails/send_via_gmail`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email_id: email.id})
    });
    setCurrentIdx(idx => idx + 1);
  };

  if (emails.length === 0) return <div>No emails in queue.</div>;
  const email = emails[currentIdx];
  return (
    <div>
      <div>To: <input value={email.to} /></div>
      <div>Subject: <input value={email.subject} /></div>
      <div>Body: <textarea value={email.content} /></div>
      <button onClick={handleSend}>Send</button>
      <div>{currentIdx + 1} of {emails.length}</div>
    </div>
  );
}
export default SendEmailsPage;
