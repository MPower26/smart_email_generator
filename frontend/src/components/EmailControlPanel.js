import React, { useState } from 'react';
import { Card, Button, Badge, Alert } from 'react-bootstrap';
import { emailService } from '../services/api';
import './EmailControlPanel.css';

const EmailControlPanel = ({ 
  isGenerating, 
  isSending, 
  currentProgress, 
  onPause, 
  onResume, 
  onStop,
  onRefresh 
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState(null);

  const handlePause = async () => {
    try {
      setError(null);
      setIsPaused(true);
      if (onPause) {
        await onPause();
      }
    } catch (err) {
      setError('Failed to pause email generation. Please try again.');
      setIsPaused(false);
    }
  };

  const handleResume = async () => {
    try {
      setError(null);
      setIsPaused(false);
      if (onResume) {
        await onResume();
      }
    } catch (err) {
      setError('Failed to resume email generation. Please try again.');
      setIsPaused(true);
    }
  };

  const handleStop = async () => {
    if (window.confirm('Are you sure you want to stop the email generation? This action cannot be undone.')) {
      try {
        setError(null);
        setIsStopping(true);
        if (onStop) {
          await onStop();
        }
      } catch (err) {
        setError('Failed to stop email generation. Please try again.');
        setIsStopping(false);
      }
    }
  };

  const getStatusBadge = () => {
    if (isStopping) return <Badge bg="warning">Stopping...</Badge>;
    if (isPaused) return <Badge bg="secondary">Paused</Badge>;
    if (isGenerating) return <Badge bg="primary">Generating</Badge>;
    if (isSending) return <Badge bg="info">Sending</Badge>;
    return <Badge bg="success">Ready</Badge>;
  };

  const getProgressText = () => {
    if (!currentProgress) return 'No active process';
    
    const { current, total, status } = currentProgress;
    if (total === 0) return 'Initializing...';
    
    const percentage = Math.round((current / total) * 100);
    return `${current}/${total} (${percentage}%)`;
  };

  const canPause = (isGenerating || isSending) && !isPaused && !isStopping;
  const canResume = (isGenerating || isSending) && isPaused && !isStopping;
  const canStop = (isGenerating || isSending) && !isStopping;

  return (
    <Card className="email-control-panel">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <i className="fas fa-cogs me-2"></i>
          Email Control Panel
        </h6>
        {getStatusBadge()}
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div className="control-status">
          <div className="status-item">
            <span className="status-label">Status:</span>
            <span className="status-value">{getStatusBadge()}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Progress:</span>
            <span className="status-value">{getProgressText()}</span>
          </div>
        </div>

        <div className="control-buttons">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handlePause}
            disabled={!canPause}
            className="control-btn"
          >
            <i className="fas fa-pause me-1"></i>
            Pause
          </Button>

          <Button
            variant="outline-success"
            size="sm"
            onClick={handleResume}
            disabled={!canResume}
            className="control-btn"
          >
            <i className="fas fa-play me-1"></i>
            Resume
          </Button>

          <Button
            variant="outline-danger"
            size="sm"
            onClick={handleStop}
            disabled={!canStop}
            className="control-btn"
          >
            <i className="fas fa-stop me-1"></i>
            Stop
          </Button>

          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onRefresh}
            className="control-btn"
          >
            <i className="fas fa-sync-alt me-1"></i>
            Refresh
          </Button>
        </div>

        <div className="control-info">
          <small className="text-muted">
            <i className="fas fa-info-circle me-1"></i>
            You can pause the process at any time and resume later. 
            Stopping will cancel the current operation.
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default EmailControlPanel; 
