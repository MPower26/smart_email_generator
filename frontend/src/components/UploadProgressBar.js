import React from 'react';
import { ProgressBar } from 'react-bootstrap';

/**
 * Reusable upload progress bar component
 * @param {Object} props
 * @param {number} props.progress - Upload progress percentage (0-100)
 * @param {boolean} props.show - Whether to show the progress bar
 * @param {string} props.filename - Name of the file being uploaded
 * @param {string} props.variant - Bootstrap variant (primary, success, etc.)
 * @param {boolean} props.animated - Whether to animate the progress bar
 * @param {boolean} props.striped - Whether to show striped pattern
 */
const UploadProgressBar = ({ 
  progress, 
  show, 
  filename, 
  variant = "primary", 
  animated = true, 
  striped = true 
}) => {
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
      {filename && (
        <small className="text-muted mt-1 d-block">
          Uploading {filename}... {progress}% complete
        </small>
      )}
    </div>
  );
};

export default UploadProgressBar; 
