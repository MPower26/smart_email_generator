# Guide de Déploiement - Mesures Anti-Spam

## Vue d'ensemble

Ce guide détaille les étapes pour déployer les nouvelles mesures anti-spam conformes aux recommandations de Google Workspace.

## 1. Exécution des scripts SQL sur Azure SQL Database

### Étape 1 : Créer les tables de base

Exécutez le fichier `email_limits_tables.sql` dans l'ordre suivant :

```sql
-- 1. Tables de base (exécuter dans cet ordre)
-- Chaque CREATE TABLE doit être dans son propre batch
```

**Important** : Utilisez `GO` entre chaque instruction CREATE pour séparer les batches.

### Étape 2 : Créer les procédures de maintenance

Exécutez le fichier `email_limits_maintenance.sql` :

```sql
-- Procédures stockées et vues
-- Chaque CREATE PROCEDURE/VIEW doit être précédé d'un GO
```

### Étape 3 : Vérifier l'installation

```sql
-- Vérifier que toutes les tables sont créées
SELECT * FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME IN ('email_daily_limits', 'sender_reputation', 'email_send_log', 'email_limit_rules');

-- Vérifier les procédures stockées
SELECT * FROM INFORMATION_SCHEMA.ROUTINES 
WHERE ROUTINE_TYPE = 'PROCEDURE' AND ROUTINE_NAME LIKE 'sp_%email%';
```

## 2. Configuration du Backend

### Variables d'environnement

Aucune nouvelle variable d'environnement requise.

### Déploiement des fichiers Python

1. Déployer le nouveau service : `app/services/email_limits_service.py`
2. Mettre à jour : `app/api/endpoints/emails.py`
3. Mettre à jour : `app/api/auth.py`

## 3. Configuration Frontend

### Nouveaux composants React

1. `EmailLimitsDisplay.js` - Affichage des limites quotidiennes
2. `SpamScoreValidator.js` - Validation du contenu des emails

### Intégration dans l'interface

Ajouter les composants dans vos pages d'envoi d'emails :

```jsx
import EmailLimitsDisplay from './components/EmailLimitsDisplay';
import SpamScoreValidator from './components/SpamScoreValidator';

// Dans votre composant
<EmailLimitsDisplay onLimitsUpdate={handleLimitsUpdate} />
<SpamScoreValidator 
  subject={emailSubject} 
  body={emailBody} 
  onValidation={handleValidation} 
/>
```

## 4. Configuration des tâches planifiées

### Azure Functions ou Logic Apps

Créer une tâche planifiée qui exécute quotidiennement :

```sql
EXEC sp_reset_daily_limits;
```

Recommandation : Exécuter à 00:00 UTC chaque jour.

## 5. Limites par défaut

Les limites suivantes sont configurées par défaut :

- **Nouveaux comptes (warmup)** :
  - 50 emails/jour
  - 30 destinataires uniques/jour
  
- **Comptes établis** :
  - 500 emails/jour
  - 300 destinataires uniques/jour
  
- **Comptes haute réputation (score ≥ 8)** :
  - 2000 emails/jour
  - 1000 destinataires uniques/jour

## 6. Surveillance et Maintenance

### Tableau de bord admin

Utilisez la vue `vw_email_sending_dashboard` pour surveiller :
- Score de réputation des utilisateurs
- Volume d'envoi
- Taux de bounce
- Rapports de spam

### Alertes recommandées

Configurez des alertes pour :
- Taux de bounce > 5%
- Score de spam moyen > 3
- Utilisateurs atteignant 90% de leur limite quotidienne

## 7. Bonnes pratiques

### Pour les utilisateurs

1. **Période de montée en charge** : Les nouveaux comptes doivent augmenter progressivement leur volume d'envoi
2. **Qualité du contenu** : Éviter les mots-clés spam et personnaliser les emails
3. **Liste de contacts** : Maintenir une liste propre avec des emails valides

### Pour les administrateurs

1. **Surveillance** : Vérifier régulièrement les scores de réputation
2. **Support** : Aider les utilisateurs avec des scores de spam élevés
3. **Ajustements** : Modifier les limites selon les besoins via la table `email_limit_rules`

## 8. Rollback

En cas de problème :

1. Les anciennes fonctionnalités restent intactes
2. Pour désactiver les vérifications, commentez les appels à `EmailLimitsService` dans les endpoints
3. Les tables peuvent être conservées sans impact sur les performances

## 9. Tests post-déploiement

1. Créer un nouvel utilisateur et vérifier l'initialisation de la réputation
2. Tester l'envoi d'un email et vérifier la mise à jour des compteurs
3. Tester les limites en essayant d'envoyer au-delà de la limite
4. Valider un contenu d'email et vérifier le score de spam

## Support

Pour toute question ou problème :
- Vérifier les logs du backend pour les erreurs
- Consulter la documentation Google Workspace sur les bonnes pratiques d'envoi
- Contacter l'équipe de développement