# Système Anti-Spam - Smart Email Generator

## Vue d'ensemble

Ce système implémente des mesures anti-spam conformes aux recommandations de Google Workspace pour éviter que les emails soient considérés comme spam. Il inclut des limites d'envoi, un système de réputation d'expéditeur, et des avertissements en temps réel.

## Fonctionnalités principales

### 1. Limites d'envoi quotidiennes
- **Nouveaux utilisateurs** : 50 emails/jour
- **Utilisateurs actifs** : 500 emails/jour  
- **Utilisateurs avec excellente réputation** : 2000 emails/jour
- **Destinataires uniques** : 30-1000 selon la réputation

### 2. Système de réputation d'expéditeur
- Score de 0 à 10 basé sur :
  - Nombre d'emails envoyés
  - Taux de rebond
  - Signalements spam
  - Ancienneté du compte
- Statuts : `new`, `warming`, `active`, `restricted`

### 3. Logs détaillés
- Suivi de tous les emails envoyés
- Statuts : `pending`, `sent`, `bounced`, `delivered`
- Scores de spam pour chaque email

### 4. Avertissements en temps réel
- Alertes sur les limites quotidiennes
- Conseils pour améliorer la réputation
- Recommandations anti-spam

## Tables de base de données

### `email_daily_limits`
Suivi des limites quotidiennes par utilisateur
```sql
CREATE TABLE email_daily_limits (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    send_date DATE NOT NULL,
    emails_sent INT DEFAULT 0,
    unique_recipients INT DEFAULT 0,
    last_updated DATETIME DEFAULT GETDATE()
);
```

### `sender_reputation`
Réputation de l'expéditeur
```sql
CREATE TABLE sender_reputation (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    reputation_score DECIMAL(3,2) DEFAULT 5.00,
    total_emails_sent INT DEFAULT 0,
    bounced_emails INT DEFAULT 0,
    spam_reports INT DEFAULT 0,
    successful_deliveries INT DEFAULT 0,
    warmup_status VARCHAR(20) DEFAULT 'new'
);
```

### `email_send_log`
Logs détaillés des envois
```sql
CREATE TABLE email_send_log (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    sent_at DATETIME DEFAULT GETDATE(),
    status VARCHAR(20) DEFAULT 'pending',
    spam_score DECIMAL(3,2)
);
```

### `email_limit_rules`
Règles de limitation configurables
```sql
CREATE TABLE email_limit_rules (
    id INT IDENTITY(1,1) PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    default_value INT NOT NULL,
    warmup_value INT NOT NULL,
    max_value INT NOT NULL,
    is_active BIT DEFAULT 1
);
```

## API Endpoints

### `/api/anti-spam/limits`
Récupère les limites d'envoi actuelles
```json
{
  "emails_sent_today": 25,
  "unique_recipients_today": 20,
  "daily_limit": 500,
  "recipient_limit": 300,
  "reputation_score": 7.5,
  "warmup_status": "warming",
  "remaining_emails": 475,
  "remaining_recipients": 280,
  "warnings": ["⚠️ Votre compte est en période de montée en charge..."]
}
```

### `/api/anti-spam/reputation`
Récupère la réputation de l'expéditeur
```json
{
  "reputation_score": 7.5,
  "total_emails_sent": 150,
  "bounced_emails": 2,
  "spam_reports": 0,
  "successful_deliveries": 148,
  "warmup_status": "warming",
  "last_calculated": "2024-01-15T10:30:00Z"
}
```

### `/api/anti-spam/check-limits`
Vérifie si l'envoi est autorisé
```json
POST {
  "recipient_count": 10
}

Response {
  "can_send": true,
  "message": "Envoi autorisé. Il vous reste 465 emails aujourd'hui.",
  "limits": { ... }
}
```

### `/api/anti-spam/dashboard`
Tableau de bord complet anti-spam
```json
{
  "user_limits": { ... },
  "reputation": { ... },
  "recent_logs": [
    {
      "id": 1,
      "recipient_email": "test@example.com",
      "subject": "Test Email",
      "sent_at": "2024-01-15T10:30:00Z",
      "status": "sent",
      "spam_score": 1.2
    }
  ],
  "warnings": [ ... ]
}
```

## Intégration dans l'envoi d'emails

Le système anti-spam est automatiquement intégré dans le service d'envoi d'emails :

```python
def send_email_via_gmail(db: Session, user: User, email: GeneratedEmail):
    # Vérifier les limites anti-spam avant l'envoi
    anti_spam_service = AntiSpamService(db)
    can_send, message = anti_spam_service.check_email_limits(user.id, 1)
    
    if not can_send:
        raise HTTPException(status_code=429, detail=message)
    
    # Envoyer l'email...
    
    # Mettre à jour les logs anti-spam
    anti_spam_service.update_email_send_log(...)
    anti_spam_service.update_daily_limits(...)
```

## Interface utilisateur

### Composant AntiSpamWarnings
Affiche en temps réel :
- Avertissements anti-spam
- Limites d'envoi avec barres de progression
- Score de réputation et statut
- Conseils pour éviter le spam

### Intégration dans GenerateEmailsPage
- Affichage des avertissements avant génération
- Vérification des limites avant envoi
- Alertes en cas de dépassement

## Installation et configuration

### 1. Exécuter les scripts SQL
```sql
-- Exécuter les scripts de création des tables
-- (déjà fournis dans le message initial)

-- Initialiser les données pour les utilisateurs existants
-- Exécuter le script init_anti_spam.sql
```

### 2. Vérifier les imports
S'assurer que tous les nouveaux modules sont importés :
- `anti_spam_models.py`
- `anti_spam_service.py`
- `anti_spam.py` (endpoints)

### 3. Initialisation automatique
Les nouveaux utilisateurs sont automatiquement initialisés avec les données anti-spam lors de leur création.

## Maintenance

### Procédures de maintenance automatiques
```sql
-- Nettoyer les anciens logs (plus de 90 jours)
EXEC sp_cleanup_old_email_logs

-- Mettre à jour la réputation pour tous les utilisateurs
EXEC sp_update_sender_reputation @user_id

-- Réinitialiser les limites quotidiennes
EXEC sp_reset_daily_limits
```

### Surveillance
- Surveiller les scores de réputation < 3
- Vérifier les taux de rebond > 10%
- Analyser les signalements spam

## Bonnes pratiques

### Pour les utilisateurs
1. Commencer par de petits volumes (50 emails/jour)
2. Utiliser des adresses email valides
3. Éviter les mots-clés spam
4. Respecter les limites d'envoi
5. Surveiller le score de réputation

### Pour les développeurs
1. Tester les limites avec des comptes de test
2. Surveiller les logs d'erreur anti-spam
3. Ajuster les règles selon les besoins
4. Maintenir les procédures de nettoyage

## Conformité Google Workspace

Le système respecte les recommandations Google Workspace :
- Limites d'envoi progressives
- Période de montée en charge
- Suivi de la réputation
- Logs détaillés
- Avertissements préventifs

## Support

Pour toute question ou problème :
1. Vérifier les logs de l'API
2. Consulter les données de réputation
3. Analyser les logs d'envoi
4. Contacter l'équipe de développement