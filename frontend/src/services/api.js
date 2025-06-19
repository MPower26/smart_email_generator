import axios from 'axios';

// Récupère la variable d'env (définie en build) ou fallback HTTPS hard-codé
let API_BASE_URL =
  process.env.REACT_APP_API_URL
  || 'https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net';

// Force HTTPS - convert HTTP to HTTPS if needed
API_BASE_URL = API_BASE_URL.replace(/^http:\/\//i, 'https://');

console.log('API_BASE_URL utilisée :', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false
});

// Add request interceptor to include authentication header and block malformed URLs
api.interceptors.request.use(
  (config) => {
    // Get email from localStorage
    const email = localStorage.getItem('userEmail');
    if (email) {
      // Set Authorization header with email
      config.headers.Authorization = `Bearer ${email}`;
    }
    
    // Force HTTPS for any URLs that might be malformed
    if (config.url && config.url.startsWith('http://')) {
      config.url = config.url.replace(/^http:\/\//i, 'https://');
    }
    
    // Block any absolute URLs that might be malformed (security measure)
    if (config.url && (config.url.startsWith('http://') || config.url.startsWith('//'))) {
      console.error('Blocked malformed URL:', config.url);
      throw new Error('Malformed URL detected - only relative URLs are allowed');
    }
    
    // Log the full URL being used
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log('Making request to:', fullUrl);
    
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
  
  // Get templates by category
  getTemplatesByCategory: (category) => api.get(`/api/templates?category=${category}`),
  
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
  getAllTemplates: () => api.get('/api/templates/'),
  
  // Get templates by category
  getTemplatesByCategory: () => api.get('/api/templates/by-category/'),
  
  // Get templates filtered by category
  getTemplatesByCategoryFilter: (category) => api.get(`/api/templates/?category=${category}`),
  
  // Get default template for a category
  getDefaultTemplate: (category) => api.get(`/api/templates/default/${category}/`),
  
  // Get template by ID
  getTemplate: (templateId) => api.get(`/api/templates/${templateId}/`),
  
  // Create template
  createTemplate: (template) => api.post('/api/templates/', template),
  
  // Update template
  updateTemplate: (templateId, template) => api.put(`/api/templates/${templateId}/`, template),
  
  // Set template as default
  setDefaultTemplate: (templateId) => api.put(`/api/templates/${templateId}/set-default/`),
  
  // Delete template
  deleteTemplate: (templateId) => api.delete(`/api/templates/${templateId}/`),
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
