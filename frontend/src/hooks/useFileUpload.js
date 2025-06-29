import { useState, useRef } from 'react';
import { attachmentService } from '../services/api';

/**
 * Custom hook for file upload with progress tracking and ETA calculation
 * @param {Function} onSuccess - Callback called when upload succeeds
 * @param {Function} onError - Callback called when upload fails
 * @returns {Object} Upload state and functions
 */
export const useFileUpload = (onSuccess = null, onError = null) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [eta, setEta] = useState(null);
  
  // Refs for tracking upload timing
  const uploadStartTime = useRef(null);
  const lastProgressUpdate = useRef(null);
  const lastLoadedBytes = useRef(0);

  const uploadFile = async (file, placeholder, category = null) => {
    setUploading(true);
    setProgress(0);
    setError('');
    setSuccess('');
    setFileSize(file.size);
    setUploadSpeed(0);
    setEta(null);
    
    // Reset refs
    uploadStartTime.current = Date.now();
    lastProgressUpdate.current = Date.now();
    lastLoadedBytes.current = 0;

    try {
      await attachmentService.uploadAttachment(
        file,
        placeholder,
        category,
        (evt) => {
          const now = Date.now();
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setProgress(percent);
          
          // Calculate upload speed
          if (lastProgressUpdate.current && evt.loaded > lastLoadedBytes.current) {
            const timeDiff = (now - lastProgressUpdate.current) / 1000; // seconds
            const bytesDiff = evt.loaded - lastLoadedBytes.current;
            
            if (timeDiff > 0) {
              const currentSpeed = bytesDiff / timeDiff;
              setUploadSpeed(currentSpeed);
              
              // Calculate ETA
              const remainingBytes = evt.total - evt.loaded;
              if (currentSpeed > 0) {
                const remainingSeconds = remainingBytes / currentSpeed;
                const etaTime = new Date(now + remainingSeconds * 1000);
                setEta(etaTime.toISOString());
              }
            }
          }
          
          lastProgressUpdate.current = now;
          lastLoadedBytes.current = evt.loaded;
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
      setTimeout(() => {
        setProgress(0);
        setFileSize(0);
        setUploadSpeed(0);
        setEta(null);
      }, 2000);
    }
  };

  const reset = () => {
    setUploading(false);
    setProgress(0);
    setError('');
    setSuccess('');
    setFileSize(0);
    setUploadSpeed(0);
    setEta(null);
  };

  return {
    uploading,
    progress,
    error,
    success,
    fileSize,
    uploadSpeed,
    eta,
    uploadFile,
    reset
  };
}; 
