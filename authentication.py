import random
import os
import sendgrid
from sendgrid.helpers.mail import Mail
from itsdangerous import URLSafeTimedSerializer

# Setup
SENDGRID_API_KEY = "your_api_key"
VERIFICATION_SECRET = "a_random_secret_key"
BASE_URL = "https://yourapp.com/verify"

sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
serializer = URLSafeTimedSerializer(VERIFICATION_SECRET)

def send_verification_email(user_email):
    token = serializer.dumps(user_email, salt='email-verify')
    verify_url = f"{BASE_URL}?token={token}"

    message = Mail(
        from_email="your_verified_sender@example.com",
        to_emails=user_email,
        subject="Verify Your Email",
        html_content=f"Click <a href='{verify_url}'>here</a> to verify your email."
    )

    response = sg.send(message)
    return response.status_code


from flask import request
from itsdangerous import BadSignature, SignatureExpired

def verify_email_token(token):
    try:
        email = serializer.loads(token, salt='email-verify', max_age=3600)  # 1 hour
        # ✅ Mark email as verified in DB
        return f"Email {email} successfully verified."
    except SignatureExpired:
        return "Verification link expired."
    except BadSignature:
        return "Invalid verification link."