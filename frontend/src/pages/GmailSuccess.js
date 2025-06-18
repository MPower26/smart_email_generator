import React, { useEffect } from 'react';

const GmailSuccess = () => {
  useEffect(() => {
    // Auto-close the window after 2 seconds (if it's a popup)
    setTimeout(() => {
      window.close();
    }, 2000);
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '80px' }}>
      <h2>Gmail connected successfully!</h2>
      <p>You can close this window and return to the app.</p>
    </div>
  );
};

export default GmailSuccess; 
