import axios from 'axios';

// URL de base de l'API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Créer une instance axios avec la configuration de base
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Points d'entrée API
const EMAIL_API = `${API_URL}/emails`;
const FRIENDS_API = `${API_URL}/friends`;

// Fonction pour générer des emails
export const generateEmails = async (contactsData, userInfo = null, templateId = null) => {
  try {
    const formData = new FormData();
    formData.append('contacts', JSON.stringify(contactsData));
    if (userInfo) formData.append('user_info', JSON.stringify(userInfo));
    if (templateId) formData.append('template_id', templateId);

    const response = await api.post('/api/emails/generate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error generating emails:', error);
    throw error;
  }
};

// Fonction pour obtenir les templates
export const getTemplates = async () => {
  try {
    const response = await api.get('/api/templates');
    return response.data;
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

export const saveTemplate = async (template) => {
  try {
    const response = await api.post('/api/templates', template);
    return response.data;
  } catch (error) {
    console.error('Error saving template:', error);
    throw error;
  }
};

export const deleteTemplate = async (templateId) => {
  try {
    const response = await api.delete(`/api/templates/${templateId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
};

export const getCacheInfo = async () => {
  try {
    const response = await api.get('/api/emails/cache');
    return response.data;
  } catch (error) {
    console.error('Error fetching cache info:', error);
    throw error;
  }
};

export const clearCache = async () => {
  try {
    const response = await api.delete('/api/emails/cache');
    return response.data;
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
};

// Fonctions pour la gestion des amis

// Récupérer la liste des amis et des demandes
export const getFriends = async () => {
  try {
    const response = await api.get('/friends/list');
    return response.data;
  } catch (error) {
    console.error('Error fetching friends:', error);
    throw error;
  }
};

// Envoyer une demande d'ami
export const sendFriendRequest = async (email, name = null) => {
  try {
    const response = await api.post('/friends/request', { 
      friend_email: email,
      name: name 
    });
    return response.data;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

// Accepter une demande d'ami
export const acceptFriendRequest = async (email) => {
  try {
    const response = await api.post('/friends/respond', {
      request_id: email,
      status: 'accepted'
    });
    return response.data;
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

// Rejeter une demande d'ami
export const rejectFriendRequest = async (email) => {
  try {
    const response = await api.post('/friends/respond', {
      request_id: email,
      status: 'rejected'
    });
    return response.data;
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
};

// Supprimer un ami
export const removeFriend = async (email) => {
  try {
    const response = await api.delete(`/friends/${encodeURIComponent(email)}`);
    return response.data;
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

// Activer/désactiver le partage avec un ami
export const toggleFriendSharing = async (email, sharingEnabled) => {
  try {
    const response = await api.post(`/friends/share/${encodeURIComponent(email)}`, {
      share: sharingEnabled
    });
    return response.data;
  } catch (error) {
    console.error('Error toggling friend sharing:', error);
    throw error;
  }
};

export const getSharedEmails = async () => {
  try {
    const response = await api.get('/friends/shared-emails');
    return response.data;
  } catch (error) {
    console.error('Error fetching shared emails:', error);
    throw error;
  }
}; 