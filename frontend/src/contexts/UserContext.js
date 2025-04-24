import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

// URL de base de l'API
const API_URL = process.env.REACT_APP_API_URL || 'https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net';

// Helper function to set auth header
const setAuthHeader = (email) => {
  if (email) {
    const authHeader = `Bearer ${email}`;
    console.log('Setting auth header:', authHeader);
    axios.defaults.headers.common['Authorization'] = authHeader;
  } else {
    console.log('Removing auth header');
    delete axios.defaults.headers.common['Authorization'];
  }
};

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
    console.log('Checking stored email:', storedEmail);
    if (storedEmail) {
      setUserProfile({ email: storedEmail });
      setAuthenticated(true);
      setAuthStep('profile');
      setAuthHeader(storedEmail);
      // Fetch the full user profile
      fetchUserProfile();
    }
    setLoading(false);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users/me`);
      console.log('Fetched user profile:', response.data);
      setUserProfile(response.data);
      return true;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return false;
    }
  };

  const requestAuthCode = async (email) => {
    try {
      console.log('=== Auth Code Request Debug ===');
      console.log('API URL:', API_URL);
      console.log('Full request URL:', `${API_URL}/auth/request-code`);
      console.log('Email:', email);
      
      const response = await axios.post(
        `${API_URL}/auth/request-code`, 
        { email },
        {
          timeout: 30000, // 30 second timeout
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      
      // Store email temporarily
      setUserProfile({ email });
      setAuthStep('code');
      return true;
    } catch (error) {
      console.error('=== Auth Code Request Error ===');
      console.error('Error type:', error.name);
      console.error('Error message:', error.message);
      
      if (error.code === 'ECONNABORTED') {
        console.error('Request timed out after 30 seconds');
      }
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Response headers:', error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received');
        console.error('Request details:', {
          method: error.request.method,
          url: error.request.url,
          headers: error.request.headers
        });
      }
      
      // Show a more specific error message to the user
      let errorMessage = 'Failed to send verification code. ';
      if (error.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out. Please try again.';
      } else if (error.response) {
        errorMessage += error.response.data.detail || 'Server error occurred.';
      } else if (error.request) {
        errorMessage += 'No response from server. Please check your connection.';
      } else {
        errorMessage += 'An unexpected error occurred.';
      }
      console.error('User-friendly error message:', errorMessage);
      
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
      setAuthHeader(email);
      
      // Fetch the full user profile after verification
      await fetchUserProfile();
      
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
    setAuthHeader(null);
  };

  const updateUserProfile = async (profileData) => {
    try {
      console.log('Current auth header:', axios.defaults.headers.common['Authorization']);
      console.log('Updating profile with data:', profileData);
      const response = await axios.put(`${API_URL}/api/users/settings`, profileData);
      console.log('Profile update response:', response.data);
      
      // Update the user profile with the complete response data
      if (response.data && response.data.user) {
        setUserProfile(prev => ({
          ...prev,
          ...response.data.user
        }));
      }
      
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      return false;
    }
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