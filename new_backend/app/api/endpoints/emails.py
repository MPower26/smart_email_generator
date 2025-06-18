from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import logging
import json
import csv
import io
import os
from fastapi import status
from sqlalchemy import or_, and_

from app.db.database import get_db
from app.models.models import GeneratedEmail, User, EmailTemplate
from app.api.auth import get_current_user
from app.services.email_generator import EmailGenerator
from app.services.email_service import send_verification_email
from app.config.settings import EMAIL_CONFIG
from app.services.gmail_service import send_gmail_email

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/cache")
async def get_cache_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get information about the email cache"""
    # For now, just return a simple response since we don't have actual caching
    return {
        "status": "active",
        "size": 0,
        "last_cleared": None
    }

@router.delete("/cache")
async def clear_cache(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear the email cache"""
    # For now, just return success since we don't have actual caching
    return {
        "message": "Cache cleared successfully"
    }

@router.get("/by-stage/{stage}", response_model=List[Dict[str, Any]])
async def get_emails_by_stage(
    stage: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get emails for the current user filtered by stage"""
    logger.info(f"[EMAILS] Getting emails for user {current_user.email} (ID: {current_user.id}) in stage '{stage}'")
    logger.info(f"Current user details - ID: {current_user.id}, Email: {current_user.email}")
    
    # Get user's own emails with special logic for followup stage
    if stage == "followup":
        # For followup stage, include emails that are either:
        # 1. status = 'followup_due' 
        # 2. status = 'outreach_sent' AND have followup_due_at set
        emails = db.query(GeneratedEmail).filter(
            GeneratedEmail.user_id == current_user.id,
            or_(
                GeneratedEmail.status == "followup_due",
                and_(
                    GeneratedEmail.status == "outreach_sent",
                    GeneratedEmail.followup_due_at.isnot(None)
                )
            )
        ).all()
    else:
        # For other stages, use the original logic
        emails = db.query(GeneratedEmail).filter(
            GeneratedEmail.user_id == current_user.id,
            GeneratedEmail.stage == stage
        ).all()
    
    logger.info(f"[EMAILS] Found {len(emails)} emails for user {current_user.email} (ID: {current_user.id}) in stage '{stage}'")
    
    # Get friends who have sharing enabled
    friends_with_sharing = []
    for friend in current_user.friends:
        if friend.combine_contacts:
            friends_with_sharing.append(friend.id)
    
    # Get shared emails from friends
    shared_emails = []
    if friends_with_sharing:
        shared_emails = db.query(GeneratedEmail).filter(
            GeneratedEmail.user_id.in_(friends_with_sharing),
            GeneratedEmail.stage == stage,
            GeneratedEmail.status == 'sent'
        ).all()
    
    result = []
    for email in emails:
        # Check if any friend has sent an email to the same recipient in the same stage
        shared_by = None
        for shared_email in shared_emails:
            if (shared_email.recipient_email == email.recipient_email and 
                shared_email.stage == email.stage):
                shared_by = db.query(User).get(shared_email.user_id).email
                # Only mark as sent by friend if not already sent
                if email.status != 'sent':
                    email.status = 'sent by friend'
                    email.sent_at = shared_email.sent_at
                break
        
        email_dict = {
            "id": email.id,
            "to": email.recipient_email,
            "subject": email.subject,
            "body": email.content,
            "status": email.status,
            "stage": email.stage,
            "shared_by": shared_by,
            "followup_due_at": email.followup_due_at.isoformat() if email.followup_due_at else None,
            "lastchance_due_at": email.lastchance_due_at.isoformat() if email.lastchance_due_at else None
        }
        result.append(email_dict)
    
    # Commit any changes to the database
    db.commit()
    
    response_json = json.dumps(result)
    logger.info(f"Response JSON for stage {stage}: {response_json}")
    return result

@router.put("/{email_id}/status", response_model=Dict[str, Any])
async def update_email_status(
    email_id: int,
    data: Dict[str, str] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the status of an email (e.g., 'draft', 'outreach_sent', 'followup_due', 'lastchance_due')"""
    email = db.query(GeneratedEmail).filter(
        GeneratedEmail.id == email_id,
        GeneratedEmail.user_id == current_user.id
    ).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    new_status = data.get("status")
    valid_statuses = ['draft', 'outreach_sent', 'followup_due', 'lastchance_due', 'sent by friend', 'completed']
    if new_status not in valid_statuses:
         raise HTTPException(status_code=400, detail=f"Invalid status value. Must be one of: {', '.join(valid_statuses)}")
         
    email.status = new_status
    
    # Set sent_at timestamp when marking as sent
    if email.status in ["outreach_sent", "sent by friend"] and not email.sent_at:
        email.sent_at = datetime.utcnow()
        
        # Set followup timestamps based on user's interval settings
        if email.status == "outreach_sent":
            now = datetime.utcnow()
            followup_days = current_user.followup_interval_days or 3
            lastchance_days = current_user.lastchance_interval_days or 6
            
            email.followup_due_at = now + timedelta(days=followup_days)
            email.lastchance_due_at = now + timedelta(days=lastchance_days)
            
            # Automatically move to followup_due status
            email.status = "followup_due"
            
    elif email.status == "draft": # Clear sent_at if reverting to draft
        email.sent_at = None
        email.followup_due_at = None
        email.lastchance_due_at = None
        
    db.commit()
    db.refresh(email)
    return {
        "id": email.id,
        "to": email.recipient_email,
        "subject": email.subject,
        "status": email.status,
        "stage": email.stage
    }

@router.get("/templates", response_model=List[Dict[str, Any]])
async def get_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all templates for the current user"""
    templates = db.query(EmailTemplate).filter(EmailTemplate.user_id == current_user.id).all()
    result = []
    for template in templates:
        result.append({
            "id": template.id,
            "name": template.name,
            "content": template.content,
            "is_default": template.is_default
        })
    return result

@router.post("/generate", response_model=Dict[str, Any])
async def generate_emails(
    file: UploadFile = File(...),
    template_id: Optional[str] = Form(None),
    stage: str = Form("outreach"),
    avoid_duplicates: Optional[bool] = Form(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate emails based on Apollo contacts export"""
    logger.info(f"Generate request for user {current_user.email}")
    
    try:
        # Read and parse the CSV file
        contents = await file.read()
        csv_file = io.StringIO(contents.decode('utf-8'))
        reader = csv.DictReader(csv_file)
        contacts = list(reader)
        
        # Get template if provided
        template = None
        if template_id:
            template = db.query(EmailTemplate).filter(
                EmailTemplate.id == template_id,
                EmailTemplate.user_id == current_user.id
            ).first()
            if not template:
                raise HTTPException(status_code=404, detail="Template not found")
        
        # Get friends_with_sharing
        friends_with_sharing = [f.id for f in current_user.friends if f.combine_contacts]
        dedupe_with_friends = len(friends_with_sharing) > 0

        email_generator = EmailGenerator(db)
        generated_emails = email_generator.process_csv_data(
            contacts,
            current_user,
            template,
            stage,
            avoid_duplicates=avoid_duplicates,
            dedupe_with_friends=dedupe_with_friends,
            friends_ids=friends_with_sharing
        )
        
        # Format the emails for response
        formatted_emails = []
        for email in generated_emails:
            content_lines = email.content.split('\n')
            subject = content_lines[0].strip()
            content = '\n'.join(content_lines[1:]).strip()
            
            formatted_emails.append({
                "to": email.recipient_email,
                "content": content,
                "subject": subject
            })
        
        return {
            "message": "Emails generated successfully",
            "emails": formatted_emails,
            "count": len(generated_emails)
        }
        
    except Exception as e:
        logger.error(f"Error generating emails: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{email_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email_endpoint(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific email owned by the current user."""
    logger.info(f"Received request to delete email ID: {email_id} for user {current_user.email}")
    
    # --- Add detailed log before querying --- 
    logger.info(f"Querying for Email ID: {email_id} belonging to User ID: {current_user.id}")
    # --------------------------------------
    
    # Fetch the email from the database to ensure ownership
    email = db.query(GeneratedEmail).filter(
        GeneratedEmail.id == email_id,
        GeneratedEmail.user_id == current_user.id
    ).first()
    
    if not email:
        logger.error(f"Query failed: Email ID {email_id} not found for User ID {current_user.id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    # Delete the email object
    db.delete(email)
    db.commit()
    logger.info(f"Successfully deleted email ID: {email_id}")
    
    # Return No Content response
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/verify", status_code=status.HTTP_200_OK)
async def send_verification_code(
    email: str = Body(..., embed=True),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """Send a verification code to the specified email address"""
    try:
        logger.info(f"Sending verification code to email: {email}")
        # Generate a verification code (you might want to implement your own logic)
        verification_code = "123456"  # Replace with actual code generation
        
        logger.info("Email config: " + json.dumps({
            "sender_email": EMAIL_CONFIG['sender_email'],
            "from_name": EMAIL_CONFIG['from_name'],
            "api_key_present": bool(EMAIL_CONFIG['api_key']),
            "template_id": EMAIL_CONFIG['template_id']
        }))
        
        # Send the verification email in the background if background_tasks is provided
        if background_tasks:
            logger.info("Adding send_verification_email to background tasks")
            background_tasks.add_task(send_verification_email, email, verification_code)
        else:
            logger.info("Sending verification email synchronously")
            await send_verification_email(email, verification_code)
            
        return {"message": "Verification email sent successfully"}
    except Exception as e:
        logger.error(f"Failed to send verification email: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send verification email: {str(e)}"
        )

@router.post("/test-email", status_code=status.HTTP_200_OK)
async def test_email_service(
    data: Dict[str, str] = Body(...),
    db: Session = Depends(get_db)
):
    """Test endpoint for email service debugging"""
    try:
        recipient = data.get("email", "mdp73@bath.ac.uk")
        code = data.get("code", "123456")
        
        # Log environment and configuration
        logger.info("========== EMAIL SERVICE DEBUG ==========")
        logger.info(f"Testing email service sending to: {recipient}")
        logger.info(f"Environment: AZURE_WEBSITE_NAME={os.getenv('AZURE_WEBSITE_NAME', 'Not set')}")
        
        # Log email configuration
        logger.info(f"Email config from settings:")
        logger.info(f"  SENDER_EMAIL: {EMAIL_CONFIG['sender_email']}")
        logger.info(f"  FROM_NAME: {EMAIL_CONFIG['from_name']}")
        logger.info(f"  API_KEY present: {'Yes' if EMAIL_CONFIG['api_key'] else 'No'}")
        logger.info(f"  TEMPLATE_ID: {EMAIL_CONFIG['template_id']}")
        
        # Log raw environment variables for debugging
        logger.info(f"Raw environment variables:")
        logger.info(f"  SENDER_EMAIL: {os.getenv('SENDER_EMAIL')}")
        logger.info(f"  SENDGRID_FROM_NAME: {os.getenv('SENDGRID_FROM_NAME')}")
        logger.info(f"  SENDGRID_API_KEY length: {len(os.getenv('SENDGRID_API_KEY', '')) if os.getenv('SENDGRID_API_KEY') else 'Not set'}")
        
        # Log DB connection status
        try:
            user_count = db.query(User).count()
            logger.info(f"Database connection: OK (User count: {user_count})")
        except Exception as db_error:
            logger.error(f"Database connection error: {str(db_error)}")
        
        # Try to send the email with detailed logging
        logger.info("Attempting to send test verification email...")
        await send_verification_email(recipient, code)
        logger.info("Email sent successfully!")
        
        return {
            "status": "success",
            "message": "Test email sent successfully",
            "config": {
                "sender_email": EMAIL_CONFIG['sender_email'],
                "from_name": EMAIL_CONFIG['from_name'],
                "api_key_present": bool(EMAIL_CONFIG['api_key']),
                "environment": "Production" if os.getenv('AZURE_WEBSITE_NAME') else "Development"
            }
        }
    except Exception as e:
        logger.error(f"Test email failed: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__,
            "config": {
                "sender_email": EMAIL_CONFIG['sender_email'] or "Not set",
                "from_name": EMAIL_CONFIG['from_name'] or "Not set",
                "api_key_present": bool(EMAIL_CONFIG['api_key']),
                "environment": "Production" if os.getenv('AZURE_WEBSITE_NAME') else "Development"
            }
        }

@router.post("/send_via_gmail")
def send_via_gmail(email_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    generated_email = db.query(GeneratedEmail).filter_by(id=email_id, user_id=user.id).first()
    if not generated_email:
        raise HTTPException(status_code=404, detail="Email not found")
    try:
        send_gmail_email(user, generated_email.recipient_email, generated_email.subject, generated_email.content)
        
        # Update status and set followup timestamps - DIRECTLY to followup_due
        generated_email.status = "followup_due"  # Changed from "outreach_sent" to "followup_due"
        generated_email.sent_at = datetime.utcnow()
        
        # Set followup timestamps based on user's interval settings
        now = datetime.utcnow()
        followup_days = user.followup_interval_days or 3
        lastchance_days = user.lastchance_interval_days or 6
        
        # Set followup_due_at to now + 3 days (countdown starts immediately)
        generated_email.followup_due_at = now + timedelta(days=followup_days)
        generated_email.lastchance_due_at = now + timedelta(days=lastchance_days)
        
        db.commit()
        return {"success": True, "message": "Email sent and moved to follow-up queue"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) 
