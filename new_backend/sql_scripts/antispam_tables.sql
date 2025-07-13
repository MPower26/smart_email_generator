-- Script SQL pour créer les tables de monitoring anti-spam sur Azure SQL Database

-- Table pour suivre les envois quotidiens par utilisateur
CREATE TABLE email_sending_stats (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    emails_sent INT DEFAULT 0,
    emails_bounced INT DEFAULT 0,
    emails_complained INT DEFAULT 0,
    reputation_score DECIMAL(5,2) DEFAULT 100.00,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_email_sending_stats_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT UQ_user_date UNIQUE (user_id, date)
);

-- Table pour les limites d'envoi par utilisateur
CREATE TABLE email_sending_limits (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    daily_limit INT DEFAULT 50,  -- Commence bas pour le warm-up
    hourly_limit INT DEFAULT 10,
    current_tier VARCHAR(50) DEFAULT 'new',  -- new, warming, established, premium
    warm_up_started_at DATETIME2 DEFAULT GETUTCDATE(),
    last_limit_increase DATETIME2,
    is_suspended TINYINT DEFAULT 0,
    suspension_reason VARCHAR(500),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_email_sending_limits_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Table pour suivre les envois par heure
CREATE TABLE hourly_sending_stats (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    hour_timestamp DATETIME2 NOT NULL,
    emails_sent INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_hourly_sending_stats_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX IX_user_hour (user_id, hour_timestamp)
);

-- Table pour les domaines de destination et leur réputation
CREATE TABLE domain_reputation (
    id INT IDENTITY(1,1) PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    reputation_score DECIMAL(5,2) DEFAULT 50.00,
    total_sent INT DEFAULT 0,
    total_bounced INT DEFAULT 0,
    total_complained INT DEFAULT 0,
    last_sent_at DATETIME2,
    is_blocked TINYINT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Table pour les alertes anti-spam
CREATE TABLE spam_alerts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    alert_type VARCHAR(100) NOT NULL,  -- daily_limit_warning, hourly_limit_reached, reputation_low, etc.
    alert_level VARCHAR(50) NOT NULL,  -- info, warning, critical
    message NVARCHAR(1000) NOT NULL,
    is_read TINYINT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_spam_alerts_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Table pour le contenu suspect détecté
CREATE TABLE spam_content_checks (
    id INT IDENTITY(1,1) PRIMARY KEY,
    generated_email_id INT NOT NULL,
    spam_score DECIMAL(5,2) DEFAULT 0.00,
    spam_words_detected NVARCHAR(MAX),  -- JSON array of detected spam words
    has_unsubscribe_link TINYINT DEFAULT 0,
    text_to_image_ratio DECIMAL(5,2),
    personalization_score DECIMAL(5,2),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT FK_spam_content_checks_email FOREIGN KEY (generated_email_id) REFERENCES generated_emails(id)
);

-- Index pour les performances
CREATE INDEX IX_email_sending_stats_date ON email_sending_stats(date);
CREATE INDEX IX_spam_alerts_user_read ON spam_alerts(user_id, is_read);
CREATE INDEX IX_domain_reputation_domain ON domain_reputation(domain);

-- Vues utiles pour le monitoring
CREATE VIEW v_user_sending_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COALESCE(l.daily_limit, 50) as daily_limit,
    COALESCE(l.hourly_limit, 10) as hourly_limit,
    COALESCE(l.current_tier, 'new') as tier,
    COALESCE(l.is_suspended, 0) as is_suspended,
    COALESCE(s.emails_sent, 0) as emails_sent_today,
    COALESCE(s.reputation_score, 100) as reputation_score
FROM users u
LEFT JOIN email_sending_limits l ON u.id = l.user_id
LEFT JOIN email_sending_stats s ON u.id = s.user_id AND s.date = CAST(GETUTCDATE() AS DATE);

-- Procédure stockée pour vérifier si un utilisateur peut envoyer
CREATE PROCEDURE sp_check_can_send_email
    @user_id INT,
    @can_send BIT OUTPUT,
    @reason NVARCHAR(500) OUTPUT
AS
BEGIN
    SET @can_send = 1;
    SET @reason = '';

    -- Vérifier si suspendu
    IF EXISTS (SELECT 1 FROM email_sending_limits WHERE user_id = @user_id AND is_suspended = 1)
    BEGIN
        SET @can_send = 0;
        SET @reason = 'Account suspended for spam violations';
        RETURN;
    END

    -- Vérifier limite quotidienne
    DECLARE @daily_limit INT = 50;
    DECLARE @sent_today INT = 0;
    
    SELECT @daily_limit = COALESCE(daily_limit, 50) 
    FROM email_sending_limits 
    WHERE user_id = @user_id;
    
    SELECT @sent_today = COALESCE(emails_sent, 0)
    FROM email_sending_stats
    WHERE user_id = @user_id AND date = CAST(GETUTCDATE() AS DATE);
    
    IF @sent_today >= @daily_limit
    BEGIN
        SET @can_send = 0;
        SET @reason = CONCAT('Daily limit reached (', @sent_today, '/', @daily_limit, ')');
        RETURN;
    END

    -- Vérifier limite horaire
    DECLARE @hourly_limit INT = 10;
    DECLARE @sent_this_hour INT = 0;
    
    SELECT @hourly_limit = COALESCE(hourly_limit, 10) 
    FROM email_sending_limits 
    WHERE user_id = @user_id;
    
    SELECT @sent_this_hour = COALESCE(emails_sent, 0)
    FROM hourly_sending_stats
    WHERE user_id = @user_id 
    AND hour_timestamp = DATEADD(HOUR, DATEDIFF(HOUR, 0, GETUTCDATE()), 0);
    
    IF @sent_this_hour >= @hourly_limit
    BEGIN
        SET @can_send = 0;
        SET @reason = CONCAT('Hourly limit reached (', @sent_this_hour, '/', @hourly_limit, ')');
        RETURN;
    END
END;