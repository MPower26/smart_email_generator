import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaInfoCircle, FaCheckCircle, FaEnvelope, FaClock } from 'react-icons/fa';
import './AntiSpamDashboard.css';

const AntiSpamDashboard = () => {
    const [summary, setSummary] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('authToken');
            
            // Fetch summary
            const summaryResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/antispam/summary`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                setSummary(summaryData);
            }
            
            // Fetch alerts
            const alertsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/antispam/alerts?limit=10&unread_only=true`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (alertsResponse.ok) {
                const alertsData = await alertsResponse.json();
                setAlerts(alertsData);
            }
            
            setLoading(false);
        } catch (err) {
            setError('Failed to load anti-spam data');
            setLoading(false);
        }
    };

    const markAlertAsRead = async (alertId) => {
        try {
            const token = localStorage.getItem('authToken');
            await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/antispam/alerts/${alertId}/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // Remove from list
            setAlerts(alerts.filter(a => a.id !== alertId));
        } catch (err) {
            console.error('Failed to mark alert as read:', err);
        }
    };

    const getAlertIcon = (level) => {
        switch (level) {
            case 'critical':
                return <FaExclamationTriangle className="alert-icon critical" />;
            case 'warning':
                return <FaInfoCircle className="alert-icon warning" />;
            default:
                return <FaCheckCircle className="alert-icon info" />;
        }
    };

    const getProgressBarClass = (percentage) => {
        if (percentage >= 90) return 'progress-bar critical';
        if (percentage >= 70) return 'progress-bar warning';
        return 'progress-bar';
    };

    if (loading) return <div className="antispam-loading">Loading anti-spam data...</div>;
    if (error) return <div className="antispam-error">{error}</div>;
    if (!summary) return null;

    const dailyUsagePercentage = (summary.usage_today.emails_sent / summary.limits.daily) * 100;
    const hourlyUsagePercentage = (summary.usage_today.hourly_sent / summary.limits.hourly) * 100;

    return (
        <div className="antispam-dashboard">
            {/* Alerts Section */}
            {alerts.length > 0 && (
                <div className="alerts-section">
                    <h3>Spam Protection Alerts</h3>
                    {alerts.map(alert => (
                        <div key={alert.id} className={`alert-item ${alert.level}`}>
                            {getAlertIcon(alert.level)}
                            <div className="alert-content">
                                <p>{alert.message}</p>
                                <small>{new Date(alert.created_at).toLocaleString()}</small>
                            </div>
                            <button onClick={() => markAlertAsRead(alert.id)} className="dismiss-btn">
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Sending Limits */}
            <div className="limits-section">
                <h3>Sending Limits</h3>
                
                <div className="limit-item">
                    <div className="limit-header">
                        <FaEnvelope />
                        <span>Daily Limit</span>
                        <span className="limit-value">
                            {summary.usage_today.emails_sent} / {summary.limits.daily}
                        </span>
                    </div>
                    <div className="progress-container">
                        <div 
                            className={getProgressBarClass(dailyUsagePercentage)}
                            style={{ width: `${Math.min(dailyUsagePercentage, 100)}%` }}
                        />
                    </div>
                    <p className="remaining">{summary.usage_today.daily_remaining} emails remaining today</p>
                </div>

                <div className="limit-item">
                    <div className="limit-header">
                        <FaClock />
                        <span>Hourly Limit</span>
                        <span className="limit-value">
                            {summary.usage_today.hourly_sent} / {summary.limits.hourly}
                        </span>
                    </div>
                    <div className="progress-container">
                        <div 
                            className={getProgressBarClass(hourlyUsagePercentage)}
                            style={{ width: `${Math.min(hourlyUsagePercentage, 100)}%` }}
                        />
                    </div>
                    <p className="remaining">{summary.usage_today.hourly_remaining} emails remaining this hour</p>
                </div>
            </div>

            {/* Account Status */}
            <div className="status-section">
                <h3>Account Status</h3>
                <div className="status-grid">
                    <div className="status-item">
                        <label>Tier:</label>
                        <span className={`tier-badge ${summary.current_tier}`}>
                            {summary.current_tier.toUpperCase()}
                        </span>
                    </div>
                    <div className="status-item">
                        <label>Reputation:</label>
                        <span className="reputation-score">
                            {summary.week_stats.avg_reputation.toFixed(1)}%
                        </span>
                    </div>
                    {summary.is_suspended && (
                        <div className="suspension-notice">
                            <FaExclamationTriangle />
                            Account Suspended: {summary.suspension_reason}
                        </div>
                    )}
                </div>
            </div>

            {/* Warm-up Status */}
            {summary.warm_up_status.status !== 'completed' && (
                <div className="warmup-section">
                    <h3>Email Warm-up Progress</h3>
                    <div className="warmup-progress">
                        <div className="progress-container">
                            <div 
                                className="progress-bar info"
                                style={{ width: `${summary.warm_up_status.progress}%` }}
                            />
                        </div>
                        <p>{summary.warm_up_status.progress}% Complete</p>
                        <small>
                            {summary.warm_up_status.days_remaining} days remaining • 
                            Next limit increase in {summary.warm_up_status.next_increase_in} days
                        </small>
                    </div>
                </div>
            )}

            {/* Week Statistics */}
            <div className="stats-section">
                <h3>Last 7 Days</h3>
                <div className="stats-grid">
                    <div className="stat-item">
                        <label>Emails Sent</label>
                        <span>{summary.week_stats.total_sent}</span>
                    </div>
                    <div className="stat-item">
                        <label>Bounced</label>
                        <span className="stat-warning">{summary.week_stats.total_bounced}</span>
                    </div>
                    <div className="stat-item">
                        <label>Complaints</label>
                        <span className="stat-critical">{summary.week_stats.total_complained}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AntiSpamDashboard;