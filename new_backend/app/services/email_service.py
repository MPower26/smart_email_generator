import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from ..config.settings import EMAIL_CONFIG

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