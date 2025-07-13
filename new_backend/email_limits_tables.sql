-- Tables pour la gestion des limites d'envoi d'emails
-- Conforme aux recommandations Google Workspace

-- Table pour suivre les envois quotidiens par utilisateur
CREATE TABLE email_daily_limits (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    send_date DATE NOT NULL,
    emails_sent INT DEFAULT 0,
    unique_recipients INT DEFAULT 0,
    last_updated DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_email_limits_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT UQ_user_date UNIQUE (user_id, send_date)
);
GO

-- Table pour suivre la réputation de l'expéditeur
CREATE TABLE sender_reputation (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    reputation_score DECIMAL(3,2) DEFAULT 5.00, -- Score de 0 à 10
    total_emails_sent INT DEFAULT 0,
    bounced_emails INT DEFAULT 0,
    spam_reports INT DEFAULT 0,
    successful_deliveries INT DEFAULT 0,
    last_calculated DATETIME DEFAULT GETDATE(),
    warmup_status VARCHAR(20) DEFAULT 'new', -- new, warming, active, restricted
    CONSTRAINT FK_reputation_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT UQ_reputation_user UNIQUE (user_id)
);
GO

-- Table pour les domaines autorisés (SPF/DKIM)
CREATE TABLE authorized_domains (
    id INT IDENTITY(1,1) PRIMARY KEY,
    domain_name VARCHAR(255) NOT NULL UNIQUE,
    spf_configured BIT DEFAULT 0,
    dkim_configured BIT DEFAULT 0,
    dmarc_configured BIT DEFAULT 0,
    verification_status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT GETDATE(),
    last_verified DATETIME
);
GO

-- Table pour le suivi des emails envoyés
CREATE TABLE email_send_log (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    sent_at DATETIME DEFAULT GETDATE(),
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, bounced, delivered
    message_id VARCHAR(255),
    bounce_reason VARCHAR(500),
    spam_score DECIMAL(3,2),
    CONSTRAINT FK_send_log_user FOREIGN KEY (user_id) REFERENCES users(id)
);
GO

-- Table pour les règles de limitation
CREATE TABLE email_limit_rules (
    id INT IDENTITY(1,1) PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- daily_limit, hourly_limit, recipient_limit
    default_value INT NOT NULL,
    warmup_value INT NOT NULL,
    max_value INT NOT NULL,
    description VARCHAR(500),
    is_active BIT DEFAULT 1
);
GO

-- Insertion des règles par défaut selon Google Workspace
INSERT INTO email_limit_rules (rule_name, rule_type, default_value, warmup_value, max_value, description) VALUES
('Daily email limit', 'daily_limit', 500, 50, 2000, 'Nombre maximum d''emails par jour'),
('Hourly email limit', 'hourly_limit', 100, 10, 400, 'Nombre maximum d''emails par heure'),
('Unique recipients per day', 'recipient_limit', 300, 30, 1000, 'Nombre maximum de destinataires uniques par jour'),
('Emails per batch', 'batch_limit', 50, 10, 100, 'Nombre maximum d''emails par lot d''envoi');
GO

-- Vue pour obtenir les limites actuelles d'un utilisateur
CREATE VIEW vw_user_email_limits AS
SELECT 
    u.id as user_id,
    u.email,
    COALESCE(edl.emails_sent, 0) as emails_sent_today,
    COALESCE(edl.unique_recipients, 0) as unique_recipients_today,
    sr.reputation_score,
    sr.warmup_status,
    CASE 
        WHEN sr.warmup_status = 'new' THEN elr_daily.warmup_value
        WHEN sr.reputation_score >= 8 THEN elr_daily.max_value
        ELSE elr_daily.default_value
    END as daily_limit,
    CASE 
        WHEN sr.warmup_status = 'new' THEN elr_recipient.warmup_value
        WHEN sr.reputation_score >= 8 THEN elr_recipient.max_value
        ELSE elr_recipient.default_value
    END as recipient_limit
FROM users u
LEFT JOIN email_daily_limits edl ON u.id = edl.user_id AND edl.send_date = CAST(GETDATE() AS DATE)
LEFT JOIN sender_reputation sr ON u.id = sr.user_id
CROSS JOIN (SELECT * FROM email_limit_rules WHERE rule_type = 'daily_limit' AND is_active = 1) elr_daily
CROSS JOIN (SELECT * FROM email_limit_rules WHERE rule_type = 'recipient_limit' AND is_active = 1) elr_recipient;
GO

-- Procédure stockée pour vérifier les limites avant envoi
CREATE PROCEDURE sp_check_email_limits
    @user_id INT,
    @recipient_count INT,
    @can_send BIT OUTPUT,
    @message VARCHAR(500) OUTPUT
AS
BEGIN
    DECLARE @emails_sent_today INT;
    DECLARE @unique_recipients_today INT;
    DECLARE @daily_limit INT;
    DECLARE @recipient_limit INT;
    DECLARE @warmup_status VARCHAR(20);
    
    -- Récupérer les informations actuelles
    SELECT 
        @emails_sent_today = emails_sent_today,
        @unique_recipients_today = unique_recipients_today,
        @daily_limit = daily_limit,
        @recipient_limit = recipient_limit,
        @warmup_status = warmup_status
    FROM vw_user_email_limits
    WHERE user_id = @user_id;
    
    -- Vérifier les limites
    IF @emails_sent_today + @recipient_count > @daily_limit
    BEGIN
        SET @can_send = 0;
        SET @message = 'Limite quotidienne atteinte. Vous avez envoyé ' + CAST(@emails_sent_today AS VARCHAR) + 
                      ' emails sur ' + CAST(@daily_limit AS VARCHAR) + ' autorisés aujourd''hui.';
        RETURN;
    END
    
    IF @unique_recipients_today + @recipient_count > @recipient_limit
    BEGIN
        SET @can_send = 0;
        SET @message = 'Limite de destinataires uniques atteinte. Vous avez contacté ' + 
                      CAST(@unique_recipients_today AS VARCHAR) + ' destinataires sur ' + 
                      CAST(@recipient_limit AS VARCHAR) + ' autorisés aujourd''hui.';
        RETURN;
    END
    
    -- Si en période de warmup, ajouter un avertissement
    IF @warmup_status = 'new'
    BEGIN
        SET @can_send = 1;
        SET @message = 'Attention: Votre compte est en période de montée en charge. Limitez vos envois pour établir une bonne réputation.';
        RETURN;
    END
    
    SET @can_send = 1;
    SET @message = 'Envoi autorisé. Il vous reste ' + 
                  CAST(@daily_limit - @emails_sent_today - @recipient_count AS VARCHAR) + 
                  ' emails aujourd''hui.';
END;
GO