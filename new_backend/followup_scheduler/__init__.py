import os
import logging
from datetime import datetime, timezone

import azure.functions as func
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from sqlalchemy import create_engine, and_
from sqlalchemy.orm import sessionmaker

# Import models - adjust path as needed for Azure Functions deployment
try:
    from app.models.models import User, GeneratedEmail
except ImportError:
    # Fallback for Azure Functions deployment
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from app.models.models import User, GeneratedEmail

logger = logging.getLogger(__name__)

# These settings must be configured in your Azure Function App's "Configuration" section.
DATABASE_URL = os.getenv("DATABASE_URL")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "noreply@smartemailgenerator.com")
APP_URL = os.getenv("APP_URL", "https://jolly-bush-0bae83703.6.azurestaticapps.net")

# Set up SQLAlchemy Engine and Session
try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
except Exception as e:
    engine = None
    SessionLocal = None
    logger.error(f"Failed to create database engine: {e}")

def send_digest_email(to_email: str, subject: str, html_content: str) -> bool:
    """Sends a single email via SendGrid."""
    if not SENDGRID_API_KEY:
        logger.error("SENDGRID_API_KEY is not set. Cannot send notification email.")
        return False

    sg = SendGridAPIClient(SENDGRID_API_KEY)
    message = Mail(
        from_email=SENDGRID_FROM_EMAIL,
        to_emails=to_email,
        subject=subject,
        html_content=html_content
    )
    try:
        response = sg.send(message)
        logger.info(f"Notification digest sent to {to_email}, SendGrid status: {response.status_code}")
        return 200 <= response.status_code < 300
    except Exception as e:
        logger.error(f"Error sending digest email to {to_email}: {e}")
        return False

def main(timer: func.TimerRequest) -> None:
    """
    Main function triggered by the timer. Queries for due emails and sends notifications.
    """
    if not SessionLocal:
        logger.critical("Database session is not available. Aborting reminder job.")
        return

    now = datetime.now(timezone.utc)
    logger.info(f"Notification job running at {now.isoformat()}")
    session = SessionLocal()

    try:
        users = session.query(User).filter(User.is_active == True).all()

        for user in users:
            # Query for due "followup" emails using the correct field name
            count_followup = session.query(GeneratedEmail).filter(
                and_(
                    GeneratedEmail.user_id == user.id,
                    GeneratedEmail.stage == "followup",
                    GeneratedEmail.status == "followup_due",
                    GeneratedEmail.followup_due_at <= now
                )
            ).count()

            # Query for due "lastchance" emails using the correct field name
            count_lastchance = session.query(GeneratedEmail).filter(
                and_(
                    GeneratedEmail.user_id == user.id,
                    GeneratedEmail.stage == "lastchance",
                    GeneratedEmail.status == "lastchance_due",
                    GeneratedEmail.lastchance_due_at <= now
                )
            ).count()

            if count_followup or count_lastchance:
                subject = "🕑 You have emails due for follow-up"
                html_body = f"""
                <p>Hi {user.full_name or user.email},</p>
                <p>This is a reminder that you have emails ready to be sent:</p>
                <ul>
                  {'<li>You have <strong>%d</strong> follow-up emails due.</li>' % count_followup if count_followup else ''}
                  {'<li>You have <strong>%d</strong> last-chance emails due.</li>' % count_lastchance if count_lastchance else ''}
                </ul>
                <p>
                  <a href="{APP_URL}">Click here to go to your dashboard</a> to review and send them.
                </p>
                <p>— The Smart Email Generator Team</p>
                """
                send_digest_email(user.email, subject, html_body)

    except Exception as e:
        logger.critical(f"The reminder job failed with an unhandled exception: {e}", exc_info=True)
        session.rollback()
    finally:
        session.close()

    logger.info("Notification job finished.") 
