"""
Service pour gérer les limites d'envoi d'emails et les mesures anti-spam
Conforme aux recommandations Google Workspace
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Tuple, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from fastapi import HTTPException
import re
from urllib.parse import urlparse

from ..models.models import User, db

logger = logging.getLogger(__name__)

class EmailLimitsService:
    """Service pour gérer les limites d'envoi et la conformité anti-spam"""
    
    # Limites par défaut selon Google Workspace
    DEFAULT_LIMITS = {
        'daily_emails': 500,
        'hourly_emails': 100,
        'unique_recipients': 300,
        'batch_size': 50,
        'warmup_daily': 50,
        'warmup_recipients': 30
    }
    
    # Mots-clés spam à éviter
    SPAM_KEYWORDS = [
        'gratuit', 'gagner', 'urgent', 'limité', 'exclusif', 'promo',
        'réduction', 'offre spéciale', 'cliquez ici', 'agissez maintenant',
        'opportunité', 'revenu', 'investissement', 'miracle', 'garanti'
    ]
    
    @staticmethod
    async def check_sending_limits(db: Session, user_id: int, recipient_count: int) -> Tuple[bool, str]:
        """
        Vérifie si l'utilisateur peut envoyer des emails selon les limites
        
        Returns:
            Tuple[bool, str]: (peut_envoyer, message)
        """
        try:
            # Exécuter la procédure stockée
            result = db.execute(
                """
                DECLARE @can_send BIT, @message VARCHAR(500);
                EXEC sp_check_email_limits @user_id = :user_id, 
                                         @recipient_count = :recipient_count,
                                         @can_send = @can_send OUTPUT,
                                         @message = @message OUTPUT;
                SELECT @can_send as can_send, @message as message;
                """,
                {"user_id": user_id, "recipient_count": recipient_count}
            ).fetchone()
            
            return (bool(result.can_send), result.message)
            
        except Exception as e:
            logger.error(f"Erreur lors de la vérification des limites: {str(e)}")
            return (False, "Erreur lors de la vérification des limites d'envoi")
    
    @staticmethod
    async def update_send_count(db: Session, user_id: int, recipient_emails: List[str]):
        """Met à jour les compteurs d'envoi après un envoi réussi"""
        try:
            today = datetime.now().date()
            
            # Mettre à jour ou créer l'enregistrement du jour
            db.execute(
                """
                MERGE email_daily_limits AS target
                USING (SELECT :user_id as user_id, :send_date as send_date) AS source
                ON target.user_id = source.user_id AND target.send_date = source.send_date
                WHEN MATCHED THEN
                    UPDATE SET 
                        emails_sent = emails_sent + :count,
                        unique_recipients = unique_recipients + :unique_count,
                        last_updated = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (user_id, send_date, emails_sent, unique_recipients)
                    VALUES (:user_id, :send_date, :count, :unique_count);
                """,
                {
                    "user_id": user_id,
                    "send_date": today,
                    "count": len(recipient_emails),
                    "unique_count": len(set(recipient_emails))
                }
            )
            
            # Enregistrer dans le log
            for email in recipient_emails:
                db.execute(
                    """
                    INSERT INTO email_send_log (user_id, recipient_email, status)
                    VALUES (:user_id, :email, 'sent')
                    """,
                    {"user_id": user_id, "email": email}
                )
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour des compteurs: {str(e)}")
            db.rollback()
    
    @staticmethod
    def validate_email_content(subject: str, body: str) -> Dict[str, any]:
        """
        Valide le contenu de l'email pour éviter les marqueurs de spam
        
        Returns:
            Dict avec les résultats de validation
        """
        issues = []
        spam_score = 0
        
        # Vérifier la longueur du sujet
        if len(subject) > 100:
            issues.append("Le sujet est trop long (max 100 caractères)")
            spam_score += 1
        
        if len(subject) < 10:
            issues.append("Le sujet est trop court (min 10 caractères)")
            spam_score += 0.5
        
        # Vérifier les majuscules excessives
        if sum(1 for c in subject if c.isupper()) / len(subject) > 0.5:
            issues.append("Trop de majuscules dans le sujet")
            spam_score += 2
        
        # Vérifier les mots-clés spam
        content_lower = (subject + " " + body).lower()
        spam_words_found = [word for word in EmailLimitsService.SPAM_KEYWORDS if word in content_lower]
        if spam_words_found:
            issues.append(f"Mots-clés spam détectés: {', '.join(spam_words_found[:5])}")
            spam_score += len(spam_words_found) * 0.5
        
        # Vérifier les liens excessifs
        link_count = len(re.findall(r'https?://\S+', body))
        if link_count > 3:
            issues.append(f"Trop de liens ({link_count}). Maximum recommandé: 3")
            spam_score += (link_count - 3) * 0.5
        
        # Vérifier le ratio texte/HTML
        if '<html>' in body.lower() or '<body>' in body.lower():
            text_content = re.sub(r'<[^>]+>', '', body)
            if len(text_content) < len(body) * 0.3:
                issues.append("Ratio texte/HTML trop faible")
                spam_score += 1
        
        # Vérifier les caractères spéciaux excessifs
        special_chars = re.findall(r'[!$%]', subject)
        if len(special_chars) > 2:
            issues.append("Trop de caractères spéciaux dans le sujet")
            spam_score += 1
        
        return {
            'is_valid': spam_score < 3,
            'spam_score': min(spam_score, 10),
            'issues': issues,
            'recommendations': EmailLimitsService._get_recommendations(spam_score)
        }
    
    @staticmethod
    def _get_recommendations(spam_score: float) -> List[str]:
        """Retourne des recommandations basées sur le score de spam"""
        recommendations = []
        
        if spam_score >= 3:
            recommendations.append("⚠️ Risque élevé de classification comme spam")
            recommendations.append("Révisez le contenu pour être plus naturel et moins promotionnel")
        elif spam_score >= 2:
            recommendations.append("⚠️ Risque modéré de classification comme spam")
            recommendations.append("Évitez les mots promotionnels et les majuscules excessives")
        else:
            recommendations.append("✅ Contenu conforme aux bonnes pratiques")
        
        recommendations.extend([
            "Personnalisez vos emails avec le nom du destinataire",
            "Incluez toujours un lien de désinscription",
            "Utilisez une adresse d'expédition avec votre domaine vérifié",
            "Évitez d'envoyer plus de 50 emails par lot"
        ])
        
        return recommendations
    
    @staticmethod
    async def get_user_limits_info(db: Session, user_id: int) -> Dict:
        """Récupère les informations sur les limites de l'utilisateur"""
        try:
            result = db.execute(
                """
                SELECT 
                    emails_sent_today,
                    unique_recipients_today,
                    daily_limit,
                    recipient_limit,
                    reputation_score,
                    warmup_status
                FROM vw_user_email_limits
                WHERE user_id = :user_id
                """,
                {"user_id": user_id}
            ).fetchone()
            
            if result:
                return {
                    'emails_sent_today': result.emails_sent_today,
                    'unique_recipients_today': result.unique_recipients_today,
                    'daily_limit': result.daily_limit,
                    'recipient_limit': result.recipient_limit,
                    'reputation_score': float(result.reputation_score) if result.reputation_score else 5.0,
                    'warmup_status': result.warmup_status or 'new',
                    'remaining_emails': result.daily_limit - result.emails_sent_today,
                    'remaining_recipients': result.recipient_limit - result.unique_recipients_today
                }
            else:
                # Valeurs par défaut pour un nouvel utilisateur
                return {
                    'emails_sent_today': 0,
                    'unique_recipients_today': 0,
                    'daily_limit': EmailLimitsService.DEFAULT_LIMITS['warmup_daily'],
                    'recipient_limit': EmailLimitsService.DEFAULT_LIMITS['warmup_recipients'],
                    'reputation_score': 5.0,
                    'warmup_status': 'new',
                    'remaining_emails': EmailLimitsService.DEFAULT_LIMITS['warmup_daily'],
                    'remaining_recipients': EmailLimitsService.DEFAULT_LIMITS['warmup_recipients']
                }
                
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des limites: {str(e)}")
            raise HTTPException(status_code=500, detail="Erreur lors de la récupération des limites")
    
    @staticmethod
    async def initialize_user_reputation(db: Session, user_id: int):
        """Initialise la réputation d'un nouvel utilisateur"""
        try:
            db.execute(
                """
                INSERT INTO sender_reputation (user_id, reputation_score, warmup_status)
                VALUES (:user_id, 5.00, 'new')
                """,
                {"user_id": user_id}
            )
            db.commit()
        except Exception as e:
            # Ignorer si déjà existant
            db.rollback()
            logger.info(f"Réputation déjà initialisée pour l'utilisateur {user_id}")
    
    @staticmethod
    def validate_recipient_list(recipients: List[str]) -> Tuple[List[str], List[str]]:
        """
        Valide une liste de destinataires
        
        Returns:
            Tuple[valid_emails, invalid_emails]
        """
        valid_emails = []
        invalid_emails = []
        
        email_regex = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        
        for email in recipients:
            email = email.strip().lower()
            if email_regex.match(email):
                valid_emails.append(email)
            else:
                invalid_emails.append(email)
        
        return valid_emails, invalid_emails
    
    @staticmethod
    async def check_domain_authentication(db: Session, domain: str) -> Dict:
        """Vérifie l'authentification du domaine (SPF/DKIM/DMARC)"""
        try:
            result = db.execute(
                """
                SELECT spf_configured, dkim_configured, dmarc_configured, verification_status
                FROM authorized_domains
                WHERE domain_name = :domain
                """,
                {"domain": domain}
            ).fetchone()
            
            if result:
                return {
                    'is_authenticated': all([result.spf_configured, result.dkim_configured]),
                    'spf': bool(result.spf_configured),
                    'dkim': bool(result.dkim_configured),
                    'dmarc': bool(result.dmarc_configured),
                    'status': result.verification_status
                }
            else:
                return {
                    'is_authenticated': False,
                    'spf': False,
                    'dkim': False,
                    'dmarc': False,
                    'status': 'not_configured'
                }
                
        except Exception as e:
            logger.error(f"Erreur lors de la vérification du domaine: {str(e)}")
            return {
                'is_authenticated': False,
                'spf': False,
                'dkim': False,
                'dmarc': False,
                'status': 'error'
            }