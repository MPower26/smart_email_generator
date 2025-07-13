import React, { useState, useEffect } from 'react';
import { emailService, templateService } from '../services/api';

const EmailGenerator = () => {
  const [file, setFile] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limits, setLimits] = useState(null);
  const [warning, setWarning] = useState(null);
  const [checkMessage, setCheckMessage] = useState(null);

  useEffect(() => {
    // Charger les limites d'envoi à l'ouverture
    emailService.getEmailLimits()
      .then(res => {
        setLimits(res.data);
        setWarning(res.data.warning_message);
      })
      .catch(() => setLimits(null));
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCheckMessage(null);

    // Vérifier le nombre de contacts dans le CSV
    let recipientCount = 0;
    if (file) {
      const text = await file.text();
      recipientCount = text.split('\n').filter(line => line.trim()).length - 1; // -1 pour l'en-tête
      if (recipientCount < 1) recipientCount = 1;
    }

    try {
      // Appel anti-spam avant génération
      const checkRes = await emailService.checkEmailSend(recipientCount);
      setCheckMessage(checkRes.data.message);
      if (!checkRes.data.can_send) {
        setLoading(false);
        setError(checkRes.data.message);
        return;
      }
      // Génération si autorisé
      const response = await emailService.generateEmails(file, templateId);
      setEmails(response.emails);
    } catch (err) {
      setError('Error generating emails. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="email-generator">
      <h2>Generate Emails</h2>
      {limits && (
        <div className="email-limits-info" style={{marginBottom: 16, padding: 12, border: '1px solid #eee', borderRadius: 6}}>
          <div><b>Emails envoyés aujourd'hui :</b> {limits.emails_sent_today} / {limits.daily_limit}</div>
          <div><b>Destinataires uniques aujourd'hui :</b> {limits.unique_recipients_today} / {limits.recipient_limit}</div>
          <div><b>Réputation :</b> {limits.reputation_score} / 10</div>
          <div><b>Statut warmup :</b> {limits.warmup_status}</div>
          {warning && <div style={{color: 'orange', fontWeight: 'bold'}}>{warning}</div>}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="file">Upload Contacts CSV:</label>
          <input
            type="file"
            id="file"
            accept=".csv"
            onChange={handleFileChange}
            required
          />
        </div>
        <div>
          <label htmlFor="templateId">Template ID (optional):</label>
          <input
            type="text"
            id="templateId"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Emails'}
        </button>
      </form>

      {checkMessage && <div className="check-message" style={{marginTop: 8, color: '#0070f3'}}>{checkMessage}</div>}
      {error && <div className="error">{error}</div>}

      {emails.length > 0 && (
        <div className="emails-list">
          <h3>Generated Emails ({emails.length})</h3>
          {emails.map((email, index) => (
            <div key={index} className="email-item">
              <h4>To: {email.to}</h4>
              <p>Subject: {email.subject}</p>
              <div className="email-content">
                {email.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailGenerator; 
