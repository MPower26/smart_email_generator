import React, { useState, useEffect } from 'react';
import { Card, Spinner } from 'react-bootstrap';
import './SystemInitialization.css';

const SystemInitialization = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const initializationSteps = [
    {
      title: "🚀 Initializing Smart Email System",
      description: "Starting up the AI-powered email generation engine...",
      duration: 2000
    },
    {
      title: "🔧 Loading Templates & Settings",
      description: "Preparing your personalized email templates...",
      duration: 1500
    },
    {
      title: "📊 Analyzing Contact Data",
      description: "Processing your contact list for optimal personalization...",
      duration: 1800
    },
    {
      title: "🤖 Warming Up AI Models",
      description: "Getting the AI ready to craft your perfect emails...",
      duration: 2200
    },
    {
      title: "✨ System Ready!",
      description: "Everything is set up and ready to generate your emails!",
      duration: 1000
    }
  ];

  const funFacts = [
    "Did you know? The first email was sent in 1971 by Ray Tomlinson! 📧",
    "Fun fact: Over 306 billion emails are sent every day worldwide! 🌍",
    "Interesting: The '@' symbol was chosen because it was rarely used in 1971! @",
    "Amazing: Email marketing has an average ROI of 3800%! 💰",
    "Cool fact: The word 'email' was first used in 1982! 📅",
    "Did you know? Personalized emails have 6x higher transaction rates! 📈",
    "Fun fact: 99% of email users check their inbox every day! 📱",
    "Interesting: The average person spends 2.5 hours checking email daily! ⏰"
  ];

  const [currentFunFact, setCurrentFunFact] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    
    // Rotate fun facts every 3 seconds
    const funFactInterval = setInterval(() => {
      setCurrentFunFact(prev => (prev + 1) % funFacts.length);
    }, 3000);

    // Progress through initialization steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < initializationSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stepInterval);
          clearInterval(funFactInterval);
          // Complete initialization after a short delay
          setTimeout(() => {
            setIsVisible(false);
            setTimeout(onComplete, 500); // Call onComplete after fade out
          }, 1000);
          return prev;
        }
      });
    }, 1000);

    return () => {
      clearInterval(stepInterval);
      clearInterval(funFactInterval);
    };
  }, [onComplete]);

  return (
    <div className={`system-initialization ${isVisible ? 'visible' : ''}`}>
      <Card className="initialization-card">
        <Card.Body className="text-center">
          <div className="initialization-header">
            <h3 className="mb-4">🎯 Smart Email Generator</h3>
            <p className="text-muted">Preparing your personalized email campaign...</p>
          </div>

          <div className="initialization-steps">
            {initializationSteps.map((step, index) => (
              <div
                key={index}
                className={`step-item ${index <= currentStep ? 'active' : ''} ${
                  index === currentStep ? 'current' : ''
                }`}
              >
                <div className="step-content">
                  <div className="step-icon">
                    {index < currentStep ? (
                      <span className="step-check">✅</span>
                    ) : index === currentStep ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <span className="step-pending">⏳</span>
                    )}
                  </div>
                  <div className="step-text">
                    <h6 className="step-title">{step.title}</h6>
                    <p className="step-description">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="fun-fact-container">
            <div className="fun-fact-slide">
              <p className="fun-fact-text">💡 {funFacts[currentFunFact]}</p>
            </div>
          </div>

          <div className="progress-indicator">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${((currentStep + 1) / initializationSteps.length) * 100}%` }}
              ></div>
            </div>
            <small className="text-muted">
              {currentStep + 1} of {initializationSteps.length} steps completed
            </small>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default SystemInitialization; 
