-- Procédures de maintenance pour les tables de limites d'envoi

-- Procédure pour nettoyer les anciens logs (plus de 90 jours)
CREATE PROCEDURE sp_cleanup_old_email_logs
AS
BEGIN
    DECLARE @cutoff_date DATE = DATEADD(DAY, -90, GETDATE());
    
    -- Supprimer les anciens logs d'envoi
    DELETE FROM email_send_log
    WHERE sent_at < @cutoff_date;
    
    -- Supprimer les anciennes limites quotidiennes
    DELETE FROM email_daily_limits
    WHERE send_date < @cutoff_date;
    
    PRINT 'Cleaned up email logs older than ' + CAST(@cutoff_date AS VARCHAR);
END;
GO

-- Procédure pour calculer et mettre à jour la réputation
CREATE PROCEDURE sp_update_sender_reputation
    @user_id INT
AS
BEGIN
    DECLARE @total_sent INT;
    DECLARE @total_bounced INT;
    DECLARE @total_spam INT;
    DECLARE @recent_sent INT;
    DECLARE @recent_bounced INT;
    DECLARE @new_score DECIMAL(3,2);
    DECLARE @days_active INT;
    
    -- Compter les emails des 30 derniers jours
    SELECT 
        @recent_sent = COUNT(*),
        @recent_bounced = COUNT(CASE WHEN status = 'bounced' THEN 1 END)
    FROM email_send_log
    WHERE user_id = @user_id
        AND sent_at >= DATEADD(DAY, -30, GETDATE());
    
    -- Compter tous les emails
    SELECT 
        @total_sent = COUNT(*),
        @total_bounced = COUNT(CASE WHEN status = 'bounced' THEN 1 END),
        @total_spam = COUNT(CASE WHEN spam_score >= 5 THEN 1 END)
    FROM email_send_log
    WHERE user_id = @user_id;
    
    -- Calculer le nombre de jours actifs
    SELECT @days_active = COUNT(DISTINCT send_date)
    FROM email_daily_limits
    WHERE user_id = @user_id
        AND send_date >= DATEADD(DAY, -30, GETDATE());
    
    -- Calculer le nouveau score (formule simplifiée)
    SET @new_score = 5.0; -- Score de base
    
    -- Bonus pour l'ancienneté
    IF @days_active >= 20
        SET @new_score = @new_score + 1.0;
    ELSE IF @days_active >= 10
        SET @new_score = @new_score + 0.5;
    
    -- Pénalité pour les bounces
    IF @recent_sent > 0
    BEGIN
        DECLARE @bounce_rate DECIMAL(5,2) = (@recent_bounced * 100.0) / @recent_sent;
        IF @bounce_rate > 10
            SET @new_score = @new_score - 2.0;
        ELSE IF @bounce_rate > 5
            SET @new_score = @new_score - 1.0;
    END
    
    -- Bonus pour le volume sans problème
    IF @recent_sent > 100 AND @recent_bounced < 5
        SET @new_score = @new_score + 1.5;
    
    -- S'assurer que le score reste entre 0 et 10
    IF @new_score < 0
        SET @new_score = 0;
    ELSE IF @new_score > 10
        SET @new_score = 10;
    
    -- Mettre à jour la réputation
    UPDATE sender_reputation
    SET 
        reputation_score = @new_score,
        total_emails_sent = @total_sent,
        bounced_emails = @total_bounced,
        spam_reports = @total_spam,
        successful_deliveries = @total_sent - @total_bounced,
        last_calculated = GETDATE(),
        warmup_status = CASE 
            WHEN @days_active >= 30 AND @total_sent >= 500 THEN 'active'
            WHEN @days_active >= 7 AND @total_sent >= 100 THEN 'warming'
            ELSE warmup_status
        END
    WHERE user_id = @user_id;
END;
GO

-- Procédure pour réinitialiser les limites quotidiennes (à exécuter chaque jour à minuit)
CREATE PROCEDURE sp_reset_daily_limits
AS
BEGIN
    -- Cette procédure n'est pas nécessaire car les limites sont basées sur la date
    -- Mais on peut l'utiliser pour nettoyer les anciennes entrées
    EXEC sp_cleanup_old_email_logs;
    
    -- Mettre à jour la réputation pour tous les utilisateurs actifs
    DECLARE @user_id INT;
    DECLARE user_cursor CURSOR FOR
        SELECT DISTINCT user_id
        FROM email_daily_limits
        WHERE send_date >= DATEADD(DAY, -7, GETDATE());
    
    OPEN user_cursor;
    FETCH NEXT FROM user_cursor INTO @user_id;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC sp_update_sender_reputation @user_id;
        FETCH NEXT FROM user_cursor INTO @user_id;
    END
    
    CLOSE user_cursor;
    DEALLOCATE user_cursor;
END;
GO

-- Vue pour le tableau de bord admin
CREATE VIEW vw_email_sending_dashboard AS
SELECT 
    u.email as user_email,
    sr.reputation_score,
    sr.warmup_status,
    COALESCE(edl_today.emails_sent, 0) as emails_sent_today,
    COALESCE(edl_week.total_sent, 0) as emails_sent_week,
    COALESCE(edl_month.total_sent, 0) as emails_sent_month,
    sr.bounced_emails,
    sr.spam_reports,
    sr.last_calculated
FROM users u
LEFT JOIN sender_reputation sr ON u.id = sr.user_id
LEFT JOIN (
    SELECT user_id, emails_sent
    FROM email_daily_limits
    WHERE send_date = CAST(GETDATE() AS DATE)
) edl_today ON u.id = edl_today.user_id
LEFT JOIN (
    SELECT user_id, SUM(emails_sent) as total_sent
    FROM email_daily_limits
    WHERE send_date >= DATEADD(DAY, -7, GETDATE())
    GROUP BY user_id
) edl_week ON u.id = edl_week.user_id
LEFT JOIN (
    SELECT user_id, SUM(emails_sent) as total_sent
    FROM email_daily_limits
    WHERE send_date >= DATEADD(DAY, -30, GETDATE())
    GROUP BY user_id
) edl_month ON u.id = edl_month.user_id
WHERE sr.user_id IS NOT NULL;
GO