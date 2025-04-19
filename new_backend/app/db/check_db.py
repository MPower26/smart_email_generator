from app.db.database import get_db
from app.models.models import User, VerificationCode, EmailTemplate, GeneratedEmail
from sqlalchemy.orm import Session
import json

def check_database():
    db = next(get_db())
    
    # Check users
    users = db.query(User).all()
    print("\n=== USERS ===")
    if users:
        for user in users:
            print(f"ID: {user.id}")
            print(f"Email: {user.email}")
            print(f"Full Name: {user.full_name}")
            print(f"Position: {user.position}")
            print(f"Company Name: {user.company_name}")
            print(f"Is Verified: {user.is_verified}")
            print(f"Is Active: {user.is_active}")
            print("---")
    else:
        print("No users found")
    
    # Check emails
    emails = db.query(GeneratedEmail).all()
    print("\n=== EMAILS ===")
    if emails:
        for email in emails:
            print(f"ID: {email.id}, User ID: {email.user_id}")
            print(f"To: {email.recipient_email}")
            print(f"Subject: {email.subject}")
            print(f"Stage: {email.stage}")
            print(f"Status: {email.status}")
            print(f"Body: {email.content}")
            print("---")
    else:
        print("No emails found")
    
    # Check templates
    templates = db.query(EmailTemplate).all()
    print("\n=== TEMPLATES ===")
    if templates:
        for template in templates:
            print(f"ID: {template.id}, Name: {template.name}, User ID: {template.user_id}")
    else:
        print("No templates found")

if __name__ == "__main__":
    check_database() 