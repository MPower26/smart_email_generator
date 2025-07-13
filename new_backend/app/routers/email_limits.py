from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User
from app.schemas.anti_spam import EmailLimitsResponse, EmailLimitCheckRequest as CheckEmailSendRequest, EmailLimitCheckResponse as CheckEmailSendResponse

router = APIRouter()

@router.get("/email-limits", response_model=EmailLimitsResponse)
async def get_email_limits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Récupérer les infos de la vue vw_user_email_limits
    sql = text("""
        SELECT user_id, email, emails_sent_today, unique_recipients_today, reputation_score, warmup_status, daily_limit, recipient_limit
        FROM vw_user_email_limits WHERE user_id = :user_id
    """)
    result = db.execute(sql, {"user_id": current_user.id}).fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="User limits not found")
    data = dict(result)
    # Générer un message d'avertissement
    warning = None
    if data["emails_sent_today"] >= 0.8 * data["daily_limit"]:
        warning = f"Attention : Vous avez atteint {data['emails_sent_today']} sur {data['daily_limit']} emails autorisés aujourd'hui."
    elif data["warmup_status"] == "new":
        warning = "Votre compte est en période de warmup. Limitez vos envois pour établir une bonne réputation."
    data["warning_message"] = warning
    return EmailLimitsResponse(**data)

@router.post("/check-email-send", response_model=CheckEmailSendResponse)
async def check_email_send(
    req: CheckEmailSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Appeler la procédure stockée sp_check_email_limits
    sql = text("""
        DECLARE @can_send BIT, @message VARCHAR(500);
        EXEC sp_check_email_limits :user_id, :recipient_count, @can_send OUTPUT, @message OUTPUT;
        SELECT @can_send AS can_send, @message AS message;
    """)
    result = db.execute(sql, {"user_id": current_user.id, "recipient_count": req.recipient_count}).fetchone()
    if not result:
        raise HTTPException(status_code=500, detail="Erreur lors de la vérification des limites d'envoi")
    return CheckEmailSendResponse(can_send=bool(result["can_send"]), message=result["message"]) 
