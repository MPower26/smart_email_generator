from app.db.database import get_db
from app.models.models import GeneratedEmail, User
from sqlalchemy.orm import Session

def add_sample_emails():
    db = next(get_db())
    
    # Get the user (or create one if needed)
    email = "mdp73@bath.ac.uk"  # Use the email shown in your auth header
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        print(f"Creating user with email {email}")
        user = User(
            email=email,
            is_verified=True,
            full_name="Test User",
            company_name="Test Company", 
            position="Test Position"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Delete ALL existing emails from the database
    print("Deleting ALL existing emails from the database")
    db.query(GeneratedEmail).delete()
    db.commit()
    
    # Add sample emails for each stage
    stages = ["outreach", "followup", "lastchance"]
    
    for i, stage in enumerate(stages):
        for j in range(2):  # 2 emails per stage
            email_obj = GeneratedEmail(
                user_id=user.id,
                recipient_email=f"recipient{i}{j}@example.com",
                recipient_name=f"Recipient {i}{j}",
                recipient_company="Sample Company",
                subject=f"Sample {stage.capitalize()} Email {j+1}",
                content=f"This is a sample {stage} email content #{j+1}.",
                status="draft",
                stage=stage
            )
            db.add(email_obj)
    
    db.commit()
    print("Sample emails added successfully")
    
    # Verify emails were added
    emails = db.query(GeneratedEmail).all()
    print(f"\nTotal emails in database: {len(emails)}")
    for email in emails:
        print(f"ID: {email.id}, User ID: {email.user_id}, Stage: {email.stage}, To: {email.recipient_email}")

if __name__ == "__main__":
    add_sample_emails() 