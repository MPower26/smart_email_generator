import React, { useState, useContext, useRef, useEffect } from 'react';
import { Container, Card, Form, Button, Alert, Col, Row } from 'react-bootstrap';
import { UserContext } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';

const AuthScreen = () => {
  const { userProfile, authStep, setAuthStep, requestAuthCode, verifyAuthCode } = useContext(UserContext);
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeInputs, setCodeInputs] = useState(['', '', '', '', '', '']);
  
  // Initialiser les refs pour les champs de code (hors du callback)
  const codeRef1 = useRef(null);
  const codeRef2 = useRef(null);
  const codeRef3 = useRef(null);
  const codeRef4 = useRef(null);
  const codeRef5 = useRef(null);
  const codeRef6 = useRef(null);
  const codeRefs = [codeRef1, codeRef2, codeRef3, codeRef4, codeRef5, codeRef6];
  
  // Si on est à l'étape du code, récupérer l'email du profil
  useEffect(() => {
    if (authStep === 'code' && userProfile && userProfile.email) {
      setEmail(userProfile.email);
    }
  }, [authStep, userProfile]);
  
  // Gérer le focus automatique sur les champs de code
  const handleCodeInput = (index, value) => {
    if (value.length > 1) {
      value = value.slice(0, 1); // Limiter à un caractère
    }
    
    // Vérifier que c'est un chiffre
    if (value && !/^\d+$/.test(value)) {
      return;
    }
    
    const newInputs = [...codeInputs];
    newInputs[index] = value;
    setCodeInputs(newInputs);
    
    // Focus sur le champ suivant si on a entré un chiffre
    if (value && index < 5) {
      codeRefs[index + 1].current.focus();
    }
    
    // Assembler le code complet
    const fullCode = newInputs.join('');
    setCode(fullCode);
  };
  
  // Gérer les touches spéciales (retour arrière, etc)
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && index > 0 && !codeInputs[index]) {
      // Si le champ actuel est vide et qu'on appuie sur backspace, aller au champ précédent
      codeRefs[index - 1].current.focus();
    }
  };
  
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Veuillez entrer votre adresse email');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const success = await requestAuthCode(email);
      if (!success) {
        setError('Impossible d\'envoyer le code d\'authentification');
      }
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Veuillez entrer le code à 6 chiffres');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const success = await verifyAuthCode(email, code);
      if (success) {
        navigate('/');
      } else {
        setError('Code invalide ou expiré');
      }
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Demander un nouveau code
  const handleResendCode = async () => {
    setLoading(true);
    setError('');
    
    try {
      const success = await requestAuthCode(email);
      if (!success) {
        setError('Impossible d\'envoyer le code d\'authentification');
      } else {
        // Réinitialiser les champs de code
        setCodeInputs(['', '', '', '', '', '']);
        setCode('');
      }
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
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
                <Form.Label>Adresse email</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="Entrez votre email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Form.Text className="text-muted">
                  Vous recevrez un code d'authentification sur cette adresse.
                </Form.Text>
              </Form.Group>
              
              <Button 
                variant="primary" 
                type="submit" 
                className="w-100 mt-3" 
                disabled={loading}
              >
                {loading ? 'Envoi en cours...' : 'Recevoir un code'}
              </Button>
            </Form>
          )}
          
          {authStep === 'code' && (
            <Form onSubmit={handleCodeSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Code d'authentification</Form.Label>
                <p className="text-white small mb-3">
                  Un code à 6 chiffres a été envoyé à {email}
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
                    Renvoyer le code
                  </Button>
                </div>
              </Form.Group>
              
              <Button 
                variant="primary" 
                type="submit" 
                className="w-100 mt-3" 
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Vérification...' : 'Vérifier le code'}
              </Button>
              
              <Button 
                variant="outline-secondary" 
                className="w-100 mt-2" 
                onClick={() => setAuthStep('email')}
                disabled={loading}
              >
                Modifier l'email
              </Button>
            </Form>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AuthScreen; 