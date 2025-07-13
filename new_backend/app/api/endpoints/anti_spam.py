from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...db.database import get_db
from ...services.anti_spam_service import AntiSpamService
from ...schemas.anti_spam import (
    EmailLimitsResponse, SenderReputationResponse, EmailSendLogResponse,
    AntiSpamDashboardResponse, EmailLimitCheckRequest, EmailLimitCheckResponse
)
from ...middleware.auth import get_current_user
from ...models.models import User
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/limits", response_model=EmailLimitsResponse)
async def get_email_limits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupère les limites d'envoi actuelles pour l'utilisateur"""
    anti_spam_service = AntiSpamService(db)
    limits = anti_spam_service.get_user_email_limits(current_user.id)
    warnings = anti_spam_service.get_spam_warnings(current_user.id)
    
    return EmailLimitsResponse(
        **limits,
        warnings=warnings
    )

@router.get("/reputation", response_model=SenderReputationResponse)
async def get_sender_reputation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupère la réputation de l'expéditeur"""
    anti_spam_service = AntiSpamService(db)
    
    # Mettre à jour la réputation avant de la retourner
    anti_spam_service.update_sender_reputation(current_user.id)
    
    # Récupérer la réputation mise à jour
    from ...models.anti_spam_models import SenderReputation
    reputation = db.query(SenderReputation).filter(
        SenderReputation.user_id == current_user.id
    ).first()
    
    if not reputation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Réputation non trouvée"
        )
    
    return SenderReputationResponse(
        reputation_score=float(reputation.reputation_score),
        total_emails_sent=reputation.total_emails_sent,
        bounced_emails=reputation.bounced_emails,
        spam_reports=reputation.spam_reports,
        successful_deliveries=reputation.successful_deliveries,
        warmup_status=reputation.warmup_status,
        last_calculated=reputation.last_calculated
    )

@router.get("/logs", response_model=List[EmailSendLogResponse])
async def get_email_send_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50
):
    """Récupère les logs d'envoi d'emails récents"""
    from ...models.anti_spam_models import EmailSendLog
    
    logs = db.query(EmailSendLog).filter(
        EmailSendLog.user_id == current_user.id
    ).order_by(EmailSendLog.sent_at.desc()).limit(limit).all()
    
    return [
        EmailSendLogResponse(
            id=log.id,
            recipient_email=log.recipient_email,
            subject=log.subject,
            sent_at=log.sent_at,
            status=log.status,
            message_id=log.message_id,
            bounce_reason=log.bounce_reason,
            spam_score=float(log.spam_score) if log.spam_score else None
        )
        for log in logs
    ]

@router.post("/check-limits", response_model=EmailLimitCheckResponse)
async def check_email_limits(
    request: EmailLimitCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Vérifie si l'utilisateur peut envoyer des emails selon les limites"""
    anti_spam_service = AntiSpamService(db)
    can_send, message = anti_spam_service.check_email_limits(
        current_user.id, 
        request.recipient_count
    )
    
    limits = anti_spam_service.get_user_email_limits(current_user.id)
    warnings = anti_spam_service.get_spam_warnings(current_user.id)
    
    return EmailLimitCheckResponse(
        can_send=can_send,
        message=message,
        limits=EmailLimitsResponse(
            **limits,
            warnings=warnings
        )
    )

@router.get("/dashboard", response_model=AntiSpamDashboardResponse)
async def get_anti_spam_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Récupère le tableau de bord anti-spam complet"""
    anti_spam_service = AntiSpamService(db)
    
    # Mettre à jour la réputation
    anti_spam_service.update_sender_reputation(current_user.id)
    
    # Récupérer toutes les données
    limits = anti_spam_service.get_user_email_limits(current_user.id)
    warnings = anti_spam_service.get_spam_warnings(current_user.id)
    
    # Récupérer la réputation
    from ...models.anti_spam_models import SenderReputation
    reputation = db.query(SenderReputation).filter(
        SenderReputation.user_id == current_user.id
    ).first()
    
    if not reputation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Réputation non trouvée"
        )
    
    # Récupérer les logs récents
    from ...models.anti_spam_models import EmailSendLog
    recent_logs = db.query(EmailSendLog).filter(
        EmailSendLog.user_id == current_user.id
    ).order_by(EmailSendLog.sent_at.desc()).limit(10).all()
    
    return AntiSpamDashboardResponse(
        user_limits=EmailLimitsResponse(
            **limits,
            warnings=warnings
        ),
        reputation=SenderReputationResponse(
            reputation_score=float(reputation.reputation_score),
            total_emails_sent=reputation.total_emails_sent,
            bounced_emails=reputation.bounced_emails,
            spam_reports=reputation.spam_reports,
            successful_deliveries=reputation.successful_deliveries,
            warmup_status=reputation.warmup_status,
            last_calculated=reputation.last_calculated
        ),
        recent_logs=[
            EmailSendLogResponse(
                id=log.id,
                recipient_email=log.recipient_email,
                subject=log.subject,
                sent_at=log.sent_at,
                status=log.status,
                message_id=log.message_id,
                bounce_reason=log.bounce_reason,
                spam_score=float(log.spam_score) if log.spam_score else None
            )
            for log in recent_logs
        ],
        warnings=warnings
    )

@router.post("/initialize")
async def initialize_anti_spam(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initialise les données anti-spam pour un utilisateur"""
    anti_spam_service = AntiSpamService(db)
    anti_spam_service.initialize_user_anti_spam(current_user.id)
    
    return {"message": "Données anti-spam initialisées avec succès"}