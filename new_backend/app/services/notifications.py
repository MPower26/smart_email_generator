import sendgrid
from sendgrid.helpers.mail import Mail
import os

def sendgrid_notify(to_email, subject, content):
    sg = sendgrid.SendGridAPIClient(api_key=os.getenv("SENDGRID_API_KEY"))
    message = Mail(from_email="your@email.com", to_emails=to_email, subject=subject, html_content=content)
    sg.send(message)
