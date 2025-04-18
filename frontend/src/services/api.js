import axios from 'axios';

// Utiliser l'URL configurée dans .env ou une URL par défaut
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Créer une instance axios avec la configuration de base
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Include cookies in all requests
});

// Ajout d'un intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response || error.message);
    return Promise.reject(error);
  }
);

// Add request interceptor to include authentication header
api.interceptors.request.use(
  (config) => {
    // Get user profile from localStorage
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      try {
        const profile = JSON.parse(userProfile);
        if (profile && profile.email) {
          // Set Authorization header with email
          config.headers.Authorization = profile.email;
        }
      } catch (error) {
        console.error('Error parsing user profile:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Service d'API pour les emails
export const emailService = {
  // Get templates
  getTemplates: () => api.get('/api/emails/templates'),
  
  // Generate emails
  generateEmails: (formData) => {
    return api.post('/api/emails/generate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Update email status (mark as sent, etc.)
  updateEmailStatus: (emailId, data) => api.put(`/api/emails/${emailId}/status`, data),
  
  // Delete email
  deleteEmail: (emailId) => api.delete(`/api/emails/${emailId}`),
};

// Template operations
export const templateService = {
  // Get all templates
  getAllTemplates: () => api.get('/api/emails/templates'),
  
  // Get template by ID
  getTemplate: (templateId) => api.get(`/api/emails/templates/${templateId}`),
  
  // Create template
  createTemplate: (template) => api.post('/api/emails/templates', template),
  
  // Update template
  updateTemplate: (templateId, template) => api.put(`/api/emails/templates/${templateId}`, template),
  
  // Delete template
  deleteTemplate: (templateId) => api.delete(`/api/emails/templates/${templateId}`),
};

// Service d'API pour les amis et le partage de cache
export const friendService = {
  // Envoi d'une demande d'ami
  sendFriendRequest: (email) => {
    return api.post('/friends/request', { email });
  },

  // Récupération des demandes d'amis
  getFriendRequests: () => {
    return api.get('/friends/requests');
  },

  // Réponse à une demande d'ami
  respondToFriendRequest: (requestId, status) => {
    return api.post('/friends/respond', { request_id: requestId, status });
  },

  // Récupération de la liste des amis
  getFriendsList: () => {
    return api.get('/friends/list');
  },

  // Activation/désactivation du partage de cache avec un ami
  toggleCacheSharing: (friendId, share) => {
    return api.post(`/friends/share/${friendId}`, { share });
  },

  // Récupération des emails partagés
  getSharedEmails: () => {
    return api.get('/friends/shared-emails');
  },

  // Partage d'un email avec les amis
  shareEmail: (email) => {
    return api.post('/friends/share-email', { email });
  },
};

export default api;