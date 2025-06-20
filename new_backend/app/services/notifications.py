import sendgrid
from sendgrid.helpers.mail import Mail
import os
import logging

logger = logging.getLogger(__name__)

def sendgrid_notify(to_email, subject, content):
    """
    Send notification email via SendGrid
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        content: Email content (HTML)
    """
    try:
        api_key = os.getenv("SENDGRID_API_KEY")
        from_email = os.getenv("SENDGRID_FROM_EMAIL", "noreply@smartemailgenerator.com")
        
        if not api_key:
            logger.error("SendGrid API key not configured")
            return False
            
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        message = Mail(
            from_email=from_email, 
            to_emails=to_email, 
            subject=subject, 
            html_content=content
        )
        
        response = sg.send(message)
        logger.info(f"SendGrid notification sent to {to_email}: {response.status_code}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send SendGrid notification to {to_email}: {str(e)}")
        return False
