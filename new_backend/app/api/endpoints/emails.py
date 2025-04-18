from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from datetime import datetime
import logging
import json
from fastapi import status

from app.db.database import get_db
from app.models.models import GeneratedEmail, User, EmailTemplate
from app.api.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/by-stage/{stage}", response_model=List[Dict[str, Any]])
async def get_emails_by_stage(
    stage: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get emails for the current user filtered by stage"""
    logger.info(f"Getting emails for user {current_user.email} (ID: {current_user.id}) in stage {stage}")
    logger.info(f"Current user details - ID: {current_user.id}, Email: {current_user.email}")
    emails = db.query(GeneratedEmail).filter(
        GeneratedEmail.user_id == current_user.id,
        GeneratedEmail.stage == stage
    ).all()
    logger.info(f"Raw query found {len(emails)} emails")
    for email in emails:
        logger.info(f"Email ID: {email.id}, User ID: {email.user_id}, Stage: {email.stage}")
    result = []
    for email in emails:
        email_dict = {
            "id": email.id,
            "to": email.recipient_email,
            "subject": email.subject,
            "body": email.content,
            "status": email.status,
            "stage": email.stage
        }
        result.append(email_dict)
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
    if new_status not in ['draft', 'sent']: # Allow only draft or sent
         raise HTTPException(status_code=400, detail="Invalid status value. Must be 'draft' or 'sent'.")
         
    email.status = new_status
    
    # Set sent_at timestamp only when marking as sent
    if email.status == "sent" and not email.sent_at:
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
    file: Optional[UploadFile] = File(None),
    use_ai: bool = Form(False),
    stage: str = Form("outreach"),
    template_id: Optional[int] = Form(None),
    your_name: Optional[str] = Form(None),
    your_position: Optional[str] = Form(None),
    company_name: Optional[str] = Form(None),
    your_contact: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate emails based on CSV or AI"""
    # This endpoint remains complex, ensure its implementation is correct
    logger.info(f"Generate request for user {current_user.email} with stage {stage}")
    # TODO: Replace placeholder response with actual generation logic
    # For now, just acknowledging the request
    # Ensure the actual generation logic fetches data, processes, saves to DB correctly
    return {"message": "Email generation request received", "details": {"stage": stage, "use_ai": use_ai}}

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