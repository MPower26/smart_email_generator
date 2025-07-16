import React, { useState, useRef, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Col, Row } from 'react-bootstrap';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';

const AuthScreen = () => {
  const { userProfile, authStep, setAuthStep, requestAuthCode, verifyAuthCode } = useUser();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeInputs, setCodeInputs] = useState(['', '', '', '', '', '']);
  const [showContent, setShowContent] = useState(false);
  
  // Initialize refs for code inputs
  const codeRef1 = useRef(null);
  const codeRef2 = useRef(null);
  const codeRef3 = useRef(null);
  const codeRef4 = useRef(null);
  const codeRef5 = useRef(null);
  const codeRef6 = useRef(null);
  const codeRefs = [codeRef1, codeRef2, codeRef3, codeRef4, codeRef5, codeRef6];
  
  // If we're at the code step, get email from profile
  useEffect(() => {
    if (authStep === 'code' && userProfile && userProfile.email) {
      setEmail(userProfile.email);
    }
  }, [authStep, userProfile]);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 700);
    return () => clearTimeout(timer);
  }, []);
  
  // Handle code input with auto-focus
  const handleCodeInput = (index, value) => {
    if (value.length > 1) {
      value = value.slice(0, 1); // Limit to one character
    }
    
    // Verify it's a number
    if (value && !/^\d+$/.test(value)) {
      return;
    }
    
    const newInputs = [...codeInputs];
    newInputs[index] = value;
    setCodeInputs(newInputs);
    
    // Focus next field if we entered a number
    if (value && index < 5) {
      codeRefs[index + 1].current.focus();
    }
    
    // Assemble full code
    const fullCode = newInputs.join('');
    setCode(fullCode);
  };
  
  // Handle paste event
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    
    // Only accept if it's a 6-digit number
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setCodeInputs(digits);
      setCode(pastedData);
      
      // Focus the last input
      codeRefs[5].current.focus();
    }
  };
  
  // Handle special keys (backspace, etc)
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && index > 0 && !codeInputs[index]) {
      // If current field is empty and backspace is pressed, go to previous field
      codeRefs[index - 1].current.focus();
    }
  };
  
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const success = await requestAuthCode(email);
      if (!success) {
        setError('Unable to send verification code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const success = await verifyAuthCode(email, code);
      if (success) {
        navigate('/');
      } else {
        setError('Invalid or expired code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Request new code
  const handleResendCode = async () => {
    setLoading(true);
    setError('');
    
    try {
      const success = await requestAuthCode(email);
      if (!success) {
        setError('Unable to send verification code');
      } else {
        // Reset code fields
        setCodeInputs(['', '', '', '', '', '']);
        setCode('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      {showContent && (
        <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
          <img src="/hermesslogo.svg" alt="Background Logo" className="background-logo" />
          <Card className="shadow fade-in-down" style={{ width: '900px', minHeight: '480px', transform: 'translateY(30px)' }}>
            <Card.Body className="p-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', alignSelf: 'flex-start' }}>
                <img src="/hermesslogo.svg" alt="Logo" style={{ height: '56px', width: '56px', marginRight: '12px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: '1.5rem' }}>
                <span style={{ fontFamily: 'Syne-ExtraBold, Syne, Poppins, sans-serif', fontWeight: 800, fontSize: '3.2rem', letterSpacing: '0.03em', textTransform: 'uppercase', color: '#D8400D', marginRight: '12px' }}>Hermes</span>
                <span style={{ fontSize: '1.1rem', color: '#888', fontWeight: 400, letterSpacing: '0.01em', alignSelf: 'flex-end' }}>powered by wesi</span>
              </div>
              <div className="text-center mb-4 fade-in-opacity" style={{ color: '#555', fontSize: '0.97rem', fontFamily: 'Poppins, sans-serif', maxWidth: '90%', margin: '0 auto', lineHeight: 1.5, width: '100%' }}>
                Harness AI to generate personalized, impactful emails tailored to each recipient. Effortlessly manage your contact lists, schedule and track follow-ups, and receive timely reminders for every stage of your outreach.
              </div>
              {error && <Alert variant="danger">{error}</Alert>}
              {authStep === 'email' && (
                <div className="fade-in-opacity-delayed" style={{ maxWidth: '420px', margin: '0 auto' }}>
                  <Form onSubmit={handleEmailSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label className="email-label">Email Address</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <Form.Text className="text-muted">
                        You will receive a verification code at this address.
                      </Form.Text>
                    </Form.Group>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="primary" 
                        type="submit" 
                        className="mt-3" 
                        disabled={loading}
                      >
                        {loading ? 'Sending...' : 'Get Verification Code'}
                      </Button>
                    </div>
                  </Form>
                </div>
              )}
              {authStep === 'code' && (
                <div className="fade-in-opacity-delayed" style={{ maxWidth: '420px', margin: '0 auto' }}>
                  <Form onSubmit={handleCodeSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label className="email-label">Verification Code</Form.Label>
                      <p className="text-muted small mb-3">
                        A 6-digit code has been sent to {email}
                      </p>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <Row className="g-2 mb-3" style={{ width: 'auto', minWidth: '240px' }}>
                          {codeInputs.map((digit, index) => (
                            <Col key={index} xs={2}>
                              <Form.Control
                                type="text"
                                maxLength="1"
                                className="text-center"
                                value={digit}
                                onChange={(e) => handleCodeInput(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                ref={codeRefs[index]}
                                required
                                style={{ fontSize: '1.2rem', fontWeight: '600' }}
                              />
                            </Col>
                          ))}
                        </Row>
                      </div>
                      <div className="text-center">
                        <Button
                          variant="link"
                          onClick={handleResendCode}
                          disabled={loading}
                          className="p-0 text-decoration-none"
                        >
                          Resend Code
                        </Button>
                      </div>
                    </Form.Group>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="primary" 
                        type="submit" 
                        className="mt-3" 
                        disabled={loading || code.length !== 6}
                      >
                        {loading ? 'Verifying...' : 'Verify Code'}
                      </Button>
                    </div>
                  </Form>
                </div>
              )}
            </Card.Body>
          </Card>
        </Container>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', width: '700px', margin: '0 auto', marginTop: '8px' }}>
        <span style={{ color: '#888', fontSize: '0.9rem', fontFamily: 'Poppins, sans-serif', letterSpacing: '0.5px', opacity: 0.72 }}>
          Powered by WesI Ltd.
        </span>
      </div>
    </>
  );
};

export default AuthScreen; 