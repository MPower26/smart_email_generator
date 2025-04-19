from app.db.database import get_db
from app.models.models import GeneratedEmail, User, user_friendship, FriendRequest
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

def add_test_data():
    db = next(get_db())
    
    # Create or get both users
    user1_email = "mdp73@bath.ac.uk"
    user2_email = "martindpower@outlook.com"
    
    users = {}
    for email in [user1_email, user2_email]:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Creating user with email {email}")
            user = User(
                email=email,
                is_verified=True,
                full_name=f"Test User ({email})",
                company_name="Test Company", 
                position="Test Position",
                combine_contacts=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        users[email] = user
    
    # Make them friends
    print("Setting up friendship between users...")
    # First check if friendship already exists
    existing_friendship = db.query(user_friendship).filter(
        user_friendship.c.user_id == users[user1_email].id,
        user_friendship.c.friend_id == users[user2_email].id
    ).first()
    
    if not existing_friendship:
        # Create friendship in both directions
        db.execute(user_friendship.insert().values(
            user_id=users[user1_email].id,
            friend_id=users[user2_email].id
        ))
        db.execute(user_friendship.insert().values(
            user_id=users[user2_email].id,
            friend_id=users[user1_email].id
        ))
        db.commit()
        print("Friendship created!")
    else:
        print("Friendship already exists!")
    
    # Common contacts (shared between both users)
    common_contacts = [
        {
            "email": "john.doe@techcorp.com",
            "name": "John Doe",
            "company": "TechCorp",
            "stage": "outreach"
        },
        {
            "email": "jane.smith@innovate.com",
            "name": "Jane Smith",
            "company": "Innovate Inc",
            "stage": "followup"
        }
    ]
    
    # Unique contacts for user1
    user1_unique_contacts = [
        {
            "email": "alice.johnson@startup.com",
            "name": "Alice Johnson",
            "company": "Startup Co",
            "stage": "outreach"
        },
        {
            "email": "bob.wilson@enterprise.com",
            "name": "Bob Wilson",
            "company": "Enterprise Solutions",
            "stage": "lastchance"
        }
    ]
    
    # Unique contacts for user2
    user2_unique_contacts = [
        {
            "email": "charlie.brown@tech.com",
            "name": "Charlie Brown",
            "company": "Tech Solutions",
            "stage": "outreach"
        },
        {
            "email": "diana.miller@digital.com",
            "name": "Diana Miller",
            "company": "Digital Innovations",
            "stage": "followup"
        }
    ]
    
    # Add emails for both users
    print("Adding test emails...")
    
    # Add common contacts to both users
    for contact in common_contacts:
        for user_email, user in users.items():
            # Check if email already exists for this user
            existing_email = db.query(GeneratedEmail).filter(
                GeneratedEmail.user_id == user.id,
                GeneratedEmail.recipient_email == contact["email"]
            ).first()
            
            if not existing_email:
                email_obj = GeneratedEmail(
                    user_id=user.id,
                    recipient_email=contact["email"],
                    recipient_name=contact["name"],
                    recipient_company=contact["company"],
                    subject=f"Meeting Request - {contact['company']}",
                    content=f"Dear {contact['name']},\n\nI hope this email finds you well. I would like to discuss potential collaboration opportunities between our companies.\n\nBest regards,\nTest User",
                    status="draft",
                    stage=contact["stage"],
                    to=contact["email"],  # Legacy field
                    body=f"Dear {contact['name']},\n\nI hope this email finds you well. I would like to discuss potential collaboration opportunities between our companies.\n\nBest regards,\nTest User"  # Legacy field
                )
                db.add(email_obj)
    
    # Add unique contacts to user1
    for contact in user1_unique_contacts:
        existing_email = db.query(GeneratedEmail).filter(
            GeneratedEmail.user_id == users[user1_email].id,
            GeneratedEmail.recipient_email == contact["email"]
        ).first()
        
        if not existing_email:
            email_obj = GeneratedEmail(
                user_id=users[user1_email].id,
                recipient_email=contact["email"],
                recipient_name=contact["name"],
                recipient_company=contact["company"],
                subject=f"Partnership Discussion - {contact['company']}",
                content=f"Dear {contact['name']},\n\nI'm reaching out to explore potential partnership opportunities between our organizations.\n\nBest regards,\nTest User",
                status="draft",
                stage=contact["stage"],
                to=contact["email"],  # Legacy field
                body=f"Dear {contact['name']},\n\nI'm reaching out to explore potential partnership opportunities between our organizations.\n\nBest regards,\nTest User"  # Legacy field
            )
            db.add(email_obj)
    
    # Add unique contacts to user2
    for contact in user2_unique_contacts:
        existing_email = db.query(GeneratedEmail).filter(
            GeneratedEmail.user_id == users[user2_email].id,
            GeneratedEmail.recipient_email == contact["email"]
        ).first()
        
        if not existing_email:
            email_obj = GeneratedEmail(
                user_id=users[user2_email].id,
                recipient_email=contact["email"],
                recipient_name=contact["name"],
                recipient_company=contact["company"],
                subject=f"Business Proposal - {contact['company']}",
                content=f"Dear {contact['name']},\n\nI would like to present a business proposal that I believe could be mutually beneficial for our companies.\n\nBest regards,\nTest User",
                status="draft",
                stage=contact["stage"],
                to=contact["email"],  # Legacy field
                body=f"Dear {contact['name']},\n\nI would like to present a business proposal that I believe could be mutually beneficial for our companies.\n\nBest regards,\nTest User"  # Legacy field
            )
            db.add(email_obj)
    
    db.commit()
    print("Test data added successfully!")
    
    # Verify data was added
    print("\nVerifying data...")
    for user_email, user in users.items():
        emails = db.query(GeneratedEmail).filter(GeneratedEmail.user_id == user.id).all()
        print(f"\nUser: {user_email}")
        print(f"Total emails: {len(emails)}")
        for email in emails:
            print(f"To: {email.recipient_email}, Stage: {email.stage}")

if __name__ == "__main__":
    add_test_data() 