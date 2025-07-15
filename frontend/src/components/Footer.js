import React from 'react';

const Footer = () => {
  return (
    <footer style={{ background: '#fff', borderTop: '2px solid #eee', padding: '2.5rem 0 2rem 0', marginTop: '3rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto', flexWrap: 'wrap', gap: 24 }}>
        {/* Left: Logo */}
        <div style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center' }}>
          <img src="/hermesslogo.svg" alt="Hermes Logo" className="hermes-logo-animated" style={{ height: 56, width: 56, marginRight: 12 }} />
        </div>
        {/* Center: Text */}
        <div style={{ flex: '2 1 300px', textAlign: 'center', fontWeight: 600, fontSize: '1.3rem', color: '#D8400D', letterSpacing: '0.04em' }}>
          An app built by <a href="https://wesi.ltd/" target="_blank" rel="noopener noreferrer" style={{ color: '#D8400D', textDecoration: 'underline', fontWeight: 700 }}>Wesi Ltd.</a>
        </div>
        {/* Right: Socials */}
        <div style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 18 }}>
          <a href="https://www.linkedin.com/company/wesi-agency/" target="_blank" rel="noopener noreferrer" title="LinkedIn" style={{ color: '#0A66C2', fontSize: 28 }}>
            <i className="bi bi-linkedin"></i>
          </a>
          <a href="https://www.instagram.com/wesiagency/" target="_blank" rel="noopener noreferrer" title="Instagram" style={{ color: '#E4405F', fontSize: 28 }}>
            <i className="bi bi-instagram"></i>
          </a>
          <a href="https://wesi.ltd/" target="_blank" rel="noopener noreferrer" title="Wesi Ltd" style={{ color: '#D8400D', fontSize: 28 }}>
            <i className="bi bi-globe2"></i>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 
