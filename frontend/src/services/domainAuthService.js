import axios from 'axios';

// Configuration de l'API client
let API_BASE_URL = (
  process.env.REACT_APP_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net'
).replace(/^http:\/\//i, 'https://');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Intercepteur pour l'authentification
apiClient.interceptors.request.use(
  (config) => {
    const email = localStorage.getItem('userEmail');
    if (email) {
      config.headers.Authorization = `Bearer ${email}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

class DomainAuthService {
  /**
   * Get all domains for the current user
   */
  async getUserDomains() {
    try {
      const response = await apiClient.get('/domains');
      return response.data;
    } catch (error) {
      console.error('Error fetching user domains:', error);
      throw error;
    }
  }

  /**
   * Create a new domain
   */
  async createDomain(domainData) {
    try {
      const response = await apiClient.post('/domains', domainData);
      return response.data;
    } catch (error) {
      console.error('Error creating domain:', error);
      throw error;
    }
  }

  /**
   * Update a domain
   */
  async updateDomain(domainId, domainData) {
    try {
      const response = await apiClient.put(`/domains/${domainId}`, domainData);
      return response.data;
    } catch (error) {
      console.error('Error updating domain:', error);
      throw error;
    }
  }

  /**
   * Delete a domain
   */
  async deleteDomain(domainId) {
    try {
      const response = await apiClient.delete(`/domains/${domainId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting domain:', error);
      throw error;
    }
  }

  /**
   * Check domain authentication (SPF, DKIM, DMARC)
   */
  async checkDomainAuth(domainId, checkTypes = null) {
    try {
      const requestData = {
        domain_name: '', // This will be ignored by the backend
        check_types: checkTypes
      };
      const response = await apiClient.post(`/domains/${domainId}/check-auth`, requestData);
      return response.data;
    } catch (error) {
      console.error('Error checking domain auth:', error);
      throw error;
    }
  }

  /**
   * Generate DKIM keys for a domain
   */
  async generateDkimKeys(domainId, selector = 'default') {
    try {
      const response = await apiClient.post(`/domains/${domainId}/generate-dkim?selector=${selector}`);
      return response.data;
    } catch (error) {
      console.error('Error generating DKIM keys:', error);
      throw error;
    }
  }

  /**
   * Get domain configuration with DNS records and recommendations
   */
  async getDomainConfiguration(domainId) {
    try {
      const response = await apiClient.get(`/domains/${domainId}/configuration`);
      return response.data;
    } catch (error) {
      console.error('Error getting domain configuration:', error);
      throw error;
    }
  }

  /**
   * Get all alerts for a domain
   */
  async getDomainAlerts(domainId) {
    try {
      const response = await apiClient.get(`/domains/${domainId}/alerts`);
      return response.data;
    } catch (error) {
      console.error('Error fetching domain alerts:', error);
      throw error;
    }
  }

  /**
   * Resolve a domain alert
   */
  async resolveDomainAlert(domainId, alertId) {
    try {
      const response = await apiClient.post(`/domains/${domainId}/alerts/${alertId}/resolve`);
      return response.data;
    } catch (error) {
      console.error('Error resolving domain alert:', error);
      throw error;
    }
  }

  /**
   * Trigger immediate authentication check for a domain
   */
  async checkDomainNow(domainId) {
    try {
      const response = await apiClient.post(`/domains/${domainId}/check-now`);
      return response.data;
    } catch (error) {
      console.error('Error triggering domain check:', error);
      throw error;
    }
  }

  /**
   * Check all domains for the current user
   */
  async checkAllUserDomains() {
    try {
      const response = await apiClient.post('/domains/check-all');
      return response.data;
    } catch (error) {
      console.error('Error checking all user domains:', error);
      throw error;
    }
  }

  /**
   * Get domain status summary
   */
  getDomainStatusSummary(domain) {
    const authChecks = domain.auth_checks || [];
    const alerts = domain.alerts || [];
    
    const validChecks = authChecks.filter(check => check.is_valid).length;
    const totalChecks = authChecks.length;
    const unresolvedAlerts = alerts.filter(alert => !alert.is_resolved);
    
    let status = 'valid';
    if (unresolvedAlerts.some(alert => alert.level === 'error')) {
      status = 'error';
    } else if (unresolvedAlerts.some(alert => alert.level === 'warning')) {
      status = 'warning';
    } else if (validChecks < totalChecks) {
      status = 'incomplete';
    }
    
    return {
      status,
      validChecks,
      totalChecks,
      unresolvedAlerts: unresolvedAlerts.length,
      completionPercentage: totalChecks > 0 ? (validChecks / totalChecks) * 100 : 0
    };
  }

  /**
   * Get status icon and color for domain
   */
  getDomainStatusIcon(status) {
    switch (status) {
      case 'valid':
        return { icon: '✅', color: 'green', text: 'Valid' };
      case 'warning':
        return { icon: '⚠️', color: 'orange', text: 'Warning' };
      case 'error':
        return { icon: '❌', color: 'red', text: 'Error' };
      case 'incomplete':
        return { icon: '⏳', color: 'blue', text: 'Incomplete' };
      default:
        return { icon: '❓', color: 'gray', text: 'Unknown' };
    }
  }

  /**
   * Format DNS record for display
   */
  formatDnsRecord(record, type) {
    if (!record) return 'Not configured';
    
    // Truncate long records for display
    if (record.length > 80) {
      return `${record.substring(0, 80)}...`;
    }
    
    return record;
  }

  /**
   * Get recommendations for domain configuration
   */
  getDomainRecommendations(domain) {
    const recommendations = [];
    const authChecks = domain.auth_checks || [];
    
    // Check SPF
    const spfCheck = authChecks.find(check => check.check_type === 'SPF');
    if (!spfCheck || !spfCheck.is_valid) {
      recommendations.push({
        type: 'SPF',
        priority: 'high',
        message: 'Configure SPF record to improve email deliverability',
        action: 'Add SPF record to your DNS'
      });
    }
    
    // Check DKIM
    const dkimCheck = authChecks.find(check => check.check_type === 'DKIM');
    if (!dkimCheck || !dkimCheck.is_valid) {
      recommendations.push({
        type: 'DKIM',
        priority: 'high',
        message: 'Configure DKIM to sign your emails',
        action: 'Generate DKIM keys and add DNS record'
      });
    }
    
    // Check DMARC
    const dmarcCheck = authChecks.find(check => check.check_type === 'DMARC');
    if (!dmarcCheck || !dmarcCheck.is_valid) {
      recommendations.push({
        type: 'DMARC',
        priority: 'medium',
        message: 'Configure DMARC policy',
        action: 'Add DMARC record to your DNS'
      });
    } else if (dmarcCheck.check_data?.policy === 'none') {
      recommendations.push({
        type: 'DMARC',
        priority: 'medium',
        message: 'Consider upgrading DMARC policy from "none" to "quarantine"',
        action: 'Update DMARC policy'
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

export const domainAuthService = new DomainAuthService();
export default domainAuthService; 
