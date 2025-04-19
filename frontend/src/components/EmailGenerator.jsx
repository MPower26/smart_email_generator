import React, { useState } from 'react';
import { emailService } from '../services/api';

const EmailGenerator = () => {
  const [file, setFile] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
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