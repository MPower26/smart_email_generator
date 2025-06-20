from datetime import datetime
from app.models.models import GeneratedEmail, User
from app.services.gmail_service import check_reply
from app.services.notifications import sendgrid_notify
from sqlalchemy.orm import Session
from sqlalchemy import and_

def check_and_notify_followups(db: Session):
    now = datetime.utcnow()
    
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
                subject="🚨 Last-Chance Email Due - Action Required!",
                content=f"""
                Hi {user.full_name or user.email},

                You have a last-chance email that's due to be sent!

                Recipient: {email.recipient_email}
                Company: {email.recipient_company or 'N/A'}
                Original Subject: {email.subject}

                This is your final opportunity to reach out to this prospect. Please log into your email campaign manager and send the last-chance follow-up email.

                Best regards,
                Your Email Campaign Manager
                """
            )
            email.status = "lastchance_due"
            db.commit()
        else:
            email.status = "completed"
            db.commit()
    
    # --- FOLLOW-UP REMINDERS ---
    # Send reminders for emails that are in followup_due status and approaching their followup_due_at date
    followup_reminders = db.query(GeneratedEmail).filter(
        and_(
            GeneratedEmail.status == "followup_due",
            GeneratedEmail.followup_due_at <= now
        )
    ).all()

    for email in followup_reminders:
        user = db.query(User).filter_by(id=email.user_id).first()
        if user is None:
            continue
        if not check_reply(user, email):
            # Calculate how overdue the email is
            overdue_hours = int((now - email.followup_due_at).total_seconds() / 3600)
            overdue_text = f"{overdue_hours} hours overdue" if overdue_hours > 0 else "Due now"
            
            sendgrid_notify(
                to_email=user.email,
                subject=f"📧 Follow-Up Email Due - {overdue_text}",
                content=f"""
                Hi {user.full_name or user.email},

                You have a follow-up email that needs to be sent!

                Recipient: {email.recipient_email}
                Company: {email.recipient_company or 'N/A'}
                Original Subject: {email.subject}
                Status: {overdue_text}

                Please log into your email campaign manager and send the follow-up email to maintain your outreach momentum.

                Best regards,
                Tom
                """
            )
        else:
            email.status = "completed"
            db.commit()
