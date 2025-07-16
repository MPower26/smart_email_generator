import json
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.models.models import User, GeneratedEmail, EmailSendingLimits, EmailDailyLimits, EmailSendingStats, EmailLimitRules
from typing import Optional

# Plan warm-up par défaut (modifiable)
DEFAULT_WARMUP_PLAN = {
    "per_account": [
        {"day": 1, "max_emails": 20},
        {"day": 2, "max_emails": 50},
        {"day": 3, "max_emails": 100},
        {"day": 4, "max_emails": 200},
        {"day": 5, "max_emails": 400},
        {"day": 6, "max_emails": 800},
        {"day": 7, "max_emails": 1200},
        {"day": 8, "max_emails": 1600},
        {"day": 9, "max_emails": 2000},
    ],
    "per_domain": [
        {"day": 1, "max_emails": 50},
        {"day": 2, "max_emails": 100},
        {"day": 3, "max_emails": 200},
        {"day": 4, "max_emails": 400},
        {"day": 5, "max_emails": 800},
        {"day": 6, "max_emails": 1200},
        {"day": 7, "max_emails": 2000},
    ]
}


def get_warmup_day(user: User, db: Session) -> int:
    # Détermine le jour de warm-up pour l'utilisateur (depuis le premier envoi)
    first_email = db.query(GeneratedEmail).filter(GeneratedEmail.user_id == user.id).order_by(GeneratedEmail.created_at.asc()).first()
    if not first_email:
        return 1
    days = (date.today() - first_email.created_at.date()).days + 1
    return min(days, len(DEFAULT_WARMUP_PLAN["per_account"]))


def get_domain(user: User) -> Optional[str]:
    # Extrait le domaine de l'email utilisateur
    if not user.email or "@" not in user.email:
        return None
    return user.email.split("@")[-1].lower()


def get_warmup_quota(user: User, db: Session) -> dict:
    """
    Calcule le quota warm-up du jour pour l'utilisateur et son domaine, en tenant compte des métriques de la veille.
    Retourne un dict :
      {
        'user_quota': int,
        'domain_quota': int,
        'user_sent_today': int,
        'domain_sent_today': int,
        'user_remaining': int,
        'domain_remaining': int,
        'is_suspended': bool,
        'suspension_reason': str or None,
        'alert': str or None
      }
    """
    today = date.today()
    warmup_day = get_warmup_day(user, db)
    # Quota du plan warm-up
    user_quota = DEFAULT_WARMUP_PLAN["per_account"][warmup_day-1]["max_emails"]
    domain = get_domain(user)
    domain_quota = DEFAULT_WARMUP_PLAN["per_domain"][min(warmup_day-1, len(DEFAULT_WARMUP_PLAN["per_domain"])-1)]["max_emails"]
    # Emails envoyés aujourd'hui (user)
    user_sent_today = db.query(func.sum(EmailDailyLimits.emails_sent)).filter(
        EmailDailyLimits.user_id == user.id,
        EmailDailyLimits.send_date == today
    ).scalar() or 0
    # Emails envoyés aujourd'hui (domaine)
    user_ids_same_domain = [u.id for u in db.query(User).filter(User.email.like(f"%@{domain}"))]
    domain_sent_today = db.query(func.sum(EmailDailyLimits.emails_sent)).filter(
        EmailDailyLimits.user_id.in_(user_ids_same_domain),
        EmailDailyLimits.send_date == today
    ).scalar() or 0
    # Récupère les stats de la veille
    yesterday = today - timedelta(days=1)
    stats = db.query(EmailSendingStats).filter(
        EmailSendingStats.user_id == user.id,
        EmailSendingStats.date == yesterday
    ).first()
    open_rate = None
    bounce_rate = None
    complaint_rate = None
    alert = None
    if stats and stats.emails_sent:
        open_rate = 0  # TODO: add open tracking
        bounce_rate = (stats.emails_bounced or 0) / stats.emails_sent
        complaint_rate = (stats.emails_complained or 0) / stats.emails_sent
        # Règles conditionnelles
        if bounce_rate > 0.05:
            user_quota = max(int(user_quota * 0.5), user_sent_today)
            alert = "High bounce rate detected yesterday (>5%). Today's quota reduced. Please clean your list."
        elif open_rate is not None and open_rate < 0.1:
            user_quota = user_sent_today
            alert = "Low open rate detected yesterday (<10%). Today's quota frozen. Improve your content or list."
        if complaint_rate and complaint_rate > 0.01:
            alert = "Spam complaints detected. Sending suspended. Contact support."
    # Suspension
    sending_limits = db.query(EmailSendingLimits).filter(EmailSendingLimits.user_id == user.id).first()
    is_suspended = False
    suspension_reason = None
    if sending_limits and sending_limits.is_suspended:
        is_suspended = True
        suspension_reason = sending_limits.suspension_reason or "Account suspended due to spam or abuse."
        alert = suspension_reason
    # Calcul du quota restant
    user_remaining = max(0, user_quota - user_sent_today)
    domain_remaining = max(0, domain_quota - domain_sent_today)
    return {
        'user_quota': user_quota,
        'domain_quota': domain_quota,
        'user_sent_today': user_sent_today,
        'domain_sent_today': domain_sent_today,
        'user_remaining': user_remaining,
        'domain_remaining': domain_remaining,
        'is_suspended': is_suspended,
        'suspension_reason': suspension_reason,
        'alert': alert
    } 