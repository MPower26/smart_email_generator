import React, { useState, useEffect } from 'react';
import { ProgressBar, Card, Badge, Spinner } from 'react-bootstrap';

const ProgressTracker = ({ 
  type, // 'upload', 'generation', 'sending'
  current = 0,
  total = 0,
  fileSize = 0,
  startTime = null,
  speed = 0,
  status = 'idle', // 'idle', 'processing', 'completed', 'error', 'retrying'
  retryCount = 0,
  retryDelay = 0
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState(0);

  useEffect(() => {
    let interval;
    if (startTime && status === 'processing') {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
        
        // Calculate estimated time left
        if (current > 0 && speed > 0) {
          const remaining = total - current;
          const estimatedSeconds = Math.ceil(remaining / speed);
          setEstimatedTimeLeft(estimatedSeconds);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [startTime, status, current, total, speed]);

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (speed) => {
    if (type === 'upload') {
      return `${formatFileSize(speed)}/s`;
    } else {
      return `${speed.toFixed(1)} items/s`;
    }
  };

  const getProgressVariant = () => {
    switch (status) {
      case 'completed': return 'success';
      case 'error': return 'danger';
      case 'processing': return 'primary';
      case 'retrying': return 'warning';
      default: return 'secondary';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'processing': return <Spinner animation="border" size="sm" />;
      case 'retrying': return <Spinner animation="grow" size="sm" variant="warning" />;
      default: return '⏳';
    }
  };

  const getTypeTitle = () => {
    switch (type) {
      case 'upload': return 'File Upload';
      case 'generation': return 'Email Generation';
      case 'sending': return 'Email Sending';
      default: return 'Processing';
    }
  };

  const getTypeDescription = () => {
    switch (type) {
      case 'upload': return 'Uploading contact list';
      case 'generation': return 'Generating personalized emails';
      case 'sending': return 'Sending emails via Gmail';
      default: return 'Processing data';
    }
  };

  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex align-items-center">
            <span className="me-2">{getStatusIcon()}</span>
            <h6 className="mb-0">{getTypeTitle()}</h6>
            <Badge 
              bg={getProgressVariant()} 
              className="ms-2"
            >
              {status}
            </Badge>
          </div>
          <small className="text-muted">
            {current}/{total} {type === 'upload' ? 'bytes' : 'items'}
          </small>
        </div>

        <p className="text-muted small mb-2">{getTypeDescription()}</p>

        <ProgressBar 
          now={progress} 
          variant={getProgressVariant()}
          className="mb-2"
        />

        <div className="row text-center">
          <div className="col-4">
            <small className="text-muted d-block">Progress</small>
            <strong>{progress.toFixed(1)}%</strong>
          </div>
          <div className="col-4">
            <small className="text-muted d-block">Speed</small>
            <strong>{formatSpeed(speed)}</strong>
          </div>
          <div className="col-4">
            <small className="text-muted d-block">Time Left</small>
            <strong>{formatTime(estimatedTimeLeft)}</strong>
          </div>
        </div>

        {type === 'upload' && fileSize > 0 && (
          <div className="mt-2 text-center">
            <small className="text-muted">
              File size: {formatFileSize(fileSize)} | 
              Elapsed: {formatTime(elapsedTime)}
            </small>
          </div>
        )}

        {type === 'generation' && (
          <div className="mt-2 text-center">
            <small className="text-muted">
              Elapsed: {formatTime(elapsedTime)} | 
              ETA: {formatTime(estimatedTimeLeft)}
            </small>
          </div>
        )}

        {status === 'retrying' && (
          <div className="mt-2 text-center">
            <small className="text-warning">
              Connection lost. Retrying in {Math.ceil(retryDelay / 1000)}s... (Attempt {retryCount}/5)
            </small>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default ProgressTracker; 
