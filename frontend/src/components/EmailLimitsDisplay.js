import React, { useState, useEffect } from 'react';
import { Card, Progress, Alert, Tooltip, Badge } from 'antd';
import { InfoCircleOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const EmailLimitsDisplay = ({ onLimitsUpdate }) => {
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLimits = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/emails/limits`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.status === 'success') {
        setLimits(response.data.data);
        if (onLimitsUpdate) {
          onLimitsUpdate(response.data.data);
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la récupération des limites');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimits();
    // Rafraîchir toutes les 5 minutes
    const interval = setInterval(fetchLimits, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Card loading={true} />;
  if (error) return <Alert message={error} type="error" />;
  if (!limits) return null;

  const dailyPercent = (limits.emails_sent_today / limits.daily_limit) * 100;
  const recipientPercent = (limits.unique_recipients_today / limits.recipient_limit) * 100;
  
  const getProgressStatus = (percent) => {
    if (percent >= 90) return 'exception';
    if (percent >= 75) return 'active';
    return 'normal';
  };

  const getReputationColor = (score) => {
    if (score >= 8) return '#52c41a';
    if (score >= 6) return '#1890ff';
    if (score >= 4) return '#faad14';
    return '#f5222d';
  };

  return (
    <Card 
      title={
        <span>
          Limites d'envoi quotidiennes
          <Tooltip title="Les limites sont basées sur votre réputation et le statut de votre compte">
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </span>
      }
      extra={
        limits.warmup_status === 'new' && (
          <Badge 
            count="Période de montée en charge" 
            style={{ backgroundColor: '#faad14' }}
          />
        )
      }
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Emails envoyés aujourd'hui</span>
          <span>{limits.emails_sent_today} / {limits.daily_limit}</span>
        </div>
        <Progress 
          percent={Math.round(dailyPercent)} 
          status={getProgressStatus(dailyPercent)}
          strokeColor={dailyPercent >= 90 ? '#f5222d' : undefined}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Destinataires uniques aujourd'hui</span>
          <span>{limits.unique_recipients_today} / {limits.recipient_limit}</span>
        </div>
        <Progress 
          percent={Math.round(recipientPercent)} 
          status={getProgressStatus(recipientPercent)}
          strokeColor={recipientPercent >= 90 ? '#f5222d' : undefined}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span>Score de réputation: </span>
          <span style={{ 
            fontWeight: 'bold', 
            color: getReputationColor(limits.reputation_score) 
          }}>
            {limits.reputation_score.toFixed(1)}/10
          </span>
        </div>
        <div>
          {limits.remaining_emails > 0 ? (
            <span style={{ color: '#52c41a' }}>
              <CheckCircleOutlined /> {limits.remaining_emails} emails restants
            </span>
          ) : (
            <span style={{ color: '#f5222d' }}>
              <WarningOutlined /> Limite atteinte
            </span>
          )}
        </div>
      </div>

      {limits.warmup_status === 'new' && (
        <Alert
          message="Compte en période de montée en charge"
          description="Vos limites sont réduites pendant la période de montée en charge. Envoyez régulièrement des emails de qualité pour augmenter votre réputation."
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}

      {dailyPercent >= 80 && (
        <Alert
          message="Attention: Limite quotidienne bientôt atteinte"
          description={`Vous avez utilisé ${Math.round(dailyPercent)}% de votre limite quotidienne. Planifiez vos envois pour demain.`}
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  );
};

export default EmailLimitsDisplay;