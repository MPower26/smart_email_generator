from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from datetime import datetime
import logging
import json
import csv
import io
from fastapi import status

from app.db.database import get_db
from app.models.models import GeneratedEmail, User, EmailTemplate
from app.api.auth import get_current_user
from app.services.email_generator import EmailGenerator

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
    logger.info(f"Getting emails for user {current_user.email} (ID: {current_user.id}) in stage {stage}")
    logger.info(f"Current user details - ID: {current_user.id}, Email: {current_user.email}")
    
    # Get user's own emails
    emails = db.query(GeneratedEmail).filter(
        GeneratedEmail.user_id == current_user.id,
        GeneratedEmail.stage == stage
    ).all()
    
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
            "shared_by": shared_by
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
    """Update the status of an email (e.g., 'sent', 'draft')"""
    email = db.query(GeneratedEmail).filter(
        GeneratedEmail.id == email_id,
        GeneratedEmail.user_id == current_user.id
    ).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    new_status = data.get("status")
    if new_status not in ['draft', 'sent', 'sent by friend']: # Allow draft, sent, or sent by friend
         raise HTTPException(status_code=400, detail="Invalid status value. Must be 'draft', 'sent', or 'sent by friend'.")
         
    email.status = new_status
    
    # Set sent_at timestamp only when marking as sent or sent by friend
    if email.status in ["sent", "sent by friend"] and not email.sent_at:
        email.sent_at = datetime.utcnow()
    elif email.status == "draft": # Clear sent_at if reverting to draft
        email.sent_at = None
        
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
    stage: str = Form("outreach"),  # Add stage parameter with default value
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
        
        # Initialize email generator
        email_generator = EmailGenerator(db)
        
        # Generate emails for each contact
        generated_emails = []
        for contact in contacts:
            # Skip contacts without email
            if not contact.get('Email'):
                continue
                
            # Format contact data for email generation
            contact_data = {
                "First Name": contact.get('First Name', ''),
                "Last Name": contact.get('Last Name', ''),
                "Email": contact.get('Email', ''),
                "Title": contact.get('Title', ''),
                "Company": contact.get('Company', ''),
                "Industry": contact.get('Industry', ''),
                "Keywords": contact.get('Keywords', ''),
                "SEO Description": contact.get('SEO Description', ''),
                "Website": contact.get('Website', ''),
                "Company LinkedIn": contact.get('Company Linkedin Url', ''),
                "Person LinkedIn": contact.get('Person Linkedin Url', ''),
                "Location": f"{contact.get('City', '')}, {contact.get('State', '')}, {contact.get('Country', '')}",
                "Company Size": contact.get('# Employees', ''),
                "Revenue": contact.get('Annual Revenue', ''),
                "Funding": contact.get('Total Funding', '')
            }
            
            try:
                email = email_generator.generate_personalized_email(
                    contact_data,
                    current_user,
                    template,
                    stage  # Pass the stage parameter
                )
                generated_emails.append(email)
            except Exception as e:
                logger.error(f"Error generating email for {contact.get('Email', '')}: {str(e)}")
                continue
        
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