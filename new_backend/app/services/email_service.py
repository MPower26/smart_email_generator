import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from ..config.settings import EMAIL_CONFIG
from app.services.gmail_service import send_gmail_email, GmailTokenError
from app.services.antispam_service import AntiSpamService
from fastapi import HTTPException
from datetime import datetime
from sqlalchemy.orm import Session
from ..models.models import User, GeneratedEmail

logger = logging.getLogger(__name__)

class EmailServiceError(Exception):
    """Custom exception for email service related errors."""
    pass

# Placeholder for verification email sending
async def send_verification_email(recipient_email: str, code: str):
    """Sends a verification code email using SendGrid."""
    try:
        # Create the email
        message = Mail()
        message.from_email = Email(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['from_name'])
        message.to = To(recipient_email)
        message.subject = 'Your Smart Email Generator Verification Code'
        
        # HTML content for the email
        html_content = f'''
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Verify Your Email</h2>
                <p>Your verification code is:</p>
                <h1 style="font-size: 32px; letter-spacing: 5px; background: #f5f5f5; padding: 15px; text-align: center; border-radius: 5px;">{code}</h1>
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">This email was sent by {EMAIL_CONFIG['from_name']}</p>
            </div>
        '''
        message.content = Content("text/html", html_content)

        # If a valid template ID is configured, use it
        if EMAIL_CONFIG['template_id'] and EMAIL_CONFIG['template_id'] != "your_template_id_here":
            message.template_id = EMAIL_CONFIG['template_id']
            message.dynamic_template_data = {
                'verification_code': code
            }
        
        # Send the email
        sg = SendGridAPIClient(EMAIL_CONFIG['api_key'])
        try:
            response = sg.send(message)
            if response.status_code not in range(200, 300):
                error_msg = f"SendGrid API returned status code {response.status_code}"
                logger.error(error_msg)
                raise EmailServiceError(error_msg)
        except Exception as e:
            logger.error(f"SendGrid API error: {str(e)}")
            raise EmailServiceError(f"SendGrid API error: {str(e)}") from e
            
        logger.info(f"Verification email sent successfully to {recipient_email}")
        return True
            
    except Exception as e:
        error_msg = f"Failed to send verification email: {str(e)}"
        logger.error(error_msg)
        raise EmailServiceError(error_msg) from e 

async def send_email_via_gmail(db: Session, user: User, email: GeneratedEmail):
    """Sends a single generated email using the user's Gmail account."""
    try:
        # Initialize anti-spam service
        antispam = AntiSpamService(db)
        
        # Check if user can send email (rate limits)
        can_send, reason = await antispam.check_can_send_email(user.id)
        if not can_send:
            raise HTTPException(
                status_code=429,  # Too Many Requests
                detail=f"Cannot send email: {reason}"
            )
        
        # Check domain reputation
        recipient_domain = email.recipient_email.split('@')[1] if '@' in email.recipient_email else 'unknown'
        domain_ok = await antispam.check_domain_reputation(recipient_domain)
        if not domain_ok:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot send to domain {recipient_domain}: Poor reputation or blocked"
            )
        
        # Check email content for spam
        spam_check = await antispam.check_email_content(email)
        if spam_check['risk_level'] == 'high':
            raise HTTPException(
                status_code=400,
                detail=f"Email blocked due to high spam risk (score: {spam_check['spam_score']}). Please review your content."
            )
        
        # Add warning header if medium risk
        if spam_check['risk_level'] == 'medium':
            logger.warning(f"Email {email.id} has medium spam risk: {spam_check['spam_score']}")
        
        # The actual sending logic using the Gmail service
        gmail_response = send_gmail_email(
            user=user,
            to_email=email.recipient_email,
            subject=email.subject,
            body=email.content
        )
        
        # If sending is successful, update the email's status in our DB
        email.status = f"{email.stage}_sent"
        email.sent_at = datetime.utcnow()
        db.commit()
        
        # Record the email as sent for statistics
        await antispam.record_email_sent(user.id, email.recipient_email)
        
        # Update warm-up limits if needed
        await antispam.update_warm_up_limits(user.id)
        
        return {"message": "Email sent successfully via Gmail", "gmail_response": gmail_response}
        
    except GmailTokenError as e:
        # This is the specific error for an expired/invalid token
        logger.error(f"Gmail token error for user {user.email}: {e}")
        raise HTTPException(
            status_code=401, 
            detail="Gmail token is invalid or expired. Please reconnect your account in settings."
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any other sending errors
        logger.error(f"Failed to send email {email.id} for user {user.email} via Gmail: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}") 
