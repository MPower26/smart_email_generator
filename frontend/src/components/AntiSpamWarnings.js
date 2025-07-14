import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './AntiSpamWarnings.css';
import { validateEmail } from '../services/api';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';

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
                
                // Notifier le composant parent s'il y a des avertissements
                if (onWarningChange) {
                    onWarningChange(response.data.data.warnings || []);
                }
            }
        } catch (err) {
            console.error('Erreur lors du chargement des données anti-spam:', err);
            setError('Impossible de charger les données anti-spam');
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
            case 'new': return 'Nouveau compte';
            case 'warming': return 'En montée en charge';
            case 'active': return 'Actif';
            case 'restricted': return 'Restreint';
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
            setCheckError('Erreur lors de la vérification.');
        } finally {
            setChecking(false);
        }
    };

    if (loading) {
        return (
            <div className="anti-spam-warnings">
                <div className="loading">Chargement des données anti-spam...</div>
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
            {/* Avertissements */}
            {warnings.length > 0 && (
                <div className="warnings-section">
                    <h4>⚠️ Avertissements Anti-Spam</h4>
                    <div className="warnings-list">
                        {warnings.map((warning, index) => (
                            <div key={index} className="warning-item">
                                {warning}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Limites d'envoi */}
            {limits && (
                <div className="limits-section">
                    <h4>📊 Limites d'envoi</h4>
                    <div className="limits-grid">
                        <div className="limit-item">
                            <span className="limit-label">Emails envoyés aujourd'hui:</span>
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
                            <span className="limit-label">Destinataires uniques:</span>
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

            {/* Réputation */}
            {reputation && (
                <div className="reputation-section">
                    <h4>🏆 Réputation d'expéditeur</h4>
                    <div className="reputation-grid">
                        <div className="reputation-item">
                            <span className="reputation-label">Score de réputation:</span>
                            <span 
                                className="reputation-score"
                                style={{ color: getReputationColor(reputation.reputation_score) }}
                            >
                                {reputation.reputation_score.toFixed(1)}/10
                            </span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Statut:</span>
                            <span 
                                className="reputation-status"
                                style={{ color: getWarmupStatusColor(reputation.warmup_status) }}
                            >
                                {getWarmupStatusText(reputation.warmup_status)}
                            </span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Emails envoyés (total):</span>
                            <span className="reputation-value">{reputation.total_emails_sent}</span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Livraisons réussies:</span>
                            <span className="reputation-value">{reputation.successful_deliveries}</span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Emails rejetés:</span>
                            <span className="reputation-value">{reputation.bounced_emails}</span>
                        </div>
                        
                        <div className="reputation-item">
                            <span className="reputation-label">Signalements spam:</span>
                            <span className="reputation-value">{reputation.spam_reports}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Conseils */}
            <div className="tips-section">
                <h4>💡 Conseils pour éviter le spam</h4>
                <ul className="tips-list">
                    <li>Commencez par de petits volumes (50 emails/jour) pour établir votre réputation</li>
                    <li>
                        Utilisez des adresses email valides et vérifiées
                        <Button variant="link" size="sm" style={{padding:0, marginLeft:8}} onClick={handleOpenModal}>Vérifier</Button>
                    </li>
                    <li>Évitez les mots-clés spam dans vos sujets et contenus</li>
                    <li>
                        Respectez les limites d'envoi quotidiennes
                        <Button variant="link" size="sm" style={{padding:0, marginLeft:8}} onClick={handleOpenModal}>Vérifier</Button>
                    </li>
                    <li>
                        Surveillez votre score de réputation régulièrement
                        <Button variant="link" size="sm" style={{padding:0, marginLeft:8}} onClick={handleOpenReputationModal}>Vérifier</Button>
                    </li>
                    <li>Configurez correctement SPF, DKIM et DMARC pour votre domaine</li>
                </ul>
            </div>

            {/* Email Check Modal */}
            <Modal show={showEmailModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Vérifier une adresse email</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleCheckEmail}>
                        <Form.Group className="mb-3">
                            <Form.Label>Adresse email à vérifier</Form.Label>
                            <Form.Control
                                type="email"
                                value={emailToCheck}
                                onChange={e => setEmailToCheck(e.target.value)}
                                placeholder="exemple@domaine.com"
                                required
                            />
                        </Form.Group>
                        <Button type="submit" variant="primary" disabled={checking || !emailToCheck} className="w-100">
                            {checking ? <Spinner as="span" animation="border" size="sm" /> : 'Vérifier'}
                        </Button>
                    </Form>
                    {checkResult && (
                        <Alert variant={checkResult.valid ? 'success' : 'danger'} className="mt-3">
                            {checkResult.valid ? (
                                <>
                                    ✅ Adresse valide<br/>
                                    <b>Adresse normalisée:</b> {checkResult.normalized}<br/>
                                    <b>MX trouvé:</b> {checkResult.mx_found ? 'Oui' : 'Non'}<br/>
                                    <b>Type de compte:</b> {checkResult.account_type === 'gmail' ? 'Gmail gratuit' : checkResult.account_type === 'workspace' ? 'Google Workspace' : 'Autre'}<br/>
                                    <b>Limite quotidienne:</b> {checkResult.daily_limit ? checkResult.daily_limit + ' emails/jour' : 'Inconnue'}
                                </>
                            ) : (
                                <>
                                    ❌ Adresse invalide<br/>
                                    <b>Raison:</b> {checkResult.reason}
                                </>
                            )}
                        </Alert>
                    )}
                    {checkError && <Alert variant="danger" className="mt-3">{checkError}</Alert>}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>Fermer</Button>
                </Modal.Footer>
            </Modal>

            {/* Reputation Check Modal */}
            <Modal show={showReputationModal} onHide={handleCloseReputationModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Vérifier votre réputation d'expéditeur</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {reputation ? (
                        <div>
                            <p><b>Score de réputation :</b> {reputation.reputation_score.toFixed(1)} / 10</p>
                            <p><b>Statut :</b> {reputation.warmup_status}</p>
                            <p><b>Emails envoyés (total) :</b> {reputation.total_emails_sent}</p>
                            <p><b>Livraisons réussies :</b> {reputation.successful_deliveries}</p>
                            <p><b>Emails rejetés (bounces) :</b> {reputation.bounced_emails}</p>
                            <p><b>Signalements spam :</b> {reputation.spam_reports}</p>
                            <p><b>Dernier calcul :</b> {new Date(reputation.last_calculated).toLocaleString()}</p>
                        </div>
                    ) : (
                        <Alert variant="warning">Impossible de charger votre réputation. Veuillez réessayer plus tard.</Alert>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseReputationModal}>Fermer</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default AntiSpamWarnings;
