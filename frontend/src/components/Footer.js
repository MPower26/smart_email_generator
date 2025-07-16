import React from 'react';

const Footer = () => (
  <footer style={{
    width: '100%',
    background: '#222',
    color: '#fff',
    padding: '32px 0 16px 0',
    textAlign: 'center',
    fontSize: '0.95rem',
    letterSpacing: '0.03em',
    marginTop: 'auto',
  }}>
    <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.95rem', opacity: 0.8 }}>
      Powered by <span style={{ fontWeight: 600 }}>wesi</span> &copy; {new Date().getFullYear()}
    </div>
    {/* Add more footer content here later */}
  </footer>
);

export default Footer; 