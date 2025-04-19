import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

// URL de base de l'API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Création du contexte
export const UserContext = createContext();

// Custom hook pour utiliser le contexte
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// Provider du contexte
export const UserProvider = ({ children }) => {
  // État initial
  const [userProfile, setUserProfile] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authStep, setAuthStep] = useState('email'); // 'email', 'code', 'profile'

  useEffect(() => {
    // Check for existing email in localStorage
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) {
      setUserProfile({ email: storedEmail });
      setAuthenticated(true);
      setAuthStep('profile');
      // Set authorization header
      axios.defaults.headers.common['Authorization'] = storedEmail;
    }
    setLoading(false);
  }, []);

  const requestAuthCode = async (email) => {
    try {
      const response = await axios.post(`${API_URL}/auth/request-code`, { email });
      // Store email temporarily
      setUserProfile({ email });
      setAuthStep('code');
      return true;
    } catch (error) {
      console.error('Error requesting auth code:', error);
      return false;
    }
  };

  const verifyAuthCode = async (email, code) => {
    try {
      const response = await axios.post(`${API_URL}/auth/verify-code`, { email, code });
      setUserProfile(response.data);
      setAuthenticated(true);
      setAuthStep('profile');
      
      // Store email in localStorage
      localStorage.setItem('userEmail', email);
      
      // Set authorization header
      axios.defaults.headers.common['Authorization'] = email;
      
      return true;
    } catch (error) {
      console.error('Error verifying auth code:', error);
      return false;
    }
  };

  const logout = () => {
    setUserProfile(null);
    setAuthenticated(false);
    setAuthStep('email');
    localStorage.removeItem('userEmail');
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateUserProfile = (profile) => {
    setUserProfile({...userProfile, ...profile});
  };

  return (
    <UserContext.Provider 
      value={{ 
        userProfile, 
        updateUserProfile, 
        logout,
        loading,
        authenticated,
        authStep,
        setAuthStep,
        requestAuthCode,
        verifyAuthCode
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export default UserContext; 