import React, { useState, useEffect } from 'react';
import domainAuthService from '../services/domainAuthService';
import './DomainManager.css';

const DomainManager = () => {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain_name: '', is_primary: false });
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(false);

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const domainsData = await domainAuthService.getUserDomains();
      setDomains(domainsData);
    } catch (err) {
      setError('Failed to load domains');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await domainAuthService.createDomain(newDomain);
      setNewDomain({ domain_name: '', is_primary: false });
      setShowAddDomain(false);
      await loadDomains();
    } catch (err) {
      setError('Failed to add domain');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDomain = async (domainId) => {
    if (!window.confirm('Are you sure you want to delete this domain?')) {
      return;
    }
    
    try {
      await domainAuthService.deleteDomain(domainId);
      await loadDomains();
    } catch (err) {
      setError('Failed to delete domain');
      console.error(err);
    }
  };

  const handleCheckAuth = async (domainId) => {
    try {
      setCheckingAuth(true);
      await domainAuthService.checkDomainNow(domainId);
      await loadDomains();
    } catch (err) {
      setError('Failed to check domain authentication');
      console.error(err);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleGenerateDkim = async (domainId) => {
    try {
      setLoading(true);
      const dkimKeys = await domainAuthService.generateDkimKeys(domainId);
      alert(`DKIM keys generated successfully!\n\nDNS Record:\n${dkimKeys.dns_record}\n\nPlease add this record to your DNS.`);
      await loadDomains();
    } catch (err) {
      setError('Failed to generate DKIM keys');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const DomainCard = ({ domain }) => {
    const statusSummary = domainAuthService.getDomainStatusSummary(domain);
    const statusIcon = domainAuthService.getDomainStatusIcon(statusSummary.status);
    const recommendations = domainAuthService.getDomainRecommendations(domain);

    return (
      <div className={`domain-card ${statusSummary.status}`}>
        <div className="domain-header">
          <div className="domain-info">
            <h3>{domain.domain_name}</h3>
            <span className={`status-badge ${statusSummary.status}`}>
              {statusIcon.icon} {statusIcon.text}
            </span>
            {domain.is_primary && <span className="primary-badge">Primary</span>}
          </div>
          <div className="domain-actions">
            <button 
              onClick={() => handleCheckAuth(domain.id)}
              disabled={checkingAuth}
              className="btn btn-secondary"
            >
              {checkingAuth ? 'Checking...' : 'Check Auth'}
            </button>
            <button 
              onClick={() => handleGenerateDkim(domain.id)}
              className="btn btn-secondary"
            >
              Generate DKIM
            </button>
            <button 
              onClick={() => setSelectedDomain(domain)}
              className="btn btn-primary"
            >
              View Details
            </button>
            <button 
              onClick={() => handleDeleteDomain(domain.id)}
              className="btn btn-danger"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="domain-status">
          <div className="status-summary">
            <span>Authentication: {statusSummary.validChecks}/{statusSummary.totalChecks} passed</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${statusSummary.completionPercentage}%` }}
              ></div>
            </div>
          </div>
          
          {statusSummary.unresolvedAlerts > 0 && (
            <div className="alerts-summary">
              <span className="alert-count">
                ⚠️ {statusSummary.unresolvedAlerts} unresolved alerts
              </span>
            </div>
          )}
        </div>

        {recommendations.length > 0 && (
          <div className="recommendations">
            <h4>Recommendations:</h4>
            <ul>
              {recommendations.map((rec, index) => (
                <li key={index} className={`priority-${rec.priority}`}>
                  <strong>{rec.type}:</strong> {rec.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const DomainDetails = ({ domain, onClose }) => {
    const [configuration, setConfiguration] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadDomainDetails();
    }, [domain]);

    const loadDomainDetails = async () => {
      try {
        setLoading(true);
        const [configData, alertsData] = await Promise.all([
          domainAuthService.getDomainConfiguration(domain.id),
          domainAuthService.getDomainAlerts(domain.id)
        ]);
        setConfiguration(configData);
        setAlerts(alertsData);
      } catch (err) {
        console.error('Failed to load domain details:', err);
      } finally {
        setLoading(false);
      }
    };

    const handleResolveAlert = async (alertId) => {
      try {
        await domainAuthService.resolveDomainAlert(domain.id, alertId);
        await loadDomainDetails();
      } catch (err) {
        console.error('Failed to resolve alert:', err);
      }
    };

    if (loading) {
      return (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="loading">Loading domain details...</div>
          </div>
        </div>
      );
    }

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Domain Details: {domain.domain_name}</h2>
            <button onClick={onClose} className="close-btn">&times;</button>
          </div>

          <div className="modal-body">
            <div className="dns-records">
              <h3>DNS Records</h3>
              
              <div className="record-section">
                <h4>SPF Record</h4>
                <div className="record-value">
                  {configuration?.spf_record ? (
                    <code>{domainAuthService.formatDnsRecord(configuration.spf_record, 'SPF')}</code>
                  ) : (
                    <span className="not-configured">Not configured</span>
                  )}
                </div>
              </div>

              <div className="record-section">
                <h4>DKIM Record</h4>
                <div className="record-value">
                  {configuration?.dkim_record ? (
                    <code>{domainAuthService.formatDnsRecord(configuration.dkim_record, 'DKIM')}</code>
                  ) : (
                    <span className="not-configured">Not configured</span>
                  )}
                </div>
                {domain.dkim_selector && (
                  <div className="dkim-info">
                    <strong>Selector:</strong> {domain.dkim_selector}
                  </div>
                )}
              </div>

              <div className="record-section">
                <h4>DMARC Record</h4>
                <div className="record-value">
                  {configuration?.dmarc_record ? (
                    <code>{domainAuthService.formatDnsRecord(configuration.dmarc_record, 'DMARC')}</code>
                  ) : (
                    <span className="not-configured">Not configured</span>
                  )}
                </div>
              </div>
            </div>

            {configuration?.recommendations?.length > 0 && (
              <div className="recommendations-section">
                <h3>Recommendations</h3>
                <ul>
                  {configuration.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {alerts.length > 0 && (
              <div className="alerts-section">
                <h3>Alerts</h3>
                <div className="alerts-list">
                  {alerts.map(alert => (
                    <div key={alert.id} className={`alert-item ${alert.level}`}>
                      <div className="alert-header">
                        <span className={`alert-level ${alert.level}`}>
                          {alert.level.toUpperCase()}
                        </span>
                        <span className="alert-date">
                          {new Date(alert.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="alert-message">{alert.message}</div>
                      {!alert.is_resolved && (
                        <button 
                          onClick={() => handleResolveAlert(alert.id)}
                          className="btn btn-small"
                        >
                          Mark as Resolved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading && domains.length === 0) {
    return <div className="loading">Loading domains...</div>;
  }

  return (
    <div className="domain-manager">
      <div className="domain-manager-header">
        <h1>Domain Authentication</h1>
        <div className="header-actions">
          <button 
            onClick={() => setShowAddDomain(true)}
            className="btn btn-primary"
          >
            Add Domain
          </button>
          <button 
            onClick={() => domainAuthService.checkAllUserDomains()}
            className="btn btn-secondary"
          >
            Check All Domains
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {showAddDomain && (
        <div className="modal-overlay" onClick={() => setShowAddDomain(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Domain</h2>
              <button onClick={() => setShowAddDomain(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleAddDomain} className="add-domain-form">
              <div className="form-group">
                <label htmlFor="domain_name">Domain Name:</label>
                <input
                  type="text"
                  id="domain_name"
                  value={newDomain.domain_name}
                  onChange={(e) => setNewDomain({...newDomain, domain_name: e.target.value})}
                  placeholder="example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newDomain.is_primary}
                    onChange={(e) => setNewDomain({...newDomain, is_primary: e.target.checked})}
                  />
                  Set as primary domain
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Domain'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddDomain(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDomain && (
        <DomainDetails 
          domain={selectedDomain} 
          onClose={() => setSelectedDomain(null)} 
        />
      )}

      <div className="domains-list">
        {domains.length === 0 ? (
          <div className="empty-state">
            <p>No domains configured yet.</p>
            <p>Add your first domain to start monitoring email authentication.</p>
          </div>
        ) : (
          domains.map(domain => (
            <DomainCard key={domain.id} domain={domain} />
          ))
        )}
      </div>
    </div>
  );
};

export default DomainManager; 