import React, { useState, useContext, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { emailService } from '../services/api';
import { UserContext } from '../contexts/UserContext';

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
      console.error('Error loading cache information:', err);
      setCacheError('Unable to load cache information. Please try again.');
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
      console.error('Error clearing cache:', err);
      setCacheError('Unable to clear cache. Please try again.');
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
      <h1 className="page-title">Settings</h1>

      <Row className="mb-5">
        <Col md={8}>
          <div className="form-section">
            <h3 className="section-title">Personal Information</h3>
            <p className="text-muted mb-4">
              This information will be used to personalize the generated emails.
            </p>
            
            <Form>
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group controlId="formName">
                    <Form.Label>Your Name</Form.Label>
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
                    <Form.Label>Your Email</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="john.doe@example.com"
                      name="email"
                      value={profile.email}
                      onChange={handleInputChange}
                      disabled
                    />
                    <Form.Text className="text-muted">
                      Email cannot be modified
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group controlId="formPosition">
                    <Form.Label>Your Position/Title</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Sales Director"
                      name="position"
                      value={profile.position}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="formCompanyName">
                    <Form.Label>Company Name</Form.Label>
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
                <Form.Label>Company Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="A brief description of your company, its activities and value proposition..."
                  name="company_description"
                  value={profile.company_description}
                  onChange={handleInputChange}
                />
              </Form.Group>

              {saveSuccess && (
                <Alert variant="success" className="mb-3">
                  Your information has been saved successfully!
                </Alert>
              )}

              <div className="d-flex justify-content-end">
                <Button variant="primary" onClick={handleSaveProfile}>
                  Save
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
              <h4 className="mb-0">Gmail Integration</h4>
            </Card.Header>
            <Card.Body>
              <p className="text-muted mb-4">
                Connect your Gmail account to send emails directly from the application.
              </p>
              
              <div className="d-flex align-items-center mb-3">
                <div className="me-3">
                  {gmailConnected ? (
                    <Alert variant="success" className="mb-0 py-2">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      Gmail Connected
                    </Alert>
                  ) : (
                    <Alert variant="warning" className="mb-0 py-2">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      Gmail Not Connected
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
                      Connecting...
                    </>
                  ) : gmailConnected ? (
                    "Reconnect Gmail"
                  ) : (
                    "Connect Gmail"
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
              <h4 className="mb-0">Cache Management</h4>
            </Card.Header>
            <Card.Body>
              <p>
                The application caches email generation results to improve performance. 
                You can clear the cache if needed.
              </p>

              {cacheError && (
                <Alert variant="danger" className="mb-3">
                  {cacheError}
                </Alert>
              )}

              {loadingCache ? (
                <div className="text-center my-3">
                  <Spinner animation="border" size="sm" />
                  <span className="ms-2">Loading...</span>
                </div>
              ) : cacheInfo ? (
                <div className="mb-3">
                  <p><strong>Cache Size:</strong> {cacheInfo.size || '0'} entries</p>
                  <p><strong>Last Updated:</strong> {cacheInfo.lastUpdated || 'Never'}</p>
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
                    Clearing...
                  </>
                ) : 'Clear Cache'}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card>
            <Card.Header>
              <h4 className="mb-0">About</h4>
            </Card.Header>
            <Card.Body>
              <p><strong>Application Version:</strong> 1.0.0</p>
              <p>
                This application allows you to generate personalized emails from contact lists,
                using AI or predefined templates.
              </p>
              <p>
                For any questions or assistance, please contact the system administrator.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <Card className="mb-4 compte-card">
          <Card.Header>Account</Card.Header>
          <Card.Body>
            <Button variant="danger" onClick={logout}>
              Sign Out
            </Button>
          </Card.Body>
        </Card>
      </div>
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
        <h4 className="mb-0">Followup Intervals</h4>
      </Card.Header>
      <Card.Body>
        <Form>
          <Form.Group controlId="followupInterval">
            <Form.Label>Days before followup</Form.Label>
            <Form.Control
              type="number"
              value={followup}
              min={1}
              max={30}
              onChange={e => setFollowup(Number(e.target.value))}
            />
          </Form.Group>
          <Form.Group controlId="lastchanceInterval" className="mt-3">
            <Form.Label>Days before last chance</Form.Label>
            <Form.Control
              type="number"
              value={lastchance}
              min={1}
              max={30}
              onChange={e => setLastchance(Number(e.target.value))}
            />
          </Form.Group>
          <Button className="mt-3" onClick={update}>Update</Button>
        </Form>
      </Card.Body>
    </Card>
  );
}
export default SettingsPage; 


