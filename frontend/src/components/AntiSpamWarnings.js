import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './AntiSpamWarnings.css';
import { validateEmail } from '../services/api';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { validateDomainDNS } from '../services/api';

const AntiSpamWarnings = ({ onWarningChange }) => {
    const [warnings, setWarnings] = useState([]);
    const [limits, setLimits] = useState(null);
    const [reputation, setReputation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailToCheck, setEmailToCheck] = useState('');
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState(null);
    const [checkError, setCheckError] = useState(null);
    const [showReputationModal, setShowReputationModal] = useState(false);
    const [showDNSModal, setShowDNSModal] = useState(false);
    const [dnsInput, setDnsInput] = useState('');
    const [dnsChecking, setDnsChecking] = useState(false);
    const [dnsResult, setDnsResult] = useState(null);
    const [dnsError, setDnsError] = useState(null);

    const handleOpenReputationModal = () => setShowReputationModal(true);
    const handleCloseReputationModal = () => setShowReputationModal(false);
    

    useEffect(() => {
        fetchAntiSpamData();
    }, []);

    const fetchAntiSpamData = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/anti-spam/dashboard');
            
            if (response.data.success) {
                setWarnings(response.data.data.warnings || []);
                setLimits(response.data.data.user_limits);
                setReputation(response.data.data.reputation);
                
                // Notify parent component if there are warnings
                if (onWarningChange) {
                    onWarningChange(response.data.data.warnings || []);
                }
            }
        } catch (err) {
            console.error('Error loading anti-spam data:', err);
            setError('Unable to load anti-spam data');
        } finally {
            setLoading(false);
        }
    };

    const getReputationColor = (score) => {
        if (score >= 8) return '#28a745'; // Vert
        if (score >= 6) return '#ffc107'; // Jaune
        if (score >= 4) return '#fd7e14'; // Orange
        return '#dc3545'; // Rouge
    };

    const getWarmupStatusText = (status) => {
        switch (status) {
            case 'new': return 'New account';
            case 'warming': return 'Warming up';
            case 'active': return 'Active';
            case 'restricted': return 'Restricted';
            default: return status;
        }
    };

    const getWarmupStatusColor = (status) => {
        switch (status) {
            case 'new': return '#dc3545';
            case 'warming': return '#ffc107';
            case 'active': return '#28a745';
            case 'restricted': return '#dc3545';
            default: return '#6c757d';
        }
    };

    const handleOpenModal = () => {
        setShowEmailModal(true);
        setEmailToCheck('');
        setCheckResult(null);
        setCheckError(null);
    };
    const handleCloseModal = () => {
        setShowEmailModal(false);
        setEmailToCheck('');
        setCheckResult(null);
        setCheckError(null);
    };
    const handleCheckEmail = async (e) => {
        e.preventDefault();
        setChecking(true);
        setCheckResult(null);
        setCheckError(null);
        try {
            const response = await validateEmail(emailToCheck);
            setCheckResult(response.data);
        } catch (err) {
            setCheckError('Error during verification.');
        } finally {
            setChecking(false);
        }
    };

    const handleOpenDNSModal = () => {
        setShowDNSModal(true);
        setDnsInput('');
        setDnsResult(null);
        setDnsError(null);
    };
    const handleCloseDNSModal = () => {
        setShowDNSModal(false);
        setDnsInput('');
        setDnsResult(null);
        setDnsError(null);
    };
    const handleCheckDNS = async (e) => {
        e.preventDefault();
        setDnsChecking(true);
        setDnsResult(null);
        setDnsError(null);
        try {
            const response = await validateDomainDNS(dnsInput);
            setDnsResult(response.data);
        } catch (err) {
            setDnsError('Error during DNS verification.');
        } finally {
            setDnsChecking(false);
        }
    };

    if (loading) {
        return (
            <div className="anti-spam-warnings">
                <div className="loading">Loading anti-spam data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="anti-spam-warnings">
                <div className="error">{error}</div>
            </div>
        );
    }

    return (
        <div className="anti-spam-warnings">
            {/* Warnings */}
            {warnings.length > 0 && (
                <div className="warnings-section">
                    <h4>⚠️ Anti-Spam Warnings</h4>
                    <div className="warnings-list">
                        {warnings.map((warning, index) => (
                            <div key={index} className="warning-item">
                                {warning}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sending Limits */}
            {limits && (
                <div className="limits-section">
                    <h4>📊 Sending Limits</h4>
                    <div className="limits-grid">
                        <div className="limit-item">
                            <span className="limit-label">Emails sent today:</span>
                            <span className="limit-value">
                                {limits.emails_sent_today} / {limits.daily_limit}
                            </span>
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill" 
                                    style={{ 
                                        width: `${(limits.emails_sent_today / limits.daily_limit) * 100}%`,
                                        backgroundColor: limits.remaining_emails <= 50 ? '#dc3545' : '#28a745'
                                    }}
                                ></div>
                            </div>
                        </div>
                        
                        <div className="limit-item">
                            <span className="limit-label">Unique recipients:</span>
                            <span className="limit-value">
                                {limits.unique_recipients_today} / {limits.recipient_limit}
                            </span>
                            <div className="progress-bar">
                                <div 
                                    className="progress-fill" 
                                    style={{ 
                                        width: `${(limits.unique_recipients_today / limits.recipient_limit) * 100}%`,
                                        backgroundColor: limits.remaining_recipients <= 30 ? '#dc3545' : '#28a745'
                                    }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reputation */}
            {reputation && (
                <div className="reputation-section">
                    <h4>🏆 Sender Reputation</h4>
                    <div className="reputation-grid">
                        <div className="reputation-item">
                            <span className="reputation-label">Reputation score:</span>
                            <span 
                                className="reputation-score"
                                style={{ color: getReputationColor(reputation.reputation_score) }}
                            >
                                {reputation.reputation_score.toFixed(1)}/10
                            </span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Status:</span>
                            <span 
                                className="reputation-status"
                                style={{ color: getWarmupStatusColor(reputation.warmup_status) }}
                            >
                                {getWarmupStatusText(reputation.warmup_status)}
                            </span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Emails sent (total):</span>
                            <span className="reputation-value">{reputation.total_emails_sent}</span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Successful deliveries:</span>
                            <span className="reputation-value">{reputation.successful_deliveries}</span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Bounced emails:</span>
                            <span className="reputation-value">{reputation.bounced_emails}</span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Spam reports:</span>
                            <span className="reputation-value">{reputation.spam_reports}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tips */}
            <div className="tips-section">
                <h4>💡 Tips to avoid spam</h4>
                <ul className="tips-list">
                    <li>Start with small volumes (50 emails/day) to establish your reputation</li>
                    <li>
                        Use valid and verified email addresses
                        <Button variant="link" size="sm" style={{padding:0, marginLeft:8}} onClick={handleOpenModal}>Verify</Button>
                    </li>
                    <li>Avoid spam keywords in your subjects and content</li>
                    <li>
                        Respect daily sending limits
                        <Button variant="link" size="sm" style={{padding:0, marginLeft:8}} onClick={handleOpenModal}>Verify</Button>
                    </li>
                    <li>
                        Monitor your reputation score regularly
                        <Button variant="link" size="sm" style={{padding:0, marginLeft:8}} onClick={handleOpenReputationModal}>Verify</Button>
                    </li>
                    <li>
                        Configure SPF, DKIM and DMARC correctly for your domain
                        <Button variant="link" size="sm" style={{padding:0, marginLeft:8}} onClick={handleOpenDNSModal}>Verify</Button>
                    </li>
                </ul>
            </div>

            {/* Email Check Modal */}
            <Modal show={showEmailModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Verify an email address</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleCheckEmail}>
                        <Form.Group className="mb-3">
                            <Form.Label>Email address to verify</Form.Label>
                            <Form.Control
                                type="email"
                                value={emailToCheck}
                                onChange={e => setEmailToCheck(e.target.value)}
                                placeholder="example@domain.com"
                                required
                            />
                        </Form.Group>
                        <Button type="submit" variant="primary" disabled={checking || !emailToCheck} className="w-100">
                            {checking ? <Spinner as="span" animation="border" size="sm" /> : 'Verify'}
                        </Button>
                    </Form>
                    {checkResult && (
                        <Alert variant={checkResult.valid ? 'success' : 'danger'} className="mt-3">
                            {checkResult.valid ? (
                                <>
                                    ✅ Valid address<br/>
                                    <b>Normalized address:</b> {checkResult.normalized}<br/>
                                    <b>MX found:</b> {checkResult.mx_found ? 'Yes' : 'No'}<br/>
                                    <b>Account type:</b> {checkResult.account_type === 'gmail' ? 'Free Gmail' : checkResult.account_type === 'workspace' ? 'Google Workspace' : 'Other'}<br/>
                                    <b>Daily limit:</b> {checkResult.daily_limit ? checkResult.daily_limit + ' emails/day' : 'Unknown'}
                                </>
                            ) : (
                                <>
                                    ❌ Invalid address<br/>
                                    <b>Reason:</b> {checkResult.reason}
                                </>
                            )}
                        </Alert>
                    )}
                    {checkError && <Alert variant="danger" className="mt-3">{checkError}</Alert>}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Reputation Check Modal */}
            <Modal show={showReputationModal} onHide={handleCloseReputationModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Check your sender reputation</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {reputation ? (
                        <div>
                            <p><b>Reputation score:</b> {reputation.reputation_score.toFixed(1)} / 10</p>
                            <p><b>Status:</b> {reputation.warmup_status}</p>
                            <p><b>Emails sent (total):</b> {reputation.total_emails_sent}</p>
                            <p><b>Successful deliveries:</b> {reputation.successful_deliveries}</p>
                            <p><b>Bounced emails:</b> {reputation.bounced_emails}</p>
                            <p><b>Spam reports:</b> {reputation.spam_reports}</p>
                            <p><b>Last calculated:</b> {new Date(reputation.last_calculated).toLocaleString()}</p>
                        </div>
                    ) : (
                        <Alert variant="warning">Unable to load your reputation. Please try again later.</Alert>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseReputationModal}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* DNS Check Modal */}
            <Modal show={showDNSModal} onHide={handleCloseDNSModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Check DNS configuration</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleCheckDNS}>
                        <Form.Group className="mb-3">
                            <Form.Label>Domain to check</Form.Label>
                            <Form.Control
                                type="text"
                                value={dnsInput}
                                onChange={e => setDnsInput(e.target.value)}
                                placeholder="example.com"
                                required
                            />
                        </Form.Group>
                        <Button type="submit" variant="primary" disabled={dnsChecking || !dnsInput} className="w-100">
                            {dnsChecking ? <Spinner as="span" animation="border" size="sm" /> : 'Check DNS'}
                        </Button>
                    </Form>
                    {dnsResult && (
                        <Alert variant="info" className="mt-3">
                            <h6>DNS Configuration Results:</h6>
                            <p><b>Domain:</b> {dnsResult.domain}</p>
                            <p><b>SPF:</b> {dnsResult.spf ? '✅ Configured' : '❌ Not configured'}</p>
                            <p><b>DKIM:</b> {dnsResult.dkim ? '✅ Configured' : '❌ Not configured'}</p>
                            <p><b>DMARC:</b> {dnsResult.dmarc ? '✅ Configured' : '❌ Not configured'}</p>
                            {dnsResult.recommendations && (
                                <div className="mt-2">
                                    <b>Recommendations:</b>
                                    <ul className="mb-0">
                                        {dnsResult.recommendations.map((rec, index) => (
                                            <li key={index}>{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Alert>
                    )}
                    {dnsError && <Alert variant="danger" className="mt-3">{dnsError}</Alert>}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDNSModal}>Close</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default AntiSpamWarnings;
