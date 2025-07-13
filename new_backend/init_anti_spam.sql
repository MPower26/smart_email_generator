-- Script d'initialisation des données anti-spam pour les utilisateurs existants
-- À exécuter après avoir créé les tables anti-spam

-- Initialiser la réputation pour tous les utilisateurs existants
INSERT INTO sender_reputation (user_id, reputation_score, warmup_status, last_calculated)
SELECT 
    u.id,
    5.0 as reputation_score,
    'new' as warmup_status,
    GETDATE() as last_calculated
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM sender_reputation sr WHERE sr.user_id = u.id
);

-- Insérer les règles de limitation par défaut si elles n'existent pas
IF NOT EXISTS (SELECT 1 FROM email_limit_rules WHERE rule_name = 'Daily email limit')
BEGIN
    INSERT INTO email_limit_rules (rule_name, rule_type, default_value, warmup_value, max_value, description) VALUES
    ('Daily email limit', 'daily_limit', 500, 50, 2000, 'Nombre maximum d''emails par jour'),
    ('Hourly email limit', 'hourly_limit', 100, 10, 400, 'Nombre maximum d''emails par heure'),
    ('Unique recipients per day', 'recipient_limit', 300, 30, 1000, 'Nombre maximum de destinataires uniques par jour'),
    ('Emails per batch', 'batch_limit', 50, 10, 100, 'Nombre maximum d''emails par lot d''envoi');
END

-- Créer des entrées de limites quotidiennes pour aujourd'hui pour tous les utilisateurs
INSERT INTO email_daily_limits (user_id, send_date, emails_sent, unique_recipients, last_updated)
SELECT 
    u.id,
    CAST(GETDATE() AS DATE) as send_date,
    0 as emails_sent,
    0 as unique_recipients,
    GETDATE() as last_updated
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM email_daily_limits edl 
    WHERE edl.user_id = u.id 
    AND edl.send_date = CAST(GETDATE() AS DATE)
);

-- Mettre à jour la réputation pour les utilisateurs qui ont déjà envoyé des emails
-- (basé sur les emails existants dans la table generated_emails)
UPDATE sr
SET 
    total_emails_sent = COALESCE(email_stats.total_sent, 0),
    successful_deliveries = COALESCE(email_stats.total_sent, 0),
    reputation_score = CASE 
        WHEN COALESCE(email_stats.total_sent, 0) >= 500 THEN 8.0
        WHEN COALESCE(email_stats.total_sent, 0) >= 100 THEN 6.5
        WHEN COALESCE(email_stats.total_sent, 0) >= 50 THEN 6.0
        ELSE 5.0
    END,
    warmup_status = CASE 
        WHEN COALESCE(email_stats.total_sent, 0) >= 500 THEN 'active'
        WHEN COALESCE(email_stats.total_sent, 0) >= 100 THEN 'warming'
        ELSE 'new'
    END
FROM sender_reputation sr
INNER JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_sent
    FROM generated_emails 
    WHERE sent_at IS NOT NULL
    GROUP BY user_id
) email_stats ON sr.user_id = email_stats.user_id;

-- Créer des logs d'envoi pour les emails déjà envoyés (basé sur generated_emails)
INSERT INTO email_send_log (user_id, recipient_email, subject, sent_at, status)
SELECT 
    ge.user_id,
    ge.recipient_email,
    ge.subject,
    ge.sent_at,
    'sent' as status
FROM generated_emails ge
WHERE ge.sent_at IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM email_send_log esl 
    WHERE esl.user_id = ge.user_id 
    AND esl.recipient_email = ge.recipient_email 
    AND esl.sent_at = ge.sent_at
);

-- Mettre à jour les limites quotidiennes basées sur les emails déjà envoyés aujourd'hui
UPDATE edl
SET 
    emails_sent = COALESCE(today_stats.total_sent, 0),
    unique_recipients = COALESCE(today_stats.unique_recipients, 0)
FROM email_daily_limits edl
INNER JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_sent,
        COUNT(DISTINCT recipient_email) as unique_recipients
    FROM email_send_log 
    WHERE CAST(sent_at AS DATE) = CAST(GETDATE() AS DATE)
    GROUP BY user_id
) today_stats ON edl.user_id = today_stats.user_id
WHERE edl.send_date = CAST(GETDATE() AS DATE);

PRINT 'Initialisation des données anti-spam terminée avec succès!';
PRINT 'Nombre d''utilisateurs avec réputation initialisée: ' + CAST((SELECT COUNT(*) FROM sender_reputation) AS VARCHAR);
PRINT 'Nombre de règles de limitation créées: ' + CAST((SELECT COUNT(*) FROM email_limit_rules) AS VARCHAR);
PRINT 'Nombre de logs d''envoi créés: ' + CAST((SELECT COUNT(*) FROM email_send_log) AS VARCHAR);