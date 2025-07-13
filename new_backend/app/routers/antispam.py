from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict

from ..db.database import get_db
from ..middleware.auth import get_current_user
from ..models.models import User, SpamAlert
from ..services.antispam_service import AntiSpamService

router = APIRouter(
    prefix="/api/antispam",
    tags=["antispam"]
)

@router.get("/summary")
async def get_sending_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's sending statistics and limits"""
    antispam = AntiSpamService(db)
    summary = await antispam.get_user_sending_summary(current_user.id)
    return summary

@router.get("/alerts")
async def get_spam_alerts(
    limit: int = 50,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get spam alerts for the current user"""
    query = db.query(SpamAlert).filter(SpamAlert.user_id == current_user.id)
    
    if unread_only:
        query = query.filter(SpamAlert.is_read == False)
    
    alerts = query.order_by(SpamAlert.created_at.desc()).limit(limit).all()
    
    return [{
        "id": alert.id,
        "type": alert.alert_type,
        "level": alert.alert_level,
        "message": alert.message,
        "is_read": alert.is_read,
        "created_at": alert.created_at.isoformat()
    } for alert in alerts]

@router.put("/alerts/{alert_id}/read")
async def mark_alert_as_read(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a spam alert as read"""
    alert = db.query(SpamAlert).filter(
        SpamAlert.id == alert_id,
        SpamAlert.user_id == current_user.id
    ).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.is_read = True
    db.commit()
    
    return {"message": "Alert marked as read"}

@router.put("/alerts/read-all")
async def mark_all_alerts_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all spam alerts as read for the current user"""
    db.query(SpamAlert).filter(
        SpamAlert.user_id == current_user.id,
        SpamAlert.is_read == False
    ).update({"is_read": True})
    db.commit()
    
    return {"message": "All alerts marked as read"}

@router.get("/check-email")
async def check_email_before_send(
    to_email: str,
    subject: str,
    content: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if an email would pass anti-spam checks before sending"""
    antispam = AntiSpamService(db)
    
    # Check rate limits
    can_send, reason = await antispam.check_can_send_email(current_user.id)
    
    # Check domain reputation
    domain = to_email.split('@')[1] if '@' in to_email else 'unknown'
    domain_ok = await antispam.check_domain_reputation(domain)
    
    # Create temporary email object for content check
    from ..models.models import GeneratedEmail
    temp_email = GeneratedEmail(
        user_id=current_user.id,
        recipient_email=to_email,
        subject=subject,
        content=content,
        recipient_name="",
        recipient_company=""
    )
    
    # Don't save to DB, just check content
    spam_check = await antispam.check_email_content(temp_email)
    
    return {
        "can_send": can_send and domain_ok and spam_check['risk_level'] != 'high',
        "rate_limit_ok": can_send,
        "rate_limit_reason": reason if not can_send else "OK",
        "domain_ok": domain_ok,
        "domain": domain,
        "spam_check": spam_check
    }

@router.get("/warm-up-status")
async def get_warm_up_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the warm-up status for the current user"""
    from ..models.models import EmailSendingLimits
    
    limits = db.query(EmailSendingLimits).filter_by(user_id=current_user.id).first()
    if not limits:
        limits = EmailSendingLimits(user_id=current_user.id)
        db.add(limits)
        db.commit()
    
    antispam = AntiSpamService(db)
    warm_up_status = antispam._get_warmup_status(limits)
    
    return {
        "current_tier": limits.current_tier,
        "warm_up_started_at": limits.warm_up_started_at.isoformat(),
        "warm_up_status": warm_up_status
    }