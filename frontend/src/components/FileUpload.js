import React, { useState, useRef } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';

const FileUpload = ({ onFileSelect, acceptedTypes = ".csv" }) => {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Handle file change via standard file input
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSetFile(selectedFile);
  };

  // Handle click on drop area to open file selector
  const handleAreaClick = () => {
    fileInputRef.current.click();
  };

  // Validate and set file
  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile) return;

    // Check file type
    const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
    const acceptedTypesArray = acceptedTypes
      .split(',')
      .map(type => type.trim().replace('.', '').toLowerCase());

    if (!acceptedTypesArray.includes(fileExtension)) {
      setError(`File type not allowed. Please choose a ${acceptedTypes} file`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError('');
    onFileSelect(selectedFile);
  };

  // Handle drag enter
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  // Handle drag leave
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div>
      <div 
        className={`file-upload-container ${dragActive ? 'border-primary' : ''}`}
        onClick={handleAreaClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Form.Group controlId="formFile" className="mb-3">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            accept={acceptedTypes}
            className="d-none"
          />
          <div className="text-center">
            <i className="bi bi-cloud-upload fs-1 text-secondary mb-3"></i>
            <p>Drag and drop your file here or click to select</p>
            <p className="text-muted small">Accepted file types: {acceptedTypes}</p>
          </div>
        </Form.Group>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      
      {file && (
        <div className="mt-3">
          <Alert variant="success">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>Selected file:</strong> {file.name}
              </div>
              <Button 
                variant="outline-danger" 
                size="sm" 
                onClick={() => {
                  setFile(null);
                  onFileSelect(null);
                }}
              >
                Remove
              </Button>
            </div>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default FileUpload; 