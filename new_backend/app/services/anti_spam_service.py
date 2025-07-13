from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date, timedelta
from typing import Dict, List, Tuple, Optional
from ..models.anti_spam_models import (
    EmailDailyLimit, SenderReputation, EmailSendLog, 
    EmailLimitRule, AuthorizedDomain
)
from ..models.models import User
import logging

logger = logging.getLogger(__name__)

class AntiSpamService:
    def __init__(self, db: Session):
        self.db = db

    def get_user_email_limits(self, user_id: int) -> Dict:
        """Récupère les limites d'envoi actuelles pour un utilisateur"""
        today = date.today()
        
        # Récupérer les limites quotidiennes actuelles
        daily_limit = self.db.query(EmailDailyLimit).filter(
            and_(
                EmailDailyLimit.user_id == user_id,
                EmailDailyLimit.send_date == today
            )
        ).first()
        
        # Récupérer la réputation de l'expéditeur
        reputation = self.db.query(SenderReputation).filter(
            SenderReputation.user_id == user_id
        ).first()
        
        # Récupérer les règles de limitation
        daily_rule = self.db.query(EmailLimitRule).filter(
            and_(
                EmailLimitRule.rule_type == 'daily_limit',
                EmailLimitRule.is_active == True
            )
        ).first()
        
        recipient_rule = self.db.query(EmailLimitRule).filter(
            and_(
                EmailLimitRule.rule_type == 'recipient_limit',
                EmailLimitRule.is_active == True
            )
        ).first()
        
        # Calculer les limites basées sur la réputation
        if reputation and reputation.warmup_status == 'new':
            daily_limit_value = daily_rule.warmup_value if daily_rule else 50
            recipient_limit_value = recipient_rule.warmup_value if recipient_rule else 30
        elif reputation and reputation.reputation_score >= 8:
            daily_limit_value = daily_rule.max_value if daily_rule else 2000
            recipient_limit_value = recipient_rule.max_value if recipient_rule else 1000
        else:
            daily_limit_value = daily_rule.default_value if daily_rule else 500
            recipient_limit_value = recipient_rule.default_value if recipient_rule else 300
        
        emails_sent_today = daily_limit.emails_sent if daily_limit else 0
        unique_recipients_today = daily_limit.unique_recipients if daily_limit else 0
        
        return {
            'emails_sent_today': emails_sent_today,
            'unique_recipients_today': unique_recipients_today,
            'daily_limit': daily_limit_value,
            'recipient_limit': recipient_limit_value,
            'reputation_score': reputation.reputation_score if reputation else 5.0,
            'warmup_status': reputation.warmup_status if reputation else 'new',
            'remaining_emails': daily_limit_value - emails_sent_today,
            'remaining_recipients': recipient_limit_value - unique_recipients_today
        }

    def check_email_limits(self, user_id: int, recipient_count: int) -> Tuple[bool, str]:
        """Vérifie si l'utilisateur peut envoyer des emails selon les limites"""
        limits = self.get_user_email_limits(user_id)
        
        # Vérifier la limite quotidienne
        if limits['emails_sent_today'] + recipient_count > limits['daily_limit']:
            return False, f"Limite quotidienne atteinte. Vous avez envoyé {limits['emails_sent_today']} emails sur {limits['daily_limit']} autorisés aujourd'hui."
        
        # Vérifier la limite de destinataires uniques
        if limits['unique_recipients_today'] + recipient_count > limits['recipient_limit']:
            return False, f"Limite de destinataires uniques atteinte. Vous avez contacté {limits['unique_recipients_today']} destinataires sur {limits['recipient_limit']} autorisés aujourd'hui."
        
        # Avertissement pour les nouveaux utilisateurs
        if limits['warmup_status'] == 'new':
            return True, "Attention: Votre compte est en période de montée en charge. Limitez vos envois pour établir une bonne réputation."
        
        return True, f"Envoi autorisé. Il vous reste {limits['remaining_emails'] - recipient_count} emails aujourd'hui."

    def update_email_send_log(self, user_id: int, recipient_email: str, subject: str, 
                            message_id: str = None, status: str = 'sent') -> None:
        """Met à jour le log des emails envoyés"""
        log_entry = EmailSendLog(
            user_id=user_id,
            recipient_email=recipient_email,
            subject=subject,
            message_id=message_id,
            status=status
        )
        self.db.add(log_entry)
        self.db.commit()

    def update_daily_limits(self, user_id: int, recipient_count: int, 
                          unique_recipients: List[str]) -> None:
        """Met à jour les limites quotidiennes après envoi"""
        today = date.today()
        
        # Récupérer ou créer l'entrée quotidienne
        daily_limit = self.db.query(EmailDailyLimit).filter(
            and_(
                EmailDailyLimit.user_id == user_id,
                EmailDailyLimit.send_date == today
            )
        ).first()
        
        if not daily_limit:
            daily_limit = EmailDailyLimit(
                user_id=user_id,
                send_date=today,
                emails_sent=0,
                unique_recipients=0
            )
            self.db.add(daily_limit)
        
        # Mettre à jour les compteurs
        daily_limit.emails_sent += recipient_count
        daily_limit.unique_recipients += len(unique_recipients)
        daily_limit.last_updated = datetime.utcnow()
        
        self.db.commit()

    def update_sender_reputation(self, user_id: int) -> None:
        """Met à jour la réputation de l'expéditeur"""
        # Récupérer ou créer l'entrée de réputation
        reputation = self.db.query(SenderReputation).filter(
            SenderReputation.user_id == user_id
        ).first()
        
        if not reputation:
            reputation = SenderReputation(user_id=user_id)
            self.db.add(reputation)
        
        # Calculer les statistiques des 30 derniers jours
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        recent_stats = self.db.query(
            func.count(EmailSendLog.id).label('total_sent'),
            func.count(EmailSendLog.id).filter(EmailSendLog.status == 'bounced').label('bounced'),
            func.count(EmailSendLog.id).filter(EmailSendLog.spam_score >= 5).label('spam_reports')
        ).filter(
            and_(
                EmailSendLog.user_id == user_id,
                EmailSendLog.sent_at >= thirty_days_ago
            )
        ).first()
        
        # Calculer les statistiques globales
        global_stats = self.db.query(
            func.count(EmailSendLog.id).label('total_sent'),
            func.count(EmailSendLog.id).filter(EmailSendLog.status == 'bounced').label('bounced'),
            func.count(EmailSendLog.id).filter(EmailSendLog.spam_score >= 5).label('spam_reports')
        ).filter(EmailSendLog.user_id == user_id).first()
        
        # Calculer le nombre de jours actifs
        days_active = self.db.query(func.count(func.distinct(EmailDailyLimit.send_date))).filter(
            and_(
                EmailDailyLimit.user_id == user_id,
                EmailDailyLimit.send_date >= thirty_days_ago.date()
            )
        ).scalar()
        
        # Calculer le nouveau score de réputation
        new_score = 5.0  # Score de base
        
        # Bonus pour l'ancienneté
        if days_active >= 20:
            new_score += 1.0
        elif days_active >= 10:
            new_score += 0.5
        
        # Pénalité pour les bounces
        if recent_stats.total_sent > 0:
            bounce_rate = (recent_stats.bounced * 100.0) / recent_stats.total_sent
            if bounce_rate > 10:
                new_score -= 2.0
            elif bounce_rate > 5:
                new_score -= 1.0
        
        # Bonus pour le volume sans problème
        if recent_stats.total_sent > 100 and recent_stats.bounced < 5:
            new_score += 1.5
        
        # S'assurer que le score reste entre 0 et 10
        new_score = max(0, min(10, new_score))
        
        # Mettre à jour la réputation
        reputation.reputation_score = new_score
        reputation.total_emails_sent = global_stats.total_sent
        reputation.bounced_emails = global_stats.bounced
        reputation.spam_reports = global_stats.spam_reports
        reputation.successful_deliveries = global_stats.total_sent - global_stats.bounced
        reputation.last_calculated = datetime.utcnow()
        
        # Mettre à jour le statut de warmup
        if days_active >= 30 and global_stats.total_sent >= 500:
            reputation.warmup_status = 'active'
        elif days_active >= 7 and global_stats.total_sent >= 100:
            reputation.warmup_status = 'warming'
        
        self.db.commit()

    def get_spam_warnings(self, user_id: int) -> List[str]:
        """Récupère les avertissements anti-spam pour l'utilisateur"""
        warnings = []
        limits = self.get_user_email_limits(user_id)
        
        # Avertissement pour les nouveaux utilisateurs
        if limits['warmup_status'] == 'new':
            warnings.append("⚠️ Votre compte est en période de montée en charge. Limitez vos envois à 50 emails par jour.")
        
        # Avertissement si proche de la limite
        if limits['remaining_emails'] <= 50:
            warnings.append(f"⚠️ Attention: Il vous reste seulement {limits['remaining_emails']} emails aujourd'hui.")
        
        # Avertissement pour la réputation
        if limits['reputation_score'] < 3:
            warnings.append("⚠️ Votre réputation d'expéditeur est faible. Évitez les envois massifs.")
        
        return warnings

    def initialize_user_anti_spam(self, user_id: int) -> None:
        """Initialise les données anti-spam pour un nouvel utilisateur"""
        # Créer l'entrée de réputation
        reputation = SenderReputation(
            user_id=user_id,
            reputation_score=5.0,
            warmup_status='new'
        )
        self.db.add(reputation)
        
        # Insérer les règles par défaut si elles n'existent pas
        default_rules = [
            ('Daily email limit', 'daily_limit', 500, 50, 2000, 'Nombre maximum d\'emails par jour'),
            ('Hourly email limit', 'hourly_limit', 100, 10, 400, 'Nombre maximum d\'emails par heure'),
            ('Unique recipients per day', 'recipient_limit', 300, 30, 1000, 'Nombre maximum de destinataires uniques par jour'),
            ('Emails per batch', 'batch_limit', 50, 10, 100, 'Nombre maximum d\'emails par lot d\'envoi')
        ]
        
        for rule_name, rule_type, default_val, warmup_val, max_val, description in default_rules:
            existing_rule = self.db.query(EmailLimitRule).filter(
                EmailLimitRule.rule_name == rule_name
            ).first()
            
            if not existing_rule:
                rule = EmailLimitRule(
                    rule_name=rule_name,
                    rule_type=rule_type,
                    default_value=default_val,
                    warmup_value=warmup_val,
                    max_value=max_val,
                    description=description
                )
                self.db.add(rule)
        
        self.db.commit()
