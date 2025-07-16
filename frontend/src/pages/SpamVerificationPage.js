import React, { useState } from 'react';
import { Form, Button, Alert, Card, Spinner, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import { emailService } from '../services/api';

const DKIM_HELP = `A DKIM selector is a string (like 'default', 'mail', or a custom name) that identifies which DKIM key to use for signing emails.\nYou can usually find your selector in your email sending service settings (e.g., Google Workspace, SendGrid, Mailgun, etc.). If you don't know it, try 'default' or check your provider's documentation.`;

const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'aol.com', 'icloud.com', 'mail.com', 'gmx.com', 'protonmail.com', 'zoho.com', 'yandex.com', 'msn.com', 'live.com', 'comcast.net', 'me.com', 'mac.com', 'rocketmail.com', 'mail.ru', 'qq.com', 'naver.com', '163.com', '126.com', 'sina.com', 'rediffmail.com', 'web.de', 'cox.net', 'bellsouth.net', 'earthlink.net', 'charter.net', 'shaw.ca', 'blueyonder.co.uk', 'btinternet.com', 'virginmedia.com', 'ntlworld.com', 'talktalk.net', 'sky.com', 'optonline.net', 'orange.fr', 'wanadoo.fr', 'free.fr', 'laposte.net', 'sfr.fr', 'neuf.fr', 'aliceadsl.fr', 't-online.de', 'arcor.de', 'libero.it', 'virgilio.it', 'tin.it', 'tiscali.it', 'alice.it', 'live.it', 'email.it', 'fastwebnet.it', 'inwind.it', 'iol.it', 'tele2.it', 'poste.it', 'vodafone.it', 'mail.bg', 'abv.bg', 'dir.bg', 'mail.ee', 'mail.kz', 'bk.ru', 'list.ru', 'inbox.ru', 'mail.ua', 'ukr.net', 'rambler.ru', 'outlook.fr', 'hotmail.fr', 'hotmail.co.uk', 'hotmail.it', 'hotmail.de', 'hotmail.es', 'hotmail.nl', 'hotmail.be', 'hotmail.ca', 'hotmail.ch', 'hotmail.se', 'hotmail.no', 'hotmail.dk', 'hotmail.fi', 'hotmail.pt', 'hotmail.gr', 'hotmail.com.br', 'hotmail.com.ar', 'hotmail.com.mx', 'hotmail.com.tr', 'hotmail.com.au', 'hotmail.co.jp', 'hotmail.co.kr', 'hotmail.co.th', 'hotmail.co.id', 'hotmail.co.in', 'hotmail.co.za', 'hotmail.co.il', 'hotmail.co.nz', 'hotmail.com.sg', 'hotmail.com.hk', 'hotmail.com.tw', 'hotmail.com.cn', 'hotmail.com.my', 'hotmail.com.ph', 'hotmail.com.vn', 'hotmail.com.eg', 'hotmail.com.sa', 'hotmail.com.ua', 'hotmail.com.pl', 'hotmail.com.ro', 'hotmail.com.hu', 'hotmail.com.cz', 'hotmail.com.sk', 'hotmail.com.hr', 'hotmail.com.si', 'hotmail.com.rs', 'hotmail.com.ba', 'hotmail.com.mk', 'hotmail.com.bg', 'hotmail.com.lt', 'hotmail.com.lv', 'hotmail.com.ee', 'hotmail.com.by', 'hotmail.com.kz', 'hotmail.com.uz', 'hotmail.com.az', 'hotmail.com.ge', 'hotmail.com.am', 'hotmail.com.kg', 'hotmail.com.tm', 'hotmail.com.tj', 'hotmail.com.md', 'hotmail.com.al', 'hotmail.com.me', 'hotmail.com.xn--p1ai', 'hotmail.com.tr', 'hotmail.com.gr', 'hotmail.com.cy', 'hotmail.com.mt', 'hotmail.com.ee', 'hotmail.com.lv', 'hotmail.com.lt', 'hotmail.com.by', 'hotmail.com.ua', 'hotmail.com.pl', 'hotmail.com.ro', 'hotmail.com.hu', 'hotmail.com.cz', 'hotmail.com.sk', 'hotmail.com.hr', 'hotmail.com.si', 'hotmail.com.rs', 'hotmail.com.ba', 'hotmail.com.mk', 'hotmail.com.bg', 'hotmail.com.lt', 'hotmail.com.lv', 'hotmail.com.ee', 'hotmail.com.by', 'hotmail.com.kz', 'hotmail.com.uz', 'hotmail.com.az', 'hotmail.com.ge', 'hotmail.com.am', 'hotmail.com.kg', 'hotmail.com.tm', 'hotmail.com.tj', 'hotmail.com.md', 'hotmail.com.al', 'hotmail.com.me', 'hotmail.com.xn--p1ai'];

const SpamVerificationPage = () => {
  const [email, setEmail] = useState('');
  const [dkimSelector, setDkimSelector] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sendingIp, setSendingIp] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    // Professional domain validation
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || FREE_EMAIL_DOMAINS.includes(domain)) {
      setLoading(false);
      setError('Please enter a professional email address (e.g., user@yourcompany.com). Free email addresses like Gmail, Outlook, Yahoo, etc. are not supported for bulk sending checks.');
      return;
    }
    try {
      const res = await emailService.spamVerification(email, dkimSelector || undefined, sendingIp || undefined);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="mb-4">Spam Verification</h2>
      <p>
        Enter the email address you plan to use for sending emails. This tool will analyze your domain's SPF, DKIM, and DMARC configuration to help ensure your emails are delivered successfully and not marked as spam.<br/>
        <b>What is this?</b> SPF, DKIM, and DMARC are DNS records that help prove your emails are legitimate and protect your domain from spoofing. This page checks if your domain is properly configured and explains any issues found.
      </p>
      <Card className="mb-4 p-3">
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email address to analyze</Form.Label>
            <Form.Control
              type="email"
              placeholder="yourname@yourdomain.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="dkimSelector">
            <Form.Label>DKIM Selector <span style={{fontWeight: 'normal', fontSize: '0.9em'}}>(optional)</span></Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. default, mail, google"
              value={dkimSelector}
              onChange={e => setDkimSelector(e.target.value)}
            />
            <Form.Text className="text-muted" style={{whiteSpace: 'pre-line'}}>
              {DKIM_HELP}
            </Form.Text>
          </Form.Group>
          <Form.Group className="mb-3" controlId="sendingIp">
            <Form.Label>Sending IP Address <span style={{fontWeight: 'normal', fontSize: '0.9em'}}>(optional)</span></Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. 209.85.220.41"
              value={sendingIp}
              onChange={e => setSendingIp(e.target.value)}
            />
            <Form.Text className="text-muted">
              For the most accurate blacklist check, paste the IP address from the Received header of your sent email. <a href="https://mxtoolbox.com/Public/Content/EmailHeaders/" target="_blank" rel="noopener noreferrer">How to find your sending IP</a>.
            </Form.Text>
          </Form.Group>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : 'Analyze'}
          </Button>
        </Form>
      </Card>
      {error && <Alert variant="danger">{error}</Alert>}
      {result && (
        <Card className="p-3">
          <h4>Analysis for <span className="text-primary">{result.domain}</span></h4>
          <Row>
            {Object.entries(result.checks).map(([name, check]) => (
              <Col md={4} key={name} className="mb-3">
                <Card className="h-100">
                  <Card.Body>
                    <Card.Title>
                      {name} {check.status === 'pass' && <span style={{color: 'green'}}>✔️</span>}
                      {check.status === 'fail' && <span style={{color: 'red'}}>❌</span>}
                      {check.status === 'warning' && <span style={{color: 'orange'}}>⚠️</span>}
                    </Card.Title>
                    <div style={{fontWeight: 'bold'}}>What is {name}?</div>
                    <div style={{fontSize: '0.95em'}}>{check.explanation}</div>
                    <div className="mt-2" style={{fontWeight: 'bold'}}>Result:</div>
                    <div style={{fontSize: '0.95em'}}>
                      {check.status === 'pass' && '✅ Configured correctly!'}
                      {check.status === 'fail' && <span style={{color: 'red'}}>{check.how_to_fix}</span>}
                      {check.status === 'warning' && <span style={{color: 'orange'}}>{check.how_to_fix}</span>}
                    </div>
                    {check.record && (
                      <div className="mt-2" style={{fontSize: '0.85em', color: '#555'}}>
                        <b>DNS Record:</b> <code>{check.record}</code>
                      </div>
                    )}
                    {name === 'DKIM' && (
                      <div className="mt-2" style={{fontSize: '0.85em', color: '#555'}}>
                        <b>Selector used:</b> <code>{check.selector}</code>
                      </div>
                    )}
                    {name === 'DMARC' && check.policy && (
                      <div className="mt-2" style={{fontSize: '0.85em', color: '#555'}}>
                        <b>Policy:</b> <code>{check.policy}</code>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          {result.alerts && result.alerts.length > 0 && (
            <div className="mt-3">
              <h5>Alerts</h5>
              {result.alerts.map((alert, idx) => (
                <Alert key={idx} variant={alert.level === 'error' ? 'danger' : 'warning'}>
                  {alert.message}
                </Alert>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default SpamVerificationPage; 