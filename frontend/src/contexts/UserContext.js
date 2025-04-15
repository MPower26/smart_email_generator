import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

// URL de base de l'API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Création du contexte
export const UserContext = createContext();

// Provider du contexte
export const UserProvider = ({ children }) => {
  // État initial
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authStep, setAuthStep] = useState('email'); // 'email', 'code', 'profile'

  // Charger le profil utilisateur depuis le localStorage au démarrage
  useEffect(() => {
    const storedProfile = localStorage.getItem('userProfile');
    if (storedProfile) {
      try {
        const profile = JSON.parse(storedProfile);
        setUserProfile(profile);
        setAuthenticated(true);
        setAuthStep('profile');
      } catch (e) {
        console.error('Error parsing stored profile:', e);
        localStorage.removeItem('userProfile');
        setAuthStep('email');
      }
    }
    setLoading(false);
  }, []);

  // Sauvegarder le profil dans le localStorage quand il change
  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
    }
  }, [userProfile]);

  // Demander un code d'authentification
  const requestAuthCode = async (email) => {
    try {
      await axios.post(`${API_URL}/auth/request-code`, { email });
      // Stocker temporairement l'email 
      setUserProfile({ email });
      setAuthStep('code');
      return true;
    } catch (error) {
      console.error('Erreur lors de la demande de code:', error);
      return false;
    }
  };

  // Vérifier un code d'authentification
  const verifyAuthCode = async (email, code) => {
    try {
      const response = await axios.post(`${API_URL}/auth/verify-code`, { email, code });
      setUserProfile(response.data);
      setAuthenticated(true);
      setAuthStep('profile');
      
      // Configurer l'en-tête d'autorisation pour les futures requêtes
      axios.defaults.headers.common['Authorization'] = email;
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification du code:', error);
      return false;
    }
  };

  // Mettre à jour le profil utilisateur
  const updateUserProfile = (profile) => {
    setUserProfile({...userProfile, ...profile});
  };

  // Déconnexion
  const logout = () => {
    setUserProfile(null);
    setAuthenticated(false);
    setAuthStep('email');
    localStorage.removeItem('userProfile');
    
    // Supprimer l'en-tête d'autorisation
    delete axios.defaults.headers.common['Authorization'];
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