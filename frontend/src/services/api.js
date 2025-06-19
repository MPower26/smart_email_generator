import axios from 'axios';

// Récupère la variable d'env (définie en build) ou fallback HTTPS hard-codé
let API_BASE_URL =
  process.env.REACT_APP_API_URL
  || 'https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net';

// Force HTTPS - convert HTTP to HTTPS if needed
if (API_BASE_URL.startsWith('http://')) {
    API_BASE_URL = API_BASE_URL.replace('http://', 'https://');
    console.log('Converted HTTP to HTTPS:', API_BASE_URL);
}

// Additional safety: replace any http:// with https:// (case insensitive)
API_BASE_URL = API_BASE_URL.replace(/^http:\/\//i, 'https://');

console.log('Using API URL:', API_BASE_URL);

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false  // Changed to false since we're not using cookies
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
    console.log('Request config:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      baseURL: config.baseURL,
      fullUrl: fullUrl
    });
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

export default api;
