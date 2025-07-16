import React, { useState, useEffect } from 'react';
import { emailService, templateService, fetchEmailLimitsStatus } from '../services/api';

const EmailGenerator = () => {
  const [file, setFile] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [limits, setLimits] = useState(null);
  const [limitsError, setLimitsError] = useState(null);
  const [showLimitAlert, setShowLimitAlert] = useState(false);

  // Rafraîchir le quota à chaque génération et à chaque ouverture de pop-up
  const refreshLimits = () => {
    fetchEmailLimitsStatus()
      .then(setLimits)
      .catch(() => setLimitsError('Unable to fetch email limits status'));
  };

  useEffect(() => {
    refreshLimits();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowLimitAlert(false);

    // Blocage si quota dépassé ou suspension
    if (limits && (limits.is_suspended || limits.user_remaining <= 0 || limits.domain_remaining <= 0)) {
      setShowLimitAlert(true);
      setLoading(false);
      refreshLimits();
      return;
    }

    try {
      const response = await emailService.generateEmails(file, templateId);
      setEmails(response.emails);
      refreshLimits();
    } catch (err) {
      setError('Error generating emails. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Détermination du blocage
  const isBlocked = limits && (limits.is_suspended || limits.user_remaining <= 0 || limits.domain_remaining <= 0);
  let blockReason = '';
  if (limits) {
    if (limits.is_suspended) {
      blockReason = limits.alert || limits.suspension_reason || 'Your account is suspended.';
    } else if (limits.user_remaining <= 0) {
      blockReason = 'You have reached your daily email quota.';
    } else if (limits.domain_remaining <= 0) {
      blockReason = 'Your domain has reached its daily quota.';
    } else if (limits.alert) {
      blockReason = limits.alert;
    }
  }

  return (
    <div className="email-generator">
      <h2>Generate Emails</h2>

      {/* Statut warm-up/quota toujours visible */}
      <div className="email-limits-status" style={{ marginBottom: 16, background: '#f7f7f7', padding: 12, borderRadius: 6 }}>
        {limits ? (
          <>
            <strong>Daily quota:</strong> {limits.user_quota} (remaining: {limits.user_remaining})<br />
            <strong>Domain quota:</strong> {limits.domain_quota} (remaining: {limits.domain_remaining})<br />
          </>
        ) : limitsError ? (
          <span style={{ color: 'red' }}>{limitsError}</span>
        ) : (
          <span>Loading quota status...</span>
        )}
      </div>

      {/* Message préventif si suspension ou quota gelé */}
      {limits && (limits.is_suspended || (limits.alert && (limits.user_remaining <= 0 || limits.domain_remaining <= 0))) && (
        <div style={{ background: '#ffeaea', color: '#b30000', padding: 10, borderRadius: 6, marginBottom: 16, fontWeight: 'bold' }}>
          {blockReason}
        </div>
      )}

      {/* Pop-up d'alerte quota/suspension */}
      {showLimitAlert && (
        <div className="modal" style={{ background: 'rgba(0,0,0,0.5)', position: 'fixed', top:0, left:0, right:0, bottom:0, zIndex:1000 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 8, maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
            <h3>Sending Blocked</h3>
            <p>{blockReason}</p>
            <button onClick={() => { setShowLimitAlert(false); refreshLimits(); }}>Close</button>
          </div>
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
        <button
          type="submit"
          disabled={loading || isBlocked}
        >
          {loading ? 'Generating...' : 'Generate Emails'}
        </button>
        {/* Message sous le bouton si bloqué */}
        {isBlocked && (
          <div style={{ color: '#b30000', marginTop: 8, fontWeight: 'bold' }}>{blockReason}</div>
        )}
      </form>

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
