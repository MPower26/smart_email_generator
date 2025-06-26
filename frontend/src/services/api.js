import axios from 'axios';

// Robustly get base URL (prefer env, fallback to HTTPS default)
let API_BASE_URL = (
  process.env.REACT_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net'
).replace(/^http:\/\//i, 'https://');

// Log what base URL is being used at runtime
console.log('[API] Using API_BASE_URL:', API_BASE_URL);

// Safety: Throw error if HTTPS is not enforced
if (!/^https:\/\//i.test(API_BASE_URL)) {
  throw new Error(`[API] Refusing to run: API_BASE_URL is not HTTPS! Value: ${API_BASE_URL}`);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Intercept requests: Log and enforce HTTPS
api.interceptors.request.use(
  (config) => {
    // Get email from localStorage for auth
    const email = localStorage.getItem('userEmail');
    if (email) {
      config.headers.Authorization = `Bearer ${email}`;
    }

    // Force HTTPS for any URL
    if (config.url && config.url.startsWith('http://')) {
      console.error('[API] Blocked non-HTTPS URL in request:', config.url);
      throw new Error('Blocked non-HTTPS API request');
    }
    // Compose and log the full request URL
    const requestUrl = config.url.startsWith('http')
      ? config.url
      : `${config.baseURL.replace(/\/$/, '')}/${config.url.replace(/^\//, '')}`;
    if (!/^https:\/\//i.test(requestUrl)) {
      console.error('[API] Blocked non-HTTPS full request:', requestUrl);
      throw new Error('Blocked non-HTTPS API request');
    }
    console.log('[API] Request:', requestUrl, 'Method:', config.method);
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept responses: Log errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API] Error:', error?.response || error?.message || error);
    return Promise.reject(error);
  }
);

// Service d'API pour les emails
export const emailService = {
  // Get templates
  getTemplates: () => api.get('/api/emails/templates'),
  
  // Get templates by category
  getTemplatesByCategory: (category) => api.get(`/api/templates?category=${category}`),
  
  // Get emails by stage (consolidated method) - NO trailing slash to match backend
  getEmailsByStage: (stage) => api.get(`/api/emails/by-stage/${stage}`),
  
  // Get emails by stage and group_id
  getEmailsByStageAndGroup: (stage, groupId) => api.get(`/api/emails/by-stage/${stage}?group_id=${groupId}`),
  
  // Get emails grouped by group_id for followup and lastchance stages
  getEmailsByStageGrouped: (stage) => api.get(`/api/emails/by-stage/${stage}/groups`),
  
  // Send all emails in a specific group
  sendAllByGroup: (stage, groupId) => api.post(`/api/emails/send_all_by_group/${stage}/${groupId}`),
  
  // Re-generate all emails in a group
  regenerateGroupEmails: (groupId, prompt) => api.post(`/api/emails/regenerate_group/${groupId}`, { prompt }),
  
  // Cache management
  getCacheInfo: () => api.get('/api/emails/cache'),
  clearCache: () => api.delete('/api/emails/cache'),
  
  // Generate emails
  generateEmails: (file, templateId, stage, avoidDuplicates, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('stage', stage);
    formData.append('avoid_duplicates', String(avoidDuplicates));

    if (templateId) {
      formData.append('template_id', templateId);
    }
    
    return api.post('/api/emails/generate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 1800000, // 30 minutes timeout
      onUploadProgress,
    });
  },
  
  // Update email status (mark as sent, etc.)
  updateEmailStatus: (emailId, data) => api.put(`/api/emails/${emailId}/status`, data),
  
  // Update email content (for editing)
  updateEmailContent: (emailId, data) => api.put(`/api/emails/${emailId}/content`, data),
  
  // Send all emails in a stage via Gmail
  sendAllViaGmail: (stage) => api.post(`/api/emails/send_all_via_gmail/${stage}`),
  
  // Get email generation progress
  getGenerationProgress: () => api.get('/api/emails/generation-progress', { timeout: 30000 }), // 30 second timeout for initial check
  getGenerationProgressById: (progressId) => api.get(`/api/emails/generation-progress/${progressId}`, { timeout: 15000 }), // 15 second timeout for polling
  
  // Delete email
  deleteEmail: (emailId) => api.delete(`/api/emails/${emailId}`),

  sendEmail: (emailId) => api.post(`/api/emails/send/${emailId}`),
};

// Template API - Fixed to match backend routes exactly
export const templateService = {
  getAllTemplates: () => api.get('/api/templates/'),
  getTemplatesByCategory: () => api.get('/api/templates/by-category'),
  getTemplatesByCategoryFilter: (category) => api.get(`/api/templates/?category=${category}`),
  getDefaultTemplate: (category) => api.get(`/api/templates/default/${category}`),
  getTemplate: (templateId) => api.get(`/api/templates/${templateId}`),
  createTemplate: (template) => api.post('/api/templates/', template),
  updateTemplate: (templateId, template) => api.put(`/api/templates/${templateId}`, template),
  setDefaultTemplate: (templateId) => api.put(`/api/templates/${templateId}/set-default`),
  deleteTemplate: (templateId) => api.delete(`/api/templates/${templateId}`),
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

// User profile API service
export const userService = {
  // Get current user profile
  getProfile: () => api.get('/api/users/me'),
  
  // Update user profile
  updateProfile: (profileData) => api.put('/api/users/settings', profileData),
  
  // Update email signature
  updateSignature: (signatureData) => api.put('/api/users/signature', signatureData),
  
  // Upload signature image
  uploadSignatureImage: (file) => {
    const formData = new FormData();
    formData.append('signature_image', file);
    return api.post('/api/users/signature/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default api;
