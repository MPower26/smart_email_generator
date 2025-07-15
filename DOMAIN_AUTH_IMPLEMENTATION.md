# Implémentation de l'Authentification de Domaine (SPF, DKIM, DMARC)

## Vue d'ensemble

Cette implémentation ajoute un système complet d'authentification de domaine à l'application Smart Email Generator. Le système vérifie automatiquement la configuration SPF, DKIM et DMARC pour chaque domaine configuré par les utilisateurs.

## Fonctionnalités implémentées

### 1. Vérifications d'authentification

#### SPF (Sender Policy Framework)
- Vérifie la présence d'un enregistrement TXT SPF sur le domaine
- Valide le format de l'enregistrement SPF
- Analyse les mécanismes SPF et fournit des recommandations
- Détecte les configurations problématiques (ex: `~all` au lieu de `-all`)

#### DKIM (DomainKeys Identified Mail)
- Vérifie la présence d'enregistrements DKIM pour le sélecteur configuré
- Valide le format des enregistrements DKIM
- Génère automatiquement des paires de clés DKIM
- Fournit les enregistrements DNS à ajouter

#### DMARC (Domain-based Message Authentication, Reporting and Conformance)
- Vérifie la présence d'un enregistrement DMARC sur `_dmarc.domain.com`
- Analyse la politique DMARC (none, quarantine, reject)
- Recommande des améliorations de politique
- Détecte les configurations manquantes

### 2. Système d'alertes

- **Alertes automatiques** lors de la détection de problèmes
- **Niveaux d'alerte** : warning, error, critical
- **Types d'alerte** spécifiques pour chaque problème
- **Résolution manuelle** des alertes
- **Historique** des alertes avec timestamps

### 3. Interface utilisateur

- **Dashboard** pour visualiser tous les domaines
- **Statuts visuels** avec codes couleur et icônes
- **Barres de progression** pour l'état d'authentification
- **Modales détaillées** pour chaque domaine
- **Formulaires** pour ajouter/modifier des domaines
- **Recommandations** contextuelles

### 4. Vérifications automatiques

- **Vérifications périodiques** (toutes les 24h par défaut)
- **Vérifications manuelles** à la demande
- **Vérifications immédiates** lors de l'ajout d'un domaine
- **Gestion des erreurs** et retry automatique

## Architecture technique

### Backend (Python/FastAPI)

#### Modèles de données
```python
# new_backend/app/models/domain_auth_models.py
- Domain: Informations sur le domaine
- DomainAuthCheck: Résultats des vérifications
- DomainAlert: Alertes générées
```

#### Services
```python
# new_backend/app/services/domain_auth_service.py
- DomainAuthService: Service principal d'authentification
- Vérifications SPF, DKIM, DMARC
- Génération de clés DKIM
- Gestion des alertes

# new_backend/app/services/domain_auth_scheduler.py
- DomainAuthScheduler: Planificateur de vérifications
- Vérifications périodiques automatiques
- Gestion des tâches de fond
```

#### API Endpoints
```python
# new_backend/app/api/endpoints/domain_auth.py
POST /api/domains                    # Créer un domaine
GET /api/domains                     # Lister les domaines
GET /api/domains/{id}                # Détails d'un domaine
PUT /api/domains/{id}                # Modifier un domaine
DELETE /api/domains/{id}             # Supprimer un domaine
POST /api/domains/{id}/check-auth    # Vérifier l'authentification
POST /api/domains/{id}/generate-dkim # Générer des clés DKIM
GET /api/domains/{id}/configuration  # Configuration DNS
POST /api/domains/{id}/check-now     # Vérification immédiate
POST /api/domains/check-all          # Vérifier tous les domaines
```

### Frontend (React)

#### Services
```javascript
// frontend/src/services/domainAuthService.js
- API client pour les domaines
- Utilitaires de statut et recommandations
- Formatage des données DNS
```

#### Composants
```javascript
// frontend/src/components/DomainManager.js
- Interface principale de gestion des domaines
- Cartes de domaine avec statuts
- Modales de détails
- Formulaires d'ajout/modification
```

#### Styles
```css
// frontend/src/components/DomainManager.css
- Design moderne et responsive
- Codes couleur pour les statuts
- Animations et transitions
- Support mobile
```

## Installation et configuration

### 1. Dépendances

Ajoutez les dépendances suivantes :

```bash
# Backend
pip install dnspython==2.7.0
pip install cryptography

# Frontend (déjà inclus)
# Aucune dépendance supplémentaire requise
```

### 2. Migration de base de données

#### Option A : Migration Alembic (recommandée)
Exécutez la migration Alembic pour créer les nouvelles tables :

```bash
cd new_backend
alembic upgrade head
```

#### Option B : Script SQL direct
Si vous préférez exécuter les requêtes SQL directement, utilisez le fichier :

```sql
-- Exécutez le contenu du fichier new_backend/create_domain_auth_tables.sql
-- dans votre gestionnaire de base de données SQL Server
```

Le script SQL inclut :
- Création des tables avec contraintes et index
- Vues pour les requêtes courantes
- Procédures stockées pour la maintenance
- Optimisations pour SQL Server

### 3. Configuration

Aucune configuration supplémentaire requise. Le système utilise les paramètres par défaut :
- Vérifications toutes les 24h
- Timeout DNS de 10 secondes
- Sélecteur DKIM par défaut : "default"

## Utilisation

### 1. Ajouter un domaine

1. Accédez à l'interface de gestion des domaines
2. Cliquez sur "Add Domain"
3. Entrez le nom de domaine (ex: example.com)
4. Le système vérifie automatiquement l'authentification

### 2. Configurer l'authentification

#### SPF
Ajoutez un enregistrement TXT sur votre domaine :
```
v=spf1 include:_spf.yourdomain.com ~all
```

#### DKIM
1. Cliquez sur "Generate DKIM" dans l'interface
2. Ajoutez l'enregistrement DNS fourni
3. Attendez la propagation DNS (peut prendre jusqu'à 24h)

#### DMARC
Ajoutez un enregistrement TXT sur `_dmarc.yourdomain.com` :
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

### 3. Surveiller les statuts

- **Vert** : Toutes les vérifications passent
- **Orange** : Avertissements (DMARC permissif, etc.)
- **Rouge** : Erreurs critiques (SPF/DKIM manquants)
- **Bleu** : Configuration incomplète

## Exemples de données

### Réponse API typique

```json
{
  "domain": "example.com",
  "auth_checks": [
    {
      "type": "SPF",
      "record_found": true,
      "valid": true,
      "check_data": {
        "spf_record": "v=spf1 include:_spf.example.com ~all",
        "validation_details": {
          "mechanisms": ["Include: _spf.example.com", "Default: ~all"],
          "recommendations": ["Consider using '-all' instead of '~all'"]
        }
      }
    },
    {
      "type": "DKIM",
      "record_found": true,
      "valid": true,
      "check_data": {
        "dkim_record": "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...",
        "selector": "default",
        "dkim_domain": "default._domainkey.example.com"
      }
    },
    {
      "type": "DMARC",
      "record_found": true,
      "valid": true,
      "check_data": {
        "dmarc_record": "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com",
        "policy": "quarantine"
      }
    }
  ],
  "alerts": [],
  "overall_status": "valid"
}
```

### Structure de base de données

#### Tables principales

```sql
-- Table des domaines
CREATE TABLE domains (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    domain_name NVARCHAR(255) NOT NULL,
    is_primary BIT DEFAULT 0,
    is_active BIT DEFAULT 1,
    dkim_selector NVARCHAR(100) NULL,
    dkim_private_key NTEXT NULL,
    dkim_public_key NTEXT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 NULL,
    CONSTRAINT FK_domains_users FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Table des vérifications
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

-- Table des alertes
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
```

#### Vues utiles

```sql
-- Vue pour le statut d'authentification
CREATE VIEW v_domain_auth_status AS
SELECT 
    d.id, d.user_id, d.domain_name, d.is_primary, d.is_active,
    COUNT(dac.id) as total_checks,
    SUM(CASE WHEN dac.is_valid = 1 THEN 1 ELSE 0 END) as valid_checks,
    COUNT(da.id) as total_alerts,
    SUM(CASE WHEN da.is_resolved = 0 THEN 1 ELSE 0 END) as unresolved_alerts,
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
```

#### Procédures stockées

```sql
-- Nettoyage des alertes résolues
CREATE PROCEDURE sp_cleanup_resolved_alerts @days_to_keep INT = 30
AS
BEGIN
    DELETE FROM domain_alerts 
    WHERE is_resolved = 1 
    AND created_at < DATEADD(day, -@days_to_keep, GETDATE());
END;

-- Obtenir les recommandations d'un domaine
CREATE PROCEDURE sp_get_domain_recommendations @domain_id INT
AS
BEGIN
    -- Logique pour générer les recommandations
    -- Voir le fichier SQL complet pour plus de détails
END;
```

## Sécurité

### Chiffrement des clés DKIM
- Les clés privées DKIM sont stockées de manière sécurisée
- Utilisation de la bibliothèque `cryptography` pour la génération
- Pas de stockage en clair des clés sensibles

### Validation des entrées
- Validation stricte des noms de domaine
- Protection contre les injections DNS
- Limitation des requêtes DNS

### Isolation des données
- Chaque utilisateur ne voit que ses propres domaines
- Vérifications d'autorisation sur tous les endpoints
- Pas de fuite de données entre utilisateurs

## Monitoring et maintenance

### Logs
Le système génère des logs détaillés pour :
- Vérifications DNS réussies/échouées
- Création/résolution d'alertes
- Erreurs de configuration
- Performance des vérifications

### Métriques
- Temps de réponse DNS par domaine
- Taux de réussite des vérifications
- Nombre d'alertes par type
- Utilisation des ressources

### Maintenance
- Nettoyage automatique des anciennes alertes
- Rotation des logs
- Monitoring de la santé du système

## Dépannage

### Problèmes courants

1. **Vérifications DNS échouent**
   - Vérifiez la connectivité réseau
   - Vérifiez les serveurs DNS configurés
   - Augmentez le timeout DNS si nécessaire

2. **Alertes persistantes**
   - Vérifiez la propagation DNS (peut prendre 24h)
   - Vérifiez la syntaxe des enregistrements DNS
   - Utilisez des outils de validation DNS externes

3. **Performance lente**
   - Ajustez l'intervalle de vérification
   - Optimisez les requêtes DNS
   - Surveillez l'utilisation des ressources

### Support
Pour toute question ou problème, consultez :
- Les logs de l'application
- La documentation DNS officielle
- Les outils de validation DNS en ligne

## Évolutions futures

### Fonctionnalités prévues
- Support de plusieurs sélecteurs DKIM
- Intégration avec des fournisseurs DNS
- Rapports d'authentification détaillés
- Notifications par email des alertes
- API webhook pour les changements de statut

### Améliorations techniques
- Cache DNS intelligent
- Vérifications parallèles
- Support IPv6
- Intégration avec des services de réputation 