import axios from 'axios';

// Use the configured URL in .env or default URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://smart-email-backend-d8dcejbqe5h9bdcq.azurewebsites.net';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
  withCredentials: true,  // Include cookies in all requests
});

// Add request interceptor to include authentication header
api.interceptors.request.use(
  (config) => {
    // Get email from localStorage
    const email = localStorage.getItem('userEmail');
    if (email) {
      // Set Authorization header with email
      config.headers.Authorization = email;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response || error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
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
    return api.post('/api/friends/request', { email });
  },

  // Récupération des demandes d'amis
  getFriendRequests: () => {
    return api.get('/api/friends/requests');
  },

  // Réponse à une demande d'ami
  respondToFriendRequest: (requestId, status) => {
    return api.post(`/api/friends/respond/${requestId}`, { status });
  },

  // Récupération de la liste des amis
  getFriendsList: () => {
    return api.get('/api/friends/list');
  },

  // Activation/désactivation du partage de cache avec un ami
  toggleCacheSharing: (friendId, shareEnabled) => {
    return api.post(`/api/friends/share/${friendId}`, { share_enabled: shareEnabled });
  },

  // Suppression d'un ami
  removeFriend: (friendId) => {
    return api.delete(`/api/friends/${friendId}`);
  },

  // Récupération des emails partagés
  getSharedEmails: () => {
    return api.get('/api/friends/shared-emails');
  },

  // Partage d'un email avec les amis
  shareEmail: (email) => {
    return api.post('/api/friends/share-email', { email });
  },
};

export default api;