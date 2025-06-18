from datetime import datetime
from app.models.models import GeneratedEmail, User
from app.services.gmail_service import check_reply  # Ensure this is implemented
from app.services.notifications import sendgrid_notify  # Ensure this is implemented
from sqlalchemy.orm import Session
from sqlalchemy import and_

def check_and_notify_followups(db: Session):
    now = datetime.utcnow()
    # --- FOLLOW-UP NOTIFICATIONS ---
    # Find emails due for follow-up that haven't moved to followup yet
    followups = db.query(GeneratedEmail).filter(
        and_(
            GeneratedEmail.status == "outreach_sent",
            GeneratedEmail.followup_due_at <= now
        )
    ).all()

    for email in followups:
        user = db.query(User).filter_by(id=email.user_id).first()
        if user is None:
            continue
        if not check_reply(user, email):
            sendgrid_notify(
                to_email=user.email,
                subject="You have follow-ups to send!",
                content=f"Prospect {email.recipient_email} did not reply. Please send a follow-up email."
            )
            email.status = "followup_due"
            db.commit()
        else:
            email.status = "completed"
            db.commit()

    # --- LAST-CHANCE NOTIFICATIONS ---
    # Find emails due for last-chance that haven't moved to lastchance yet
    lastchances = db.query(GeneratedEmail).filter(
        and_(
            GeneratedEmail.status == "followup_due",
            GeneratedEmail.lastchance_due_at <= now
        )
    ).all()

    for email in lastchances:
        user = db.query(User).filter_by(id=email.user_id).first()
        if user is None:
            continue
        if not check_reply(user, email):
            sendgrid_notify(
                to_email=user.email,
                subject="You have last-chance emails to send!",
                content=f"Prospect {email.recipient_email} still did not reply. Please send a last-chance follow-up."
            )
            email.status = "lastchance_due"
            db.commit()
        else:
            email.status = "completed"
            db.commit()
