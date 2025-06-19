import api from './api';

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
