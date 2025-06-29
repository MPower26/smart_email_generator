import { useState } from 'react';
import { attachmentService } from '../services/api';

/**
 * Custom hook for file upload with progress tracking
 * @param {Function} onSuccess - Callback called when upload succeeds
 * @param {Function} onError - Callback called when upload fails
 * @returns {Object} Upload state and functions
 */
export const useFileUpload = (onSuccess = null, onError = null) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const uploadFile = async (file, placeholder, category = null) => {
    setUploading(true);
    setProgress(0);
    setError('');
    setSuccess('');

    try {
      await attachmentService.uploadAttachment(
        file,
        placeholder,
        category,
        (evt) => {
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setProgress(percent);
        }
      );

      setSuccess('File uploaded successfully!');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to upload file.';
      setError(errorMessage);
      if (onError) {
        onError(err);
      }
    } finally {
      setUploading(false);
      // Keep progress for a moment to show completion
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const reset = () => {
    setUploading(false);
    setProgress(0);
    setError('');
    setSuccess('');
  };

  return {
    uploading,
    progress,
    error,
    success,
    uploadFile,
    reset
  };
}; 
