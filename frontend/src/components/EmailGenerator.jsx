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

  useEffect(() => {
    fetchEmailLimitsStatus()
      .then(setLimits)
      .catch(() => setLimitsError('Unable to fetch email limits status'));
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
      return;
    }

    try {
      const response = await emailService.generateEmails(file, templateId);
      setEmails(response.emails);
      // Rafraîchir le statut après génération
      fetchEmailLimitsStatus().then(setLimits);
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

      {/* Affichage du statut warm-up/quota */}
      {limits && (
        <div className="email-limits-status" style={{ marginBottom: 16 }}>
          <strong>Daily quota:</strong> {limits.user_quota} (remaining: {limits.user_remaining})<br />
          <strong>Domain quota:</strong> {limits.domain_quota} (remaining: {limits.domain_remaining})<br />
          {limits.is_suspended && (
            <div className="alert alert-danger" style={{ color: 'red', marginTop: 8 }}>
              <b>Sending suspended:</b> {limits.alert || limits.suspension_reason}
            </div>
          )}
          {limits.alert && !limits.is_suspended && (
            <div className="alert alert-warning" style={{ color: 'orange', marginTop: 8 }}>{limits.alert}</div>
          )}
        </div>
      )}
      {limitsError && <div className="alert alert-danger">{limitsError}</div>}

      {/* Pop-up d'alerte quota/suspension */}
      {showLimitAlert && (
        <div className="modal" style={{ background: 'rgba(0,0,0,0.5)', position: 'fixed', top:0, left:0, right:0, bottom:0, zIndex:1000 }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 8, maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
            <h3>Sending Blocked</h3>
            <p>
              {limits && limits.is_suspended && (limits.alert || limits.suspension_reason)}
              {limits && !limits.is_suspended && (limits.alert || 'Your daily or domain quota has been reached.')}
            </p>
            <button onClick={() => setShowLimitAlert(false)}>Close</button>
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
          disabled={loading || (limits && (limits.is_suspended || limits.user_remaining <= 0 || limits.domain_remaining <= 0))}
        >
          {loading ? 'Generating...' : 'Generate Emails'}
        </button>
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
