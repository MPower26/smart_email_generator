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
from sqlalchemy import or_, and_, text

from app.db.database import get_db
from app.models.models import GeneratedEmail, User, EmailTemplate, EmailGenerationProgress
from app.api.auth import get_current_user
from app.services.email_generator import EmailGenerator
from app.services.email_service import send_verification_email, EMAIL_CONFIG
from app.services.gmail_service import send_gmail_email
from app.websocket_manager import manager

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
        # For other stages, use the original logic but filter out sent emails from outreach
        if stage == "outreach":
            # For outreach stage, only show emails that haven't been sent yet
            emails = db.query(GeneratedEmail).filter(
                GeneratedEmail.user_id == current_user.id,
                GeneratedEmail.stage == stage,
                GeneratedEmail.status.in_(["draft", "outreach_pending"])
            ).all()
        else:
            # For other stages (like lastchance), use the original logic
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
            
            # Generate a follow-up email automatically
            try:
                email_generator = EmailGenerator(db)
                followup_email = email_generator.generate_followup_email(email, current_user)
                logger.info(f"Generated follow-up email ID {followup_email.id} for original email ID {email_id}")
            except Exception as followup_error:
                logger.error(f"Failed to generate follow-up email: {str(followup_error)}")
                # Don't fail the main operation if follow-up generation fails
    
    # Handle lastchance_due status
    elif email.status == "lastchance_due":
        # Generate a last chance email automatically
        try:
            email_generator = EmailGenerator(db)
            lastchance_email = email_generator.generate_lastchance_email(email, current_user)
            logger.info(f"Generated last chance email ID {lastchance_email.id} for original email ID {email_id}")
        except Exception as lastchance_error:
            logger.error(f"Failed to generate last chance email: {str(lastchance_error)}")
            # Don't fail the main operation if last chance generation fails
            
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

@router.put("/{email_id}/content", response_model=Dict[str, Any])
async def update_email_content(
    email_id: int,
    data: Dict[str, str] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the content of an email"""
    logger.info(f"Update email content request for email ID {email_id} by user {current_user.email}")
    
    email = db.query(GeneratedEmail).filter(
        GeneratedEmail.id == email_id,
        GeneratedEmail.user_id == current_user.id
    ).first()
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Update content fields
    if "subject" in data:
        email.subject = data["subject"]
    if "content" in data:
        email.content = data["content"]
        email.body = data["content"]  # Update legacy field too
    
    db.commit()
    db.refresh(email)
    
    return {
        "id": email.id,
        "subject": email.subject,
        "content": email.content,
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

@router.get("/generation-progress", response_model=Dict[str, Any])
async def get_generation_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current email generation progress for the user"""
    try:
        logger.info(f"Getting generation progress for user {current_user.id}")
        
        # Check if the table exists first
        try:
            # Try a simple query to check if table exists
            table_check = db.execute(text("SELECT COUNT(*) FROM email_generation_progress WHERE 1=0")).scalar()
            logger.info("Table email_generation_progress exists")
        except Exception as table_check_error:
            logger.error(f"Table email_generation_progress does not exist: {str(table_check_error)}")
            return {
                "status": "idle",
                "total_contacts": 0,
                "processed_contacts": 0,
                "generated_emails": 0,
                "percentage": 0,
                "error": "Database table not available - please run the SQL migration"
            }
        
        try:
            progress = db.query(EmailGenerationProgress).filter(
                EmailGenerationProgress.user_id == current_user.id,
                EmailGenerationProgress.status == "processing"
            ).order_by(EmailGenerationProgress.created_at.desc()).first()
            
            logger.info(f"Query executed successfully for user {current_user.id}")
            
        except Exception as query_error:
            logger.error(f"Database error when querying progress: {str(query_error)}")
            # Return idle status if table doesn't exist or other DB error
            return {
                "status": "idle",
                "total_contacts": 0,
                "processed_contacts": 0,
                "generated_emails": 0,
                "percentage": 0,
                "error": f"Database query error: {str(query_error)}"
            }
        
        if not progress:
            logger.info(f"No active progress found for user {current_user.id}")
            return {
                "status": "idle",
                "total_contacts": 0,
                "processed_contacts": 0,
                "generated_emails": 0,
                "percentage": 0
            }
        
        percentage = (progress.processed_contacts / progress.total_contacts * 100) if progress.total_contacts > 0 else 0
        
        logger.info(f"Progress for user {current_user.id}: {progress.processed_contacts}/{progress.total_contacts} ({percentage:.1f}%)")
        
        return {
            "status": progress.status,
            "total_contacts": progress.total_contacts,
            "processed_contacts": progress.processed_contacts,
            "generated_emails": progress.generated_emails,
            "percentage": round(percentage, 1),
            "stage": progress.stage,
            "created_at": progress.created_at.isoformat(),
            "updated_at": progress.updated_at.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in get_generation_progress for user {current_user.id}: {str(e)}")
        # Return a safe default response instead of throwing an error
        return {
            "status": "error",
            "total_contacts": 0,
            "processed_contacts": 0,
            "generated_emails": 0,
            "percentage": 0,
            "error": str(e)
        }

@router.post("/generate", response_model=Dict[str, Any])
async def generate_emails(
    background_tasks: BackgroundTasks,
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
                EmailTemplate.user_id == current_user.id,
                EmailTemplate.category == stage  # Filter by stage/category
            ).first()
            if not template:
                raise HTTPException(status_code=404, detail=f"Template not found for stage '{stage}'")
        
        # Get friends_with_sharing
        friends_with_sharing = [f.id for f in current_user.friends if f.combine_contacts]
        dedupe_with_friends = len(friends_with_sharing) > 0

        # Create progress record in database
        progress_record = EmailGenerationProgress(
            user_id=current_user.id,
            total_contacts=len(contacts),
            processed_contacts=0,
            generated_emails=0,
            status="processing",
            stage=stage
        )
        db.add(progress_record)
        db.commit()
        db.refresh(progress_record)
        
        logger.info(f"Started email generation for user {current_user.id}: {len(contacts)} contacts")
        
        # Start background task for email generation using FastAPI's system
        background_tasks.add_task(
            generate_emails_background,
            contacts, 
            current_user, 
            template, 
            stage, 
            avoid_duplicates, 
            dedupe_with_friends, 
            friends_with_sharing,
            progress_record.id
        )
        
        return {
            "message": "Email generation started",
            "total_contacts": len(contacts),
            "progress_id": progress_record.id,
            "status": "processing"
        }
        
    except Exception as e:
        logger.error(f"Error starting email generation: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

async def generate_emails_background(
    contacts: List[Dict[str, Any]],
    user: User,
    template: Optional[EmailTemplate],
    stage: str,
    avoid_duplicates: bool,
    dedupe_with_friends: bool,
    friends_with_sharing: List[int],
    progress_id: int
):
    """Background task to generate emails"""
    from app.db.database import SessionLocal
    
    db = SessionLocal()
    progress_record = None  # Initialize to None
    try:
        logger.info(f"Background task started for progress_id: {progress_id}")
        
        # Get progress record
        progress_record = db.query(EmailGenerationProgress).filter(
            EmailGenerationProgress.id == progress_id
        ).first()
        
        if not progress_record:
            logger.error(f"Progress record {progress_id} not found. Aborting task.")
            return
            
        logger.info(f"Progress record {progress_id} found. Starting email generation for user {user.id}.")
        email_generator = EmailGenerator(db)
        
        generated_emails = []
        already_emailed = set()
        
        # Build set of already emailed addresses for this user (and optionally friends)
        if avoid_duplicates:
            logger.info("Deduplication is enabled. Building set of already emailed addresses.")
            # Check GeneratedEmail table for all previous communications
            conditions = [GeneratedEmail.user_id == user.id]
            if dedupe_with_friends and friends_with_sharing:
                conditions.append(GeneratedEmail.user_id.in_(friends_with_sharing))
            
            query = db.query(GeneratedEmail.recipient_email).filter(or_(*conditions))
            emails = {r[0].lower() for r in query if r[0]}
            already_emailed.update(emails)
            logger.info(f"Found {len(already_emailed)} unique emails for deduplication from the generated_emails table.")

        total_contacts = len(contacts)
        processed_count = 0
        
        for contact in contacts:
            try:
                contact_email = contact.get("Email")
                if not contact_email or not contact.get("First Name"):
                    logger.warning(f"Skipping contact due to missing email or first name: {contact}")
                    continue

                if avoid_duplicates and contact_email.lower() in already_emailed:
                    logger.info(f"Skipping duplicate email: {contact_email}")
                    continue

                email_obj = email_generator.generate_personalized_email(
                    contact, user, template, stage, progress_id
                )
                generated_emails.append(email_obj)
                
                # Add to already_emailed to avoid duplicates within the same batch
                already_emailed.add(contact_email.lower())

            except Exception as e:
                logger.error(f"Error processing contact {contact.get('Email', 'N/A')}: {str(e)}", exc_info=True)
            
            finally:
                processed_count += 1
                # Update processed count, but not generated count (that's handled in the generator)
                if progress_record:
                    progress_record.processed_contacts = processed_count
                    progress_record.updated_at = datetime.utcnow()
                    db.commit()

        if progress_record:
            progress_record.status = "completed"
            db.commit()
        logger.info(f"Email generation completed for user {user.id}. Generated {len(generated_emails)} emails.")

    except Exception as e:
        logger.error(f"Critical error during email generation background task for user {user.id}: {str(e)}", exc_info=True)
        if progress_record:
            progress_record.status = "error"
            progress_record.error_message = str(e)
            db.commit()
    finally:
        db.close()
        logger.info(f"Background task finished for progress_id: {progress_id}")

@router.post("/generate-lastchance/{email_id}", response_model=Dict[str, Any])
async def generate_lastchance_email(
    email_id: int,
    template_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a last chance email for a specific email"""
    logger.info(f"Generate last chance email request for email ID {email_id} by user {current_user.email}")
    
    # Get the original email
    original_email = db.query(GeneratedEmail).filter(
        GeneratedEmail.id == email_id,
        GeneratedEmail.user_id == current_user.id
    ).first()
    
    if not original_email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Get template if provided
    template = None
    if template_id:
        template = db.query(EmailTemplate).filter(
            EmailTemplate.id == template_id,
            EmailTemplate.user_id == current_user.id,
            EmailTemplate.category == "lastchance"
        ).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found for lastchance stage")
    
    try:
        email_generator = EmailGenerator(db)
        lastchance_email = email_generator.generate_lastchance_email(original_email, current_user, template)
        
        return {
            "message": "Last chance email generated successfully",
            "email": {
                "id": lastchance_email.id,
                "to": lastchance_email.recipient_email,
                "subject": lastchance_email.subject,
                "content": lastchance_email.content,
                "stage": lastchance_email.stage
            }
        }
        
    except Exception as e:
        logger.error(f"Error generating last chance email: {str(e)}")
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
        
        # Generate a follow-up email automatically
        try:
            email_generator = EmailGenerator(db)
            followup_email = email_generator.generate_followup_email(generated_email, user)
            logger.info(f"Generated follow-up email ID {followup_email.id} for original email ID {email_id}")
        except Exception as followup_error:
            logger.error(f"Failed to generate follow-up email: {str(followup_error)}")
            # Don't fail the main operation if follow-up generation fails
        
        db.commit()
        return {"success": True, "message": "Email sent and moved to follow-up queue"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/send_all_via_gmail/{stage}")
async def send_all_via_gmail(
    stage: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send all emails in a specific stage via Gmail"""
    logger.info(f"Send all emails request for stage '{stage}' by user {current_user.email}")

    if stage not in ["outreach", "followup", "lastchance"]:
        raise HTTPException(status_code=400, detail="Invalid stage. Must be one of: outreach, followup, lastchance")

    # Define which statuses are considered 'sendable' for each stage
    sendable_statuses = ["draft", "outreach_pending"]
    if stage == "followup":
        sendable_statuses.append("followup_due")
    elif stage == "lastchance":
        sendable_statuses.append("lastchance_due")

    # Get all emails for the user in the specified stage that haven't been sent yet
    emails = db.query(GeneratedEmail).filter(
        GeneratedEmail.user_id == current_user.id,
        GeneratedEmail.stage == stage,
        GeneratedEmail.status.in_(sendable_statuses)
    ).all()
    
    if not emails:
        return {
            "success": True, 
            "message": f"No emails to send for {stage} stage",
            "sent_count": 0,
            "total_count": 0
        }
    
    if not current_user.gmail_access_token:
        raise HTTPException(status_code=400, detail="Gmail not connected. Please connect your Gmail account first.")
    
    sent_count = 0
    failed_count = 0
    errors = []
    emails_to_delete = []  # Track emails to delete after they are processed
    email_generator = EmailGenerator(db)

    # Send initial progress update
    await manager.send_progress(str(current_user.id), {
        "type": "sending_start",
        "total_emails": len(emails),
        "current": 0,
        "stage": stage
    })
    
    for i, email in enumerate(emails):
        try:
            # Send via Gmail
            send_gmail_email(current_user, email.recipient_email, email.subject, email.content)
            
            # --- STAGE-SPECIFIC LOGIC ---
            if stage == "outreach":
                email.status = "followup_due"
                email.sent_at = datetime.utcnow()
                
                # Set followup timestamps
                now = datetime.utcnow()
                followup_days = current_user.followup_interval_days or 3
                lastchance_days = current_user.lastchance_interval_days or 6
                email.followup_due_at = now + timedelta(days=followup_days)
                email.lastchance_due_at = now + timedelta(days=lastchance_days)
                
                # Generate a follow-up email automatically
                try:
                    email_generator.generate_followup_email(email, current_user)
                    logger.info(f"Generated follow-up email for original email ID {email.id}")
                except Exception as followup_error:
                    logger.error(f"Failed to generate follow-up email: {str(followup_error)}")
                
            elif stage == "followup":
                email.status = "lastchance_due"
                email.sent_at = datetime.utcnow()
                
                # Generate a last chance email automatically
                try:
                    email_generator.generate_lastchance_email(email, current_user)
                    logger.info(f"Generated last chance email for original email ID {email.id}")
                except Exception as lastchance_error:
                    logger.error(f"Failed to generate last chance email: {str(lastchance_error)}")

            elif stage == "lastchance":
                email.status = "completed"
                email.sent_at = datetime.utcnow()
                # This is the final email, no new email is generated.

            # Mark the processed email for deletion
            emails_to_delete.append(email)
            sent_count += 1
            
            # Send progress update
            await manager.send_progress(str(current_user.id), {
                "type": "sending_progress",
                "current": i + 1,
                "total": len(emails),
                "sent_count": sent_count,
                "failed_count": failed_count,
                "stage": stage
            })
            
        except Exception as e:
            logger.error(f"Failed to send email {email.id}: {str(e)}")
            failed_count += 1
            errors.append(f"Email to {email.recipient_email}: {str(e)}")
            
            # Send error progress update
            await manager.send_progress(str(current_user.id), {
                "type": "sending_error",
                "current": i + 1,
                "total": len(emails),
                "error": str(e),
                "recipient": email.recipient_email
            })
    
    # Commit status changes for sent emails
    db.commit()
    
    # Send completion progress update
    await manager.send_progress(str(current_user.id), {
        "type": "sending_complete",
        "total_sent": sent_count,
        "total_failed": failed_count,
        "total_emails": len(emails),
        "stage": stage
    })
    
    # Create sent records and delete the old emails
    if emails_to_delete:
        try:
            email_ids_to_delete = []
            for sent_email in emails_to_delete:
                # Create a record of the sent email for duplicate detection
                sent_record = SentEmailRecord(
                    user_id=current_user.id,
                    recipient_email=sent_email.recipient_email,
                    sent_at=sent_email.sent_at or datetime.utcnow(),
                    stage=sent_email.stage
                )
                db.add(sent_record)
                email_ids_to_delete.append(sent_email.id)
            
            db.commit() # Commit the new sent records
            
            # Delete the original emails
            db.query(GeneratedEmail).filter(
                GeneratedEmail.id.in_(email_ids_to_delete)
            ).delete(synchronize_session=False)
            
            db.commit()
            logger.info(f"Deleted {len(email_ids_to_delete)} emails from stage '{stage}' after sending and recording")
            
        except Exception as delete_error:
            logger.error(f"Error during post-send cleanup for stage '{stage}': {str(delete_error)}")
            # Don't fail the operation if deletion fails; the main task is done.
    
    return {
        "success": True,
        "message": f"Sent {sent_count} emails successfully",
        "sent_count": sent_count,
        "failed_count": failed_count,
        "total_count": len(emails),
        "errors": errors if errors else None
    } 
