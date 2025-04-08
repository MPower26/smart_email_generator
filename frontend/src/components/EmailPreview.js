import React, { useState } from 'react';
import { Card, Accordion, Button } from 'react-bootstrap';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const EmailPreview = ({ email, index }) => {
  const [copied, setCopied] = useState(false);

  // Reset copy status after 2 seconds
  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="mb-3 email-preview-card">
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <strong>Email {index + 1}: {email.to}</strong>
          <CopyToClipboard text={email.body} onCopy={handleCopy}>
            <Button variant="outline-secondary" size="sm">
              {copied ? 'Copied!' : 'Copy Content'} 
              <i className={`bi ${copied ? 'bi-check' : 'bi-clipboard'} ms-1`}></i>
            </Button>
          </CopyToClipboard>
        </div>
      </Card.Header>
      <Accordion defaultActiveKey="0">
        <Accordion.Item eventKey="0">
          <Accordion.Header>
            <div>
              <strong>Subject:</strong> {email.subject}
            </div>
          </Accordion.Header>
          <Accordion.Body>
            <div className="email-body">
              {email.body.split('\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </Card>
  );
};

export default EmailPreview; 