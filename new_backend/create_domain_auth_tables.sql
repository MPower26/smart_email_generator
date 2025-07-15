-- Script SQL pour créer les tables d'authentification de domaine
-- À exécuter directement sur votre base de données SQL Server

-- Table des domaines
CREATE TABLE domains (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    domain_name NVARCHAR(255) NOT NULL,
    is_primary BIT DEFAULT 0,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 NULL,
    dkim_selector NVARCHAR(100) NULL,
    dkim_private_key NTEXT NULL,
    dkim_public_key NTEXT NULL,
    CONSTRAINT FK_domains_users FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index pour la table domains
CREATE INDEX ix_domains_domain_name ON domains(domain_name);
CREATE INDEX ix_domains_id ON domains(id);
CREATE INDEX ix_domains_user_id ON domains(user_id);

-- Table des vérifications d'authentification
CREATE TABLE domain_auth_checks (
    id INT IDENTITY(1,1) PRIMARY KEY,
    domain_id INT NOT NULL,
    check_type NVARCHAR(20) NOT NULL,
    record_found BIT DEFAULT 0,
    is_valid BIT DEFAULT 0,
    last_checked DATETIME2 DEFAULT GETDATE(),
    next_check DATETIME2 NULL,
    check_data NVARCHAR(MAX) NULL, -- JSON data
    CONSTRAINT FK_domain_auth_checks_domains FOREIGN KEY (domain_id) REFERENCES domains(id)
);

-- Index pour la table domain_auth_checks
CREATE INDEX ix_domain_auth_checks_id ON domain_auth_checks(id);
CREATE INDEX ix_domain_auth_checks_domain_id ON domain_auth_checks(domain_id);
CREATE INDEX ix_domain_auth_checks_type ON domain_auth_checks(check_type);

-- Table des alertes de domaine
CREATE TABLE domain_alerts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    domain_id INT NOT NULL,
    alert_type NVARCHAR(50) NOT NULL,
    level NVARCHAR(20) NOT NULL,
    message NTEXT NOT NULL,
    is_resolved BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    resolved_at DATETIME2 NULL,
    CONSTRAINT FK_domain_alerts_domains FOREIGN KEY (domain_id) REFERENCES domains(id)
);

-- Index pour la table domain_alerts
CREATE INDEX ix_domain_alerts_id ON domain_alerts(id);
CREATE INDEX ix_domain_alerts_domain_id ON domain_alerts(domain_id);
CREATE INDEX ix_domain_alerts_type ON domain_alerts(alert_type);
CREATE INDEX ix_domain_alerts_level ON domain_alerts(level);
CREATE INDEX ix_domain_alerts_resolved ON domain_alerts(is_resolved);

-- Vues utiles pour les requêtes courantes
GO

-- Vue pour obtenir le statut d'authentification des domaines
CREATE VIEW v_domain_auth_status AS
SELECT 
    d.id,
    d.user_id,
    d.domain_name,
    d.is_primary,
    d.is_active,
    d.dkim_selector,
    d.created_at,
    d.updated_at,
    -- Comptage des vérifications
    COUNT(dac.id) as total_checks,
    SUM(CASE WHEN dac.is_valid = 1 THEN 1 ELSE 0 END) as valid_checks,
    -- Comptage des alertes non résolues
    COUNT(da.id) as total_alerts,
    SUM(CASE WHEN da.is_resolved = 0 THEN 1 ELSE 0 END) as unresolved_alerts,
    -- Statut global
    CASE 
        WHEN SUM(CASE WHEN da.is_resolved = 0 AND da.level = 'error' THEN 1 ELSE 0 END) > 0 THEN 'error'
        WHEN SUM(CASE WHEN da.is_resolved = 0 AND da.level = 'warning' THEN 1 ELSE 0 END) > 0 THEN 'warning'
        WHEN SUM(CASE WHEN dac.is_valid = 1 THEN 1 ELSE 0 END) = COUNT(dac.id) AND COUNT(dac.id) > 0 THEN 'valid'
        ELSE 'incomplete'
    END as overall_status
FROM domains d
LEFT JOIN domain_auth_checks dac ON d.id = dac.domain_id
LEFT JOIN domain_alerts da ON d.id = da.domain_id
GROUP BY d.id, d.user_id, d.domain_name, d.is_primary, d.is_active, d.dkim_selector, d.created_at, d.updated_at;

GO

-- Vue pour obtenir les dernières vérifications par domaine
CREATE VIEW v_latest_domain_checks AS
SELECT 
    dac.domain_id,
    dac.check_type,
    dac.record_found,
    dac.is_valid,
    dac.last_checked,
    dac.check_data,
    ROW_NUMBER() OVER (PARTITION BY dac.domain_id, dac.check_type ORDER BY dac.last_checked DESC) as rn
FROM domain_auth_checks dac;

GO

-- Procédure stockée pour nettoyer les anciennes alertes résolues
CREATE PROCEDURE sp_cleanup_resolved_alerts
    @days_to_keep INT = 30
AS
BEGIN
    SET NOCOUNT ON;
    
    DELETE FROM domain_alerts 
    WHERE is_resolved = 1 
    AND created_at < DATEADD(day, -@days_to_keep, GETDATE());
    
    PRINT 'Nettoyage des alertes résolues terminé';
END;

GO

-- Procédure stockée pour obtenir les recommandations d'un domaine
CREATE PROCEDURE sp_get_domain_recommendations
    @domain_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @recommendations TABLE (
        type NVARCHAR(20),
        priority NVARCHAR(10),
        message NVARCHAR(500),
        action NVARCHAR(200)
    );
    
    -- Vérifier SPF
    IF NOT EXISTS (SELECT 1 FROM domain_auth_checks WHERE domain_id = @domain_id AND check_type = 'SPF' AND is_valid = 1)
    BEGIN
        INSERT INTO @recommendations (type, priority, message, action)
        VALUES ('SPF', 'high', 'Configure SPF record to improve email deliverability', 'Add SPF record to your DNS');
    END
    
    -- Vérifier DKIM
    IF NOT EXISTS (SELECT 1 FROM domain_auth_checks WHERE domain_id = @domain_id AND check_type = 'DKIM' AND is_valid = 1)
    BEGIN
        INSERT INTO @recommendations (type, priority, message, action)
        VALUES ('DKIM', 'high', 'Configure DKIM to sign your emails', 'Generate DKIM keys and add DNS record');
    END
    
    -- Vérifier DMARC
    IF NOT EXISTS (SELECT 1 FROM domain_auth_checks WHERE domain_id = @domain_id AND check_type = 'DMARC' AND is_valid = 1)
    BEGIN
        INSERT INTO @recommendations (type, priority, message, action)
        VALUES ('DMARC', 'medium', 'Configure DMARC policy', 'Add DMARC record to your DNS');
    END
    ELSE
    BEGIN
        -- Vérifier si DMARC est trop permissif
        DECLARE @dmarc_policy NVARCHAR(50);
        SELECT @dmarc_policy = JSON_VALUE(check_data, '$.policy')
        FROM domain_auth_checks 
        WHERE domain_id = @domain_id AND check_type = 'DMARC' AND is_valid = 1;
        
        IF @dmarc_policy = 'none'
        BEGIN
            INSERT INTO @recommendations (type, priority, message, action)
            VALUES ('DMARC', 'medium', 'Consider upgrading DMARC policy from "none" to "quarantine"', 'Update DMARC policy');
        END
    END
    
    -- Retourner les recommandations
    SELECT * FROM @recommendations ORDER BY 
        CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
        END;
END;

GO

-- Procédure stockée pour mettre à jour le statut d'un domaine
CREATE PROCEDURE sp_update_domain_status
    @domain_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE domains 
    SET updated_at = GETDATE()
    WHERE id = @domain_id;
    
    PRINT 'Statut du domaine mis à jour';
END;

GO

-- Données de test (optionnel)
-- INSERT INTO domains (user_id, domain_name, is_primary, is_active) VALUES (1, 'example.com', 1, 1);

PRINT 'Tables d''authentification de domaine créées avec succès!';
PRINT 'Vues et procédures stockées créées avec succès!'; 