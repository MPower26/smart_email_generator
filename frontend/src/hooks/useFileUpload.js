import { useState, useRef } from 'react';
import { attachmentService } from '../services/api';

/**
 * Custom hook for file upload with progress tracking, ETA calculation, and chunked upload for large files
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
  const [uploadMode, setUploadMode] = useState(''); // 'direct' or 'chunked'
  
  // Refs for tracking upload timing
  const uploadStartTime = useRef(null);
  const lastProgressUpdate = useRef(null);
  const lastLoadedBytes = useRef(0);

  // Chunk size: 10MB to stay well under Azure's 5-minute timeout
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_DIRECT_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

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
      // Determine upload mode based on file size
      if (file.size > MAX_DIRECT_UPLOAD_SIZE) {
        setUploadMode('chunked');
        await uploadFileInChunks(file, placeholder, category);
      } else {
        setUploadMode('direct');
        await uploadFileDirect(file, placeholder, category);
      }

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
        setUploadMode('');
      }, 2000);
    }
  };

  const uploadFileDirect = async (file, placeholder, category) => {
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
  };

  const uploadFileInChunks = async (file, placeholder, category) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedBytes = 0;
    
    console.log(`📦 Starting chunked upload: ${totalChunks} chunks of ${CHUNK_SIZE / (1024 * 1024)}MB each`);
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      console.log(`📤 Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunk.size / (1024 * 1024)}MB)`);
      
      // Create a new file object for this chunk
      const chunkFile = new File([chunk], `${file.name}.part${chunkIndex}`, {
        type: file.type
      });
      
      // Upload this chunk
      await attachmentService.uploadAttachment(
        chunkFile,
        `${placeholder}_chunk_${chunkIndex}`,
        category,
        (evt) => {
          // Calculate overall progress including previous chunks
          const chunkProgress = (evt.loaded / evt.total) * (CHUNK_SIZE / file.size);
          const overallProgress = ((uploadedBytes + evt.loaded) / file.size) * 100;
          setProgress(Math.round(overallProgress));
          
          // Update speed calculation
          const now = Date.now();
          if (lastProgressUpdate.current) {
            const timeDiff = (now - lastProgressUpdate.current) / 1000;
            const bytesDiff = evt.loaded;
            
            if (timeDiff > 0) {
              const currentSpeed = bytesDiff / timeDiff;
              setUploadSpeed(currentSpeed);
              
              // Calculate ETA for remaining chunks
              const remainingBytes = file.size - uploadedBytes - evt.loaded;
              if (currentSpeed > 0) {
                const remainingSeconds = remainingBytes / currentSpeed;
                const etaTime = new Date(now + remainingSeconds * 1000);
                setEta(etaTime.toISOString());
              }
            }
          }
          
          lastProgressUpdate.current = now;
        }
      );
      
      uploadedBytes += chunk.size;
      
      // Small delay between chunks to avoid overwhelming the server
      if (chunkIndex < totalChunks - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Chunked upload completed: ${uploadedBytes / (1024 * 1024)}MB uploaded`);
  };

  const reset = () => {
    setUploading(false);
    setProgress(0);
    setError('');
    setSuccess('');
    setFileSize(0);
    setUploadSpeed(0);
    setEta(null);
    setUploadMode('');
  };

  return {
    uploading,
    progress,
    error,
    success,
    fileSize,
    uploadSpeed,
    eta,
    uploadMode,
    uploadFile,
    reset
  };
}; 
