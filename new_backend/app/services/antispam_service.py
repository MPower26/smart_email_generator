import re
import json
from datetime import datetime, timedelta
from typing import Dict, Tuple, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from ..models.models import (
    User, GeneratedEmail, EmailSendingStats, EmailSendingLimits,
    HourlySendingStats, DomainReputation, SpamAlert, SpamContentCheck
)


class AntiSpamService:
    """Service to handle anti-spam protection and monitoring"""
    
    # Liste des mots suspects qui augmentent le score spam
    SPAM_WORDS = [
        'free', 'guarantee', 'no obligation', 'risk free', 'urgent', 
        'act now', 'limited time', 'click here', 'buy now', 'order now',
        'earn money', 'make money', 'work from home', 'million dollars',
        'congratulations', 'winner', 'prize', 'lottery', 'cash bonus',
        'viagra', 'cialis', 'pharmacy', 'drugs', 'pills', 'weight loss',
        'lose weight', 'diet', 'miracle', 'cure', 'hot singles',
        '100% free', '100% satisfied', 'additional income', 'be your own boss',
        'big bucks', 'billion', 'cash', 'cheap', 'deal', 'debt',
        'discount', 'earn extra cash', 'fast cash', 'financial freedom',
        'get paid', 'giveaway', 'guaranteed', 'increase sales', 'investment',
        'lowest price', 'money back', 'no cost', 'no fees', 'one time',
        'pennies a day', 'potential earnings', 'pure profit', 'save big',
        'serious cash', 'subject to credit', 'unsecured credit', 'your income',
        'click below', 'click to remove', 'direct email', 'direct marketing',
        'do it today', 'for instant access', 'get it now', 'info you requested',
        'information you requested', 'instant', 'now only', 'once in lifetime',
        'one click away', 'order today', 'please read', 'promise you',
        'see for yourself', 'sign up free today', 'supplies are limited',
        'take action now', 'what are you waiting for', 'while supplies last',
        'will not believe your eyes', 'winner', 'winning', 'you have been selected',
        'your income', 'amazing', 'cancel at any time', 'check or money order',
        'congratulations', 'dear friend', 'for free', 'great offer',
        'guarantee', 'have you been turned down', 'hello', 'lowest price',
        'make money', 'no catch', 'no cost', 'no credit check', 'no fees',
        'no gimmick', 'no hidden costs', 'no hidden fees', 'no interest',
        'no investment', 'no obligation', 'no purchase necessary', 'no questions asked',
        'no strings attached', 'not junk', 'notspam', 'off shore',
        'online marketing', 'opt in', 'performance', 'priority mail',
        'produced and sent out', 'profits', 'real thing', 'refinance',
        'removal instructions', 'remove', 'reply remove subject', 'search engine',
        'sent in compliance', 'spam', 'stop', 'stop snoring', 'unsubscribe',
        'vacation', 'vacation offers', 'weekend getaway', 'who really wins',
        'xxx', 'you are a winner', 'you have been selected'
    ]
    
    def __init__(self, db: Session):
        self.db = db
    
    async def check_can_send_email(self, user_id: int) -> Tuple[bool, str]:
        """Vérifie si un utilisateur peut envoyer un email"""
        
        # Récupérer ou créer les limites de l'utilisateur
        limits = self.db.query(EmailSendingLimits).filter_by(user_id=user_id).first()
        if not limits:
            limits = EmailSendingLimits(user_id=user_id)
            self.db.add(limits)
            self.db.commit()
        
        # Vérifier si le compte est suspendu
        if limits.is_suspended:
            return False, f"Compte suspendu: {limits.suspension_reason}"
        
        # Vérifier la limite quotidienne
        today = datetime.utcnow().date()
        daily_stats = self.db.query(EmailSendingStats).filter(
            EmailSendingStats.user_id == user_id,
            func.date(EmailSendingStats.date) == today
        ).first()
        
        if not daily_stats:
            daily_stats = EmailSendingStats(
                user_id=user_id,
                date=today,
                emails_sent=0
            )
            self.db.add(daily_stats)
            self.db.commit()
        
        if daily_stats.emails_sent >= limits.daily_limit:
            return False, f"Limite quotidienne atteinte ({daily_stats.emails_sent}/{limits.daily_limit})"
        
        # Vérifier la limite horaire
        current_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        hourly_stats = self.db.query(HourlySendingStats).filter(
            HourlySendingStats.user_id == user_id,
            HourlySendingStats.hour_timestamp == current_hour
        ).first()
        
        if not hourly_stats:
            hourly_stats = HourlySendingStats(
                user_id=user_id,
                hour_timestamp=current_hour,
                emails_sent=0
            )
            self.db.add(hourly_stats)
            self.db.commit()
        
        if hourly_stats.emails_sent >= limits.hourly_limit:
            return False, f"Limite horaire atteinte ({hourly_stats.emails_sent}/{limits.hourly_limit})"
        
        # Alertes de prévention
        if daily_stats.emails_sent >= limits.daily_limit * 0.8:
            await self.create_alert(
                user_id,
                "daily_limit_warning",
                "warning",
                f"Attention: Vous avez utilisé {daily_stats.emails_sent}/{limits.daily_limit} de votre limite quotidienne"
            )
        
        if hourly_stats.emails_sent >= limits.hourly_limit * 0.8:
            await self.create_alert(
                user_id,
                "hourly_limit_warning",
                "warning",
                f"Attention: Vous avez utilisé {hourly_stats.emails_sent}/{limits.hourly_limit} de votre limite horaire"
            )
        
        return True, "OK"
    
    async def record_email_sent(self, user_id: int, recipient_email: str):
        """Enregistre l'envoi d'un email dans les statistiques"""
        
        # Mettre à jour les stats quotidiennes
        today = datetime.utcnow().date()
        daily_stats = self.db.query(EmailSendingStats).filter(
            EmailSendingStats.user_id == user_id,
            func.date(EmailSendingStats.date) == today
        ).first()
        
        if daily_stats:
            daily_stats.emails_sent += 1
        else:
            daily_stats = EmailSendingStats(
                user_id=user_id,
                date=today,
                emails_sent=1
            )
            self.db.add(daily_stats)
        
        # Mettre à jour les stats horaires
        current_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        hourly_stats = self.db.query(HourlySendingStats).filter(
            HourlySendingStats.user_id == user_id,
            HourlySendingStats.hour_timestamp == current_hour
        ).first()
        
        if hourly_stats:
            hourly_stats.emails_sent += 1
        else:
            hourly_stats = HourlySendingStats(
                user_id=user_id,
                hour_timestamp=current_hour,
                emails_sent=1
            )
            self.db.add(hourly_stats)
        
        # Mettre à jour la réputation du domaine
        domain = recipient_email.split('@')[1] if '@' in recipient_email else 'unknown'
        domain_rep = self.db.query(DomainReputation).filter_by(domain=domain).first()
        
        if domain_rep:
            domain_rep.total_sent += 1
            domain_rep.last_sent_at = datetime.utcnow()
        else:
            domain_rep = DomainReputation(
                domain=domain,
                total_sent=1,
                last_sent_at=datetime.utcnow()
            )
            self.db.add(domain_rep)
        
        self.db.commit()
    
    async def check_email_content(self, email: GeneratedEmail) -> Dict:
        """Analyse le contenu d'un email pour détecter du spam potentiel"""
        
        content = (email.subject + " " + email.content).lower()
        spam_score = 0
        detected_words = []
        
        # Vérifier les mots spam
        for word in self.SPAM_WORDS:
            if word.lower() in content:
                spam_score += 1
                detected_words.append(word)
        
        # Vérifier la présence d'un lien de désinscription
        has_unsubscribe = 'unsubscribe' in content or 'se désinscrire' in content
        if not has_unsubscribe:
            spam_score += 5  # Pénalité importante pour absence de lien de désinscription
        
        # Calculer le ratio texte/image
        image_count = content.count('<img') + content.count('[image]') + content.count('[video]')
        text_length = len(re.sub(r'<[^>]+>', '', email.content))  # Enlever HTML
        text_to_image_ratio = text_length / (image_count + 1) if image_count > 0 else 100
        
        if text_to_image_ratio < 100:  # Trop d'images par rapport au texte
            spam_score += 3
        
        # Vérifier la personnalisation
        personalization_markers = [
            email.recipient_name,
            email.recipient_company,
            '{{', '}}', '[', ']'  # Placeholders
        ]
        personalization_score = sum(1 for marker in personalization_markers if marker and marker in content)
        
        if personalization_score < 2:
            spam_score += 2  # Email pas assez personnalisé
        
        # Enregistrer l'analyse
        spam_check = SpamContentCheck(
            generated_email_id=email.id,
            spam_score=spam_score,
            spam_words_detected=json.dumps(detected_words),
            has_unsubscribe_link=has_unsubscribe,
            text_to_image_ratio=int(text_to_image_ratio),
            personalization_score=personalization_score
        )
        self.db.add(spam_check)
        self.db.commit()
        
        # Créer une alerte si le score est élevé
        if spam_score > 10:
            await self.create_alert(
                email.user_id,
                "high_spam_score",
                "critical",
                f"Email avec score spam élevé ({spam_score}): {', '.join(detected_words[:5])}"
            )
        elif spam_score > 5:
            await self.create_alert(
                email.user_id,
                "medium_spam_score",
                "warning",
                f"Email avec score spam moyen ({spam_score}): {', '.join(detected_words[:3])}"
            )
        
        return {
            "spam_score": spam_score,
            "detected_words": detected_words,
            "has_unsubscribe_link": has_unsubscribe,
            "text_to_image_ratio": text_to_image_ratio,
            "personalization_score": personalization_score,
            "risk_level": "high" if spam_score > 10 else "medium" if spam_score > 5 else "low"
        }
    
    async def create_alert(self, user_id: int, alert_type: str, alert_level: str, message: str):
        """Crée une alerte pour l'utilisateur"""
        
        # Vérifier si une alerte similaire existe déjà récemment
        recent_alert = self.db.query(SpamAlert).filter(
            SpamAlert.user_id == user_id,
            SpamAlert.alert_type == alert_type,
            SpamAlert.created_at > datetime.utcnow() - timedelta(hours=1)
        ).first()
        
        if not recent_alert:
            alert = SpamAlert(
                user_id=user_id,
                alert_type=alert_type,
                alert_level=alert_level,
                message=message
            )
            self.db.add(alert)
            self.db.commit()
    
    async def get_user_sending_summary(self, user_id: int) -> Dict:
        """Récupère un résumé des statistiques d'envoi de l'utilisateur"""
        
        user = self.db.query(User).filter_by(id=user_id).first()
        limits = self.db.query(EmailSendingLimits).filter_by(user_id=user_id).first()
        
        if not limits:
            limits = EmailSendingLimits(user_id=user_id)
            self.db.add(limits)
            self.db.commit()
        
        today = datetime.utcnow().date()
        daily_stats = self.db.query(EmailSendingStats).filter(
            EmailSendingStats.user_id == user_id,
            func.date(EmailSendingStats.date) == today
        ).first()
        
        current_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        hourly_stats = self.db.query(HourlySendingStats).filter(
            HourlySendingStats.user_id == user_id,
            HourlySendingStats.hour_timestamp == current_hour
        ).first()
        
        # Statistiques des 7 derniers jours
        week_ago = datetime.utcnow() - timedelta(days=7)
        week_stats = self.db.query(
            func.sum(EmailSendingStats.emails_sent).label('total_sent'),
            func.sum(EmailSendingStats.emails_bounced).label('total_bounced'),
            func.sum(EmailSendingStats.emails_complained).label('total_complained'),
            func.avg(EmailSendingStats.reputation_score).label('avg_reputation')
        ).filter(
            EmailSendingStats.user_id == user_id,
            EmailSendingStats.date >= week_ago
        ).first()
        
        # Alertes non lues
        unread_alerts = self.db.query(SpamAlert).filter(
            SpamAlert.user_id == user_id,
            SpamAlert.is_read == False
        ).count()
        
        return {
            "user_email": user.email,
            "current_tier": limits.current_tier,
            "is_suspended": limits.is_suspended,
            "suspension_reason": limits.suspension_reason,
            "limits": {
                "daily": limits.daily_limit,
                "hourly": limits.hourly_limit
            },
            "usage_today": {
                "emails_sent": daily_stats.emails_sent if daily_stats else 0,
                "daily_remaining": limits.daily_limit - (daily_stats.emails_sent if daily_stats else 0),
                "hourly_sent": hourly_stats.emails_sent if hourly_stats else 0,
                "hourly_remaining": limits.hourly_limit - (hourly_stats.emails_sent if hourly_stats else 0)
            },
            "week_stats": {
                "total_sent": week_stats.total_sent or 0,
                "total_bounced": week_stats.total_bounced or 0,
                "total_complained": week_stats.total_complained or 0,
                "avg_reputation": float(week_stats.avg_reputation or 100)
            },
            "unread_alerts": unread_alerts,
            "warm_up_status": self._get_warmup_status(limits)
        }
    
    def _get_warmup_status(self, limits: EmailSendingLimits) -> Dict:
        """Calcule le statut de warm-up de l'utilisateur"""
        
        if limits.current_tier == 'established' or limits.current_tier == 'premium':
            return {"status": "completed", "progress": 100}
        
        days_since_start = (datetime.utcnow() - limits.warm_up_started_at).days
        
        # Progression sur 30 jours
        progress = min(100, (days_since_start / 30) * 100)
        
        return {
            "status": "in_progress" if progress < 100 else "completed",
            "progress": int(progress),
            "days_remaining": max(0, 30 - days_since_start),
            "next_increase_in": self._calculate_next_increase(limits)
        }
    
    def _calculate_next_increase(self, limits: EmailSendingLimits) -> int:
        """Calcule le nombre de jours avant la prochaine augmentation de limite"""
        
        if limits.last_limit_increase:
            days_since_increase = (datetime.utcnow() - limits.last_limit_increase).days
            # Augmentation tous les 5 jours pendant le warm-up
            return max(0, 5 - days_since_increase)
        else:
            # Première augmentation après 5 jours
            days_since_start = (datetime.utcnow() - limits.warm_up_started_at).days
            return max(0, 5 - days_since_start)
    
    async def update_warm_up_limits(self, user_id: int):
        """Met à jour automatiquement les limites pendant le warm-up"""
        
        limits = self.db.query(EmailSendingLimits).filter_by(user_id=user_id).first()
        if not limits or limits.current_tier in ['established', 'premium']:
            return
        
        days_since_start = (datetime.utcnow() - limits.warm_up_started_at).days
        
        # Progression graduelle sur 30 jours
        if days_since_start >= 30:
            limits.current_tier = 'established'
            limits.daily_limit = 500
            limits.hourly_limit = 50
        elif days_since_start >= 20:
            limits.current_tier = 'warming'
            limits.daily_limit = 300
            limits.hourly_limit = 30
        elif days_since_start >= 10:
            limits.daily_limit = 150
            limits.hourly_limit = 20
        elif days_since_start >= 5:
            limits.daily_limit = 100
            limits.hourly_limit = 15
        
        limits.last_limit_increase = datetime.utcnow()
        self.db.commit()
        
        await self.create_alert(
            user_id,
            "limit_increased",
            "info",
            f"Vos limites ont été augmentées! Quotidienne: {limits.daily_limit}, Horaire: {limits.hourly_limit}"
        )
    
    async def check_domain_reputation(self, domain: str) -> bool:
        """Vérifie si un domaine est safe pour l'envoi"""
        
        domain_rep = self.db.query(DomainReputation).filter_by(domain=domain).first()
        
        if not domain_rep:
            return True  # Nouveau domaine, OK par défaut
        
        if domain_rep.is_blocked:
            return False
        
        # Calculer le taux de problème
        if domain_rep.total_sent > 0:
            problem_rate = (domain_rep.total_bounced + domain_rep.total_complained) / domain_rep.total_sent
            if problem_rate > 0.1:  # Plus de 10% de problèmes
                domain_rep.is_blocked = True
                self.db.commit()
                return False
        
        return domain_rep.reputation_score > 30