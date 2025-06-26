import React, { useState, useEffect } from 'react';
import { Card, Spinner } from 'react-bootstrap';
import './SystemInitialization.css';

const SystemInitialization = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showSlotMachine, setShowSlotMachine] = useState(true);
  const [slotMachineMessages, setSlotMachineMessages] = useState([]);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);

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

  const slotMachineFacts = [
    "🎯 Preparing AI models for email generation...",
    "📧 Loading personalized templates...",
    "🔍 Analyzing contact data patterns...",
    "⚡ Optimizing email content algorithms...",
    "🎨 Crafting unique email variations...",
    "📊 Processing engagement metrics...",
    "🤖 Training neural networks...",
    "💡 Generating creative subject lines...",
    "📱 Optimizing for mobile devices...",
    "🎪 Finalizing email sequences...",
    "🚀 Launching email generation engine...",
    "✨ System initialization complete!"
  ];

  const [currentFunFact, setCurrentFunFact] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    
    // Start slot machine effect
    const slotInterval = setInterval(() => {
      setCurrentSlotIndex(prev => {
        if (prev < slotMachineFacts.length - 1) {
          return prev + 1;
        } else {
          // Slot machine effect complete, show normal initialization
          setShowSlotMachine(false);
          clearInterval(slotInterval);
          return prev;
        }
      });
    }, 150); // Fast slot machine effect

    // Rotate fun facts every 3 seconds (only after slot machine)
    const funFactInterval = setInterval(() => {
      if (!showSlotMachine) {
        setCurrentFunFact(prev => (prev + 1) % slotMachineFacts.length);
      }
    }, 3000);

    // Progress through initialization steps (only after slot machine)
    const stepInterval = setInterval(() => {
      if (!showSlotMachine) {
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
      }
    }, 1000);

    return () => {
      clearInterval(slotInterval);
      clearInterval(stepInterval);
      clearInterval(funFactInterval);
    };
  }, [onComplete, showSlotMachine]);

  return (
    <div className={`system-initialization ${isVisible ? 'visible' : ''}`}>
      <Card className="initialization-card">
        <Card.Body className="text-center">
          <div className="initialization-header">
            <h3 className="mb-4">🎯 Smart Email Generator</h3>
            <p className="text-muted">Preparing your personalized email campaign...</p>
          </div>

          {showSlotMachine ? (
            // Slot Machine Effect
            <div className="slot-machine-container">
              <div className="slot-machine-message">
                <div className="slot-machine-text">
                  {slotMachineFacts[currentSlotIndex]}
                </div>
              </div>
              <div className="slot-machine-indicator">
                <div className="slot-dots">
                  {slotMachineFacts.map((_, index) => (
                    <div 
                      key={index} 
                      className={`slot-dot ${index === currentSlotIndex ? 'active' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Normal Initialization Steps
            <>
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
                  <p className="fun-fact-text">💡 {slotMachineFacts[currentFunFact]}</p>
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
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default SystemInitialization; 
