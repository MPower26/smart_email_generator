import api from './api';

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
