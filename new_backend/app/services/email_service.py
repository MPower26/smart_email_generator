import os
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = logging.getLogger(__name__)

class EmailServiceError(Exception):
    """Custom exception for email service related errors."""
    pass

# Placeholder for verification email sending
async def send_verification_email(recipient_email: str, code: str):
    """Sends a verification code email using SendGrid."""
    SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
    SENDER_EMAIL = os.getenv("SENDER_EMAIL")
    FROM_NAME = os.getenv("SENDGRID_FROM_NAME", "Smart Email Generator")
    TEMPLATE_ID = os.getenv("SENDGRID_TEMPLATE_ID")
    
    if not all([SENDGRID_API_KEY, SENDER_EMAIL]):
        logger.error("Email service configuration missing: SENDGRID_API_KEY or SENDER_EMAIL not set")
        raise EmailServiceError("Email service not properly configured")

    try:
        from_email = Email(SENDER_EMAIL, FROM_NAME)
        to_email = To(recipient_email)
        
        html_content = f'''
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Verify Your Email</h2>
                <p>Your verification code is:</p>
                <h1 style="font-size: 32px; letter-spacing: 5px; background: #f5f5f5; padding: 15px; text-align: center; border-radius: 5px;">{code}</h1>
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">This email was sent by {FROM_NAME}</p>
            </div>
        '''
        
        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject='Your Smart Email Generator Verification Code',
            html_content=html_content
        )

        # If a template ID is configured, use it
        if TEMPLATE_ID:
            message.template_id = TEMPLATE_ID
            message.dynamic_template_data = {
                'verification_code': code
            }
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        
        if response.status_code not in range(200, 300):
            error_msg = f"SendGrid API returned status code {response.status_code}"
            logger.error(error_msg)
            raise EmailServiceError(error_msg)
            
        logger.info(f"Verification email sent successfully to {recipient_email}")
        return True
            
    except Exception as e:
        error_msg = f"Failed to send verification email: {str(e)}"
        logger.error(error_msg)
        raise EmailServiceError(error_msg) from e 