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
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <Card className="shadow" style={{ width: '400px' }}>
        <Card.Body className="p-4">
          <h2 className="text-center mb-4">Email Generator</h2>
          
          {error && <Alert variant="danger">{error}</Alert>}
          
          {authStep === 'email' && (
            <Form onSubmit={handleEmailSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Email Address</Form.Label>
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
              
              <Button 
                variant="primary" 
                type="submit" 
                className="w-100 mt-3" 
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Get Verification Code'}
              </Button>
            </Form>
          )}
          
          {authStep === 'code' && (
            <Form onSubmit={handleCodeSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Verification Code</Form.Label>
                <p className="text-muted small mb-3">
                  A 6-digit code has been sent to {email}
                </p>
                
                <Row className="g-2 mb-3">
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
                      />
                    </Col>
                  ))}
                </Row>
                
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
              
              <Button 
                variant="primary" 
                type="submit" 
                className="w-100 mt-3" 
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
              
              <Button 
                variant="outline-secondary" 
                className="w-100 mt-2" 
                onClick={() => setAuthStep('email')}
                disabled={loading}
              >
                Change Email
              </Button>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AuthScreen; 