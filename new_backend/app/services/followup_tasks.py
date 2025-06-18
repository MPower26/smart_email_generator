from datetime import datetime
from app.models.models import GeneratedEmail, User
from app.services.gmail_service import check_reply  # You'll need to implement this
from app.services.notifications import sendgrid_notify  # You'll need to implement this
from sqlalchemy.orm import Session
from sqlalchemy import and_

# Example function for use with Celery, APScheduler, or a manual cron job
def check_and_notify_followups(db: Session):
    now = datetime.utcnow()
    # Find all emails that are due for followup but not yet sent to the user
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
        if not check_reply(user, email):  # Implement: check if prospect replied
            # No reply detected, notify user
            sendgrid_notify(
                to_email=user.email,
                subject="You have follow-ups to send!",
                content=f"Prospect {email.recipient_email} did not reply. Please send a follow-up email."
            )
            # Optionally update status to prevent duplicate notifications:
            email.status = "followup_due"
            db.commit()
        else:
            # If prospect replied, mark as completed
            email.status = "completed"
            db.commit()
