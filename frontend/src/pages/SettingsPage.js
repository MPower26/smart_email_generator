import React, { useState, useContext, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { emailService } from '../services/api';
import { UserContext } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net';

const SettingsPage = () => {
  const { userProfile, updateUserProfile, fetchUserProfile, logout } = useContext(UserContext);
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    position: '',
    company_name: '',
    company_description: ''
  });
  const [cacheInfo, setCacheInfo] = useState(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheError, setCacheError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(false);
  const navigate = useNavigate();
  const [showGmailPopup, setShowGmailPopup] = useState(() => {
    return !sessionStorage.getItem('hermes_gmail_popup_shown');
  });
  const [pendingGmailConnect, setPendingGmailConnect] = useState(false);

  // Charger le profil utilisateur au démarrage
  useEffect(() => {
    if (userProfile) {
      setProfile({
        full_name: userProfile.full_name || '',
        email: userProfile.email || '',
        position: userProfile.position || '',
        company_name: userProfile.company_name || '',
        company_description: userProfile.company_description || ''
      });
      // Check if Gmail is connected
      setGmailConnected(!!userProfile.gmail_access_token);
    }
    fetchCacheInfo();
  }, [userProfile]);

  // Récupérer les informations du cache
  const fetchCacheInfo = async () => {
    setLoadingCache(true);
    setCacheError('');
    try {
      const result = await emailService.getCacheInfo();
      setCacheInfo(result);
    } catch (err) {
      console.error('Erreur lors du chargement des informations du cache:', err);
      setCacheError('Impossible de charger les informations du cache. Veuillez réessayer.');
    } finally {
      setLoadingCache(false);
    }
  };

  // Vider le cache
  const handleClearCache = async () => {
    setClearingCache(true);
    setCacheError('');
    try {
      await emailService.clearCache();
      fetchCacheInfo();
    } catch (err) {
      console.error('Erreur lors du vidage du cache:', err);
      setCacheError('Impossible de vider le cache. Veuillez réessayer.');
    } finally {
      setClearingCache(false);
    }
  };

  // Gérer les changements dans le formulaire de profil
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
    setSaveSuccess(false);
  };

  // Sauvegarder le profil utilisateur
  const handleSaveProfile = async () => {
    try {
      const updateData = {};
      
      // Only include fields that have changed
      if (profile.full_name !== userProfile?.full_name) {
        updateData.full_name = profile.full_name;
      }
      if (profile.position !== userProfile?.position) {
        updateData.position = profile.position;
      }
      if (profile.company_name !== userProfile?.company_name) {
        updateData.company_name = profile.company_name;
      }
      if (profile.company_description !== userProfile?.company_description) {
        updateData.company_description = profile.company_description;
      }

      // Only make the request if there are changes
      if (Object.keys(updateData).length > 0) {
        await updateUserProfile(updateData);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setCacheError('Failed to update profile. Please try again.');
      setTimeout(() => setCacheError(''), 3000);
    }
  };

  // Gmail connection handler
  const handleConnectGmail = async () => {
    if (!sessionStorage.getItem('hermes_gmail_popup_shown')) {
      setShowGmailPopup(true);
      setPendingGmailConnect(true);
      return;
    }
    setGmailLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/gmail/auth/start?email=${encodeURIComponent(userProfile.email)}`);
      const data = await res.json();
      window.open(data.auth_url, "_blank", "width=500,height=600");
      
      // Listen for the OAuth callback
      const checkConnection = setInterval(async () => {
        try {
          await fetchUserProfile(); // Refresh user profile
          if (userProfile?.gmail_access_token) {
            setGmailConnected(true);
            clearInterval(checkConnection);
            setGmailLoading(false);
          }
        } catch (err) {
          console.error('Error checking Gmail connection:', err);
        }
      }, 2000);
      
      // Stop checking after 5 minutes
      setTimeout(() => {
        clearInterval(checkConnection);
        setGmailLoading(false);
      }, 300000);
      
    } catch (error) {
      console.error('Error starting Gmail auth:', error);
      setGmailLoading(false);
    }
  };

  return (
    <Container>
      <h1 className="page-title">Paramètres</h1>

      <Row className="mb-5">
        <Col md={8}>
          <div className="form-section">
            <h3 className="section-title">Informations personnelles</h3>
            <p className="text-muted mb-4">
              Ces informations seront utilisées pour personnaliser les emails générés.
            </p>
            
            <Form>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group controlId="formName">
                    <Form.Label>Votre nom</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="John Doe"
                      name="full_name"
                      value={profile.full_name}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="formEmail">
                    <Form.Label>Votre email</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="john.doe@example.com"
                      name="email"
                      value={profile.email}
                      onChange={handleInputChange}
                      disabled
                    />
                    <Form.Text className="text-muted">
                      L'email ne peut pas être modifié
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group controlId="formPosition">
                    <Form.Label>Votre poste/fonction</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Directeur Commercial"
                      name="position"
                      value={profile.position}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="formCompanyName">
                    <Form.Label>Nom de votre entreprise</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Acme Inc."
                      name="company_name"
                      value={profile.company_name}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-4" controlId="formCompanyDescription">
                <Form.Label>Description de votre entreprise</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Une brève description de votre entreprise, ses activités et sa proposition de valeur..."
                  name="company_description"
                  value={profile.company_description}
                  onChange={handleInputChange}
                />
              </Form.Group>

              {saveSuccess && (
                <Alert variant="success" className="mb-3">
                  Vos informations ont été sauvegardées avec succès!
                </Alert>
              )}

              <div className="d-flex justify-content-end">
                <Button variant="primary" onClick={handleSaveProfile}>
                  Sauvegarder
                </Button>
              </div>
            </Form>
          </div>
        </Col>
      </Row>

      {/* Gmail Integration Section */}
      <Row className="mb-5">
        <Col md={8}>
          <Card>
            <Card.Header>
              <h4 className="mb-0">Intégration Gmail</h4>
            </Card.Header>
            <Card.Body>
              <p className="text-muted mb-4">
                Connectez votre compte Gmail pour envoyer des emails directement depuis l'application.
              </p>
              
              <div className="d-flex align-items-center mb-3">
                <div className="me-3">
                  {gmailConnected ? (
                    <Alert variant="success" className="mb-0 py-2">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      Gmail connecté
                    </Alert>
                  ) : (
                    <Alert variant="warning" className="mb-0 py-2">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      Gmail non connecté
                    </Alert>
                  )}
                </div>
                
                <Button 
                  variant={gmailConnected ? "outline-secondary" : "primary"}
                  onClick={handleConnectGmail}
                  disabled={gmailLoading}
                >
                  {gmailLoading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Connexion...
                    </>
                  ) : gmailConnected ? (
                    "Reconnecter Gmail"
                  ) : (
                    "Connecter Gmail"
                  )}
                </Button>
              </div>

              {/* Followup Intervals */}
              <FollowupIntervals user={userProfile} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <h4 className="mb-0">Gestion du cache</h4>
            </Card.Header>
            <Card.Body>
              <p>
                L'application stocke en cache les résultats de génération d'emails pour améliorer les performances. 
                Vous pouvez vider le cache si nécessaire.
              </p>

              {cacheError && (
                <Alert variant="danger" className="mb-3">
                  {cacheError}
                </Alert>
              )}

              {loadingCache ? (
                <div className="text-center my-3">
                  <Spinner animation="border" size="sm" />
                  <span className="ms-2">Chargement...</span>
                </div>
              ) : cacheInfo ? (
                <div className="mb-3">
                  <p><strong>Taille du cache:</strong> {cacheInfo.size || '0'} entrées</p>
                  <p><strong>Dernière mise à jour:</strong> {cacheInfo.lastUpdated || 'Jamais'}</p>
                </div>
              ) : null}

              <Button 
                variant="outline-danger" 
                onClick={handleClearCache}
                disabled={clearingCache || !cacheInfo || cacheInfo.size === 0}
              >
                {clearingCache ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Nettoyage...
                  </>
                ) : 'Vider le cache'}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card>
            <Card.Header>
              <h4 className="mb-0">À propos</h4>
            </Card.Header>
            <Card.Body>
              <p><strong>Version de l'application:</strong> 1.0.0</p>
              <p>
                Cette application permet de générer des emails personnalisés à partir de listes de contacts,
                en utilisant l'IA ou des templates prédéfinis.
              </p>
              <p>
                Pour toute question ou assistance, veuillez contacter l'administrateur système.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <Card className="mb-4 compte-card">
          <Card.Header>Compte</Card.Header>
          <Card.Body>
            <Button variant="danger" onClick={logout}>
              Se déconnecter
            </Button>
          </Card.Body>
        </Card>
      </div>

      <Modal show={showGmailPopup} onHide={() => setShowGmailPopup(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Before you connect Gmail</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>For best deliverability, we recommend testing your email address before connecting and sending emails.</strong><br/>
            Use the <b>Spam Verification</b> tool to check your domain's health and avoid spam issues.<br/>
            <a href="#" onClick={e => { e.preventDefault(); setShowGmailPopup(false); navigate('/spam-verification'); }}>Go to Spam Verification</a>
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => {
            sessionStorage.setItem('hermes_gmail_popup_shown', '1');
            setShowGmailPopup(false);
            if (pendingGmailConnect) {
              setPendingGmailConnect(false);
              setTimeout(() => handleConnectGmail(), 0);
            }
          }}>
            Continue to Gmail connection
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

function FollowupIntervals({ user }) {
  const [followup, setFollowup] = useState(user?.followup_interval_days || 3);
  const [lastchance, setLastchance] = useState(user?.lastchance_interval_days || 6);

  const update = async () => {
    await fetch(`${BACKEND_URL}/api/settings/update_intervals`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ followup_days: followup, lastchance_days: lastchance })
    });
    alert("Intervals updated!");
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <h4 className="mb-0">Délais de relance</h4>
      </Card.Header>
      <Card.Body>
        <Form>
          <Form.Group controlId="followupInterval">
            <Form.Label>Délai avant relance (jours)</Form.Label>
            <Form.Control
              type="number"
              value={followup}
              min={1}
              max={30}
              onChange={e => setFollowup(Number(e.target.value))}
            />
          </Form.Group>
          <Form.Group controlId="lastchanceInterval" className="mt-3">
            <Form.Label>Délai avant dernier rappel (jours)</Form.Label>
            <Form.Control
              type="number"
              value={lastchance}
              min={1}
              max={30}
              onChange={e => setLastchance(Number(e.target.value))}
            />
          </Form.Group>
          <Button className="mt-3" onClick={update}>Mettre à jour</Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
export default SettingsPage; 

