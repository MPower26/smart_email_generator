import os
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from dotenv import load_dotenv

load_dotenv('db.env')
logger = logging.getLogger(__name__)

async def send_verification_email(email: str, code: str):
    try:
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        from_email = Email(os.getenv('SENDER_EMAIL'))
        to_email = To(email)
        subject = "Your Verification Code"
        content = Content("text/plain", f"Your verification code is: {code}\n\nThis code will expire in 15 minutes.")
        
        mail = Mail(from_email, to_email, subject, content)
        response = sg.send(mail)
        
        if response.status_code == 202:
            logger.info(f"Verification email sent successfully to {email}")
            return True
        else:
            logger.error(f"Failed to send verification email. Status code: {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Error sending verification email: {str(e)}")
        raise 