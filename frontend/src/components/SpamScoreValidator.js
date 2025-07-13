import React, { useState } from 'react';
import { Card, Button, Alert, List, Tag, Spin } from 'antd';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const SpamScoreValidator = ({ subject, body, onValidation }) => {
  const [validationResult, setValidationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const validateContent = async () => {
    if (!subject || !body) {
      setError('Veuillez fournir un sujet et un contenu');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/emails/validate-content`,
        { subject, body },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.status === 'success') {
        setValidationResult(response.data.data);
        if (onValidation) {
          onValidation(response.data.data);
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la validation');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score < 2) return '#52c41a';
    if (score < 3) return '#1890ff';
    if (score < 5) return '#faad14';
    return '#f5222d';
  };

  const getScoreIcon = (score) => {
    if (score < 2) return <CheckCircleOutlined />;
    if (score < 5) return <WarningOutlined />;
    return <CloseCircleOutlined />;
  };

  const getScoreLabel = (score) => {
    if (score < 2) return 'Excellent';
    if (score < 3) return 'Bon';
    if (score < 5) return 'Risqué';
    return 'Spam probable';
  };

  return (
    <Card
      title="Validation anti-spam"
      extra={
        <Button 
          type="primary" 
          onClick={validateContent}
          loading={loading}
          disabled={!subject || !body}
        >
          Valider le contenu
        </Button>
      }
    >
      {error && (
        <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin tip="Analyse en cours..." />
        </div>
      )}

      {validationResult && !loading && (
        <div>
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            backgroundColor: validationResult.is_valid ? '#f6ffed' : '#fff2e8',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '48px', color: getScoreColor(validationResult.spam_score) }}>
              {getScoreIcon(validationResult.spam_score)}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '10px' }}>
              Score de spam: {validationResult.spam_score.toFixed(1)}/10
            </div>
            <Tag color={getScoreColor(validationResult.spam_score)} style={{ marginTop: '10px' }}>
              {getScoreLabel(validationResult.spam_score)}
            </Tag>
          </div>

          {validationResult.issues.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4>Problèmes détectés:</h4>
              <List
                dataSource={validationResult.issues}
                renderItem={issue => (
                  <List.Item>
                    <WarningOutlined style={{ color: '#faad14', marginRight: '8px' }} />
                    {issue}
                  </List.Item>
                )}
              />
            </div>
          )}

          <div>
            <h4>Recommandations:</h4>
            <List
              dataSource={validationResult.recommendations}
              renderItem={recommendation => (
                <List.Item>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                  {recommendation}
                </List.Item>
              )}
            />
          </div>

          {!validationResult.is_valid && (
            <Alert
              message="Action recommandée"
              description="Modifiez votre contenu pour réduire le risque de classification comme spam avant l'envoi."
              type="warning"
              showIcon
              style={{ marginTop: '20px' }}
            />
          )}
        </div>
      )}
    </Card>
  );
};

export default SpamScoreValidator;