import React, { useState, useEffect } from 'react';
import { ProgressBar } from 'react-bootstrap';

/**
 * Reusable upload progress bar component with ETA and countdown
 * @param {Object} props
 * @param {number} props.progress - Upload progress percentage (0-100)
 * @param {boolean} props.show - Whether to show the progress bar
 * @param {string} props.filename - Name of the file being uploaded
 * @param {string} props.variant - Bootstrap variant (primary, success, etc.)
 * @param {boolean} props.animated - Whether to animate the progress bar
 * @param {boolean} props.striped - Whether to show striped pattern
 * @param {number} props.fileSize - File size in bytes
 * @param {number} props.uploadSpeed - Upload speed in bytes per second
 * @param {string} props.eta - Estimated time of arrival (ISO string)
 */
const UploadProgressBar = ({ 
  progress, 
  show, 
  filename, 
  variant = "primary", 
  animated = true, 
  striped = true,
  fileSize,
  uploadSpeed,
  eta
}) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [etaString, setEtaString] = useState('');

  // Calculate time remaining and format ETA
  useEffect(() => {
    if (eta && progress > 0 && progress < 100) {
      const now = new Date();
      const etaDate = new Date(eta);
      const remainingMs = etaDate.getTime() - now.getTime();
      
      if (remainingMs > 0) {
        setTimeRemaining(Math.ceil(remainingMs / 1000));
        
        // Format ETA as HH:MM:SS
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
        
        setEtaString(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }
  }, [eta, progress]);

  // Update countdown every second
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [timeRemaining]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Format upload speed
  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond) return '';
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
    return `${(bytesPerSecond / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (!show) return null;

  return (
    <div className="mt-3">
      <ProgressBar 
        now={progress} 
        label={`${progress}%`} 
        animated={animated}
        striped={striped}
        variant={variant}
      />
      
      <div className="mt-2">
        {filename && (
          <small className="text-muted d-block">
            📁 Uploading: {filename}
          </small>
        )}
        
        {fileSize && (
          <small className="text-muted d-block">
            📊 Size: {formatFileSize(fileSize)}
          </small>
        )}
        
        {uploadSpeed && progress > 0 && (
          <small className="text-muted d-block">
            ⚡ Speed: {formatSpeed(uploadSpeed)}
          </small>
        )}
        
        {timeRemaining !== null && timeRemaining > 0 && (
          <small className="text-info d-block">
            ⏰ ETA: {etaString} remaining
          </small>
        )}
        
        {progress === 100 && (
          <small className="text-success d-block">
            ✅ Upload completed!
          </small>
        )}
      </div>
    </div>
  );
};

export default UploadProgressBar; 
