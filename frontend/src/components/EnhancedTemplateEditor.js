import React, { useState, useEffect, useRef, useContext } from 'react';
import { Form, Dropdown, Badge, Card, Row, Col } from 'react-bootstrap';
import { attachmentService } from '../services/api';
import { UserContext } from '../contexts/UserContext';

const EnhancedTemplateEditor = ({ 
  value, 
  onChange, 
  placeholder = "Write your email template here...",
  rows = 12,
  showPreview = true 
}) => {
  const { userProfile } = useContext(UserContext);
  const [attachments, setAttachments] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [currentInput, setCurrentInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [filteredAttachments, setFilteredAttachments] = useState([]);
  const textareaRef = useRef(null);
  const autocompleteRef = useRef(null);

  // Load user's attachments
  useEffect(() => {
    const loadAttachments = async () => {
      try {
        const response = await attachmentService.getAttachments();
        setAttachments(response.data || []);
      } catch (error) {
        console.error('Failed to load attachments:', error);
      }
    };
    loadAttachments();
  }, []);

  // Handle textarea changes
  const handleChange = (e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setCurrentInput(newValue);
    setCursorPosition(cursorPos);
    
    // Check if we should show autocomplete
    const beforeCursor = newValue.substring(0, cursorPos);
    const lastBracketIndex = beforeCursor.lastIndexOf('[');
    
    if (lastBracketIndex !== -1 && lastBracketIndex < cursorPos) {
      const searchTerm = beforeCursor.substring(lastBracketIndex + 1).toLowerCase();
      const filtered = attachments.filter(att => 
        att.placeholder.toLowerCase().includes(searchTerm)
      );
      
      if (filtered.length > 0) {
        setFilteredAttachments(filtered);
        setShowAutocomplete(true);
        
        // Calculate position for autocomplete dropdown
        const textarea = e.target;
        const textBeforeCursor = beforeCursor.substring(0, lastBracketIndex);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        
        // Estimate position (this is approximate)
        const charWidth = 8; // Approximate character width
        const lineHeight = 20; // Approximate line height
        const left = (currentLine.length * charWidth) % textarea.offsetWidth;
        const top = (lines.length - 1) * lineHeight;
        
        setAutocompletePosition({ top, left });
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
    
    onChange(e);
  };

  // Handle autocomplete selection
  const handleAttachmentSelect = (attachment) => {
    const beforeCursor = value.substring(0, cursorPosition);
    const afterCursor = value.substring(cursorPosition);
    
    // Find the last opening bracket
    const lastBracketIndex = beforeCursor.lastIndexOf('[');
    if (lastBracketIndex !== -1) {
      const newValue = beforeCursor.substring(0, lastBracketIndex) + 
                      `[${attachment.placeholder}]` + 
                      afterCursor;
      
      setCurrentInput(newValue);
      setShowAutocomplete(false);
      
      // Trigger onChange with the new value
      const syntheticEvent = {
        target: { value: newValue, selectionStart: lastBracketIndex + attachment.placeholder.length + 2 }
      };
      onChange(syntheticEvent);
      
      // Set cursor position after the placeholder
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(
            lastBracketIndex + attachment.placeholder.length + 2,
            lastBracketIndex + attachment.placeholder.length + 2
          );
        }
      }, 0);
    }
  };

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = (e) => {
    if (showAutocomplete && filteredAttachments.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        // Simple implementation - just select the first item
        if (e.key === 'Enter') {
          handleAttachmentSelect(filteredAttachments[0]);
        }
      }
    }
  };

  // Generate preview with highlighted placeholders and actual content
  const generatePreview = () => {
    if (!value) return '';
    
    let preview = value;
    
    // Replace placeholders with actual content
    attachments.forEach(attachment => {
      const placeholderRegex = new RegExp(`\\[${attachment.placeholder}\\]`, 'gi');
      
      if (attachment.file_type?.toLowerCase().startsWith('image')) {
        preview = preview.replace(placeholderRegex, 
          `<img src="${attachment.blob_url}" style="max-width:300px; height:auto; border: 2px solid #007bff; border-radius: 4px;" alt="${attachment.placeholder}" />`
        );
      } else if (attachment.file_type?.toLowerCase().startsWith('video')) {
        const watchUrl = `${window.location.origin}/watch?src=${encodeURIComponent(attachment.blob_url)}&title=${encodeURIComponent(attachment.placeholder)}`;
        
        if (attachment.gif_url) {
          preview = preview.replace(placeholderRegex,
            `<a href="${watchUrl}" target="_blank" rel="noopener" style="display: inline-block; border: 2px solid #007bff; border-radius: 4px; text-decoration: none;">
              <img src="${attachment.gif_url}" alt="▶️ Watch ${attachment.placeholder}" style="max-width:300px; height:auto; display:block;" />
              <div style="text-align: center; padding: 4px; background: #007bff; color: white; font-size: 12px;">Click to watch video</div>
            </a>`
          );
        } else {
          preview = preview.replace(placeholderRegex,
            `<a href="${watchUrl}" target="_blank" rel="noopener" style="display: inline-block; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">
              ▶️ Watch ${attachment.placeholder}
            </a>`
          );
        }
      }
    });
    
    // Highlight remaining placeholders in blue
    preview = preview.replace(/\[([^\]]+)\]/g, 
      '<span style="background-color: #007bff; color: white; padding: 2px 4px; border-radius: 3px; font-weight: bold;">[$1]</span>'
    );
    
    return preview;
  };

  return (
    <div className="enhanced-template-editor">
      <Form.Group className="mb-3">
        <Form.Label>Email Content</Form.Label>
        <div className="position-relative">
          <Form.Control
            ref={textareaRef}
            as="textarea"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={rows}
            placeholder={placeholder}
            style={{ fontFamily: 'monospace', fontSize: '14px' }}
          />
          
          {/* Autocomplete dropdown */}
          {showAutocomplete && (
            <div
              ref={autocompleteRef}
              className="position-absolute bg-white border rounded shadow-sm"
              style={{
                top: `${autocompletePosition.top + 40}px`,
                left: `${autocompletePosition.left}px`,
                zIndex: 1000,
                minWidth: '200px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}
            >
              {filteredAttachments.map((attachment, index) => (
                <div
                  key={attachment.id}
                  className="p-2 border-bottom cursor-pointer hover-bg-light"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleAttachmentSelect(attachment)}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  <div className="d-flex align-items-center">
                    <div className="me-2">
                      {attachment.file_type?.toLowerCase().startsWith('image') ? (
                        <i className="bi bi-image text-primary"></i>
                      ) : attachment.file_type?.toLowerCase().startsWith('video') ? (
                        <i className="bi bi-camera-video text-danger"></i>
                      ) : (
                        <i className="bi bi-file-earmark text-secondary"></i>
                      )}
                    </div>
                    <div>
                      <div className="fw-bold">[{attachment.placeholder}]</div>
                      <small className="text-muted">{attachment.file_type}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <Form.Text className="text-muted">
          <div className="d-flex align-items-center gap-2 mb-2">
            <span>Available placeholders:</span>
            <Badge bg="primary">[Recipient Name]</Badge>
            <Badge bg="primary">[Company Name]</Badge>
            <Badge bg="primary">[Your Name]</Badge>
            <Badge bg="primary">[Your Position]</Badge>
            <Badge bg="primary">[Your Company]</Badge>
          </div>
          
          {attachments.length > 0 && (
            <div className="d-flex align-items-center gap-2">
              <span>Your attachments:</span>
              {attachments.map(attachment => (
                <Badge 
                  key={attachment.id} 
                  bg={attachment.file_type?.toLowerCase().startsWith('video') ? 'danger' : 'success'}
                >
                  [{attachment.placeholder}]
                </Badge>
              ))}
            </div>
          )}
          
          <div className="mt-2">
            <small>
              💡 Type <code>[</code> to see attachment suggestions. Placeholders are highlighted in blue.
            </small>
          </div>
        </Form.Text>
      </Form.Group>

      {/* Live Preview */}
      {showPreview && value && (
        <Card className="mt-3">
          <Card.Header>
            <h6 className="mb-0">Live Preview</h6>
          </Card.Header>
          <Card.Body>
            <div 
              dangerouslySetInnerHTML={{ __html: generatePreview() }}
              style={{ 
                whiteSpace: 'pre-wrap',
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            />
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default EnhancedTemplateEditor; 
