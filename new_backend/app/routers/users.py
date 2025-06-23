from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict
import os
import uuid
from datetime import datetime
from ..db.database import get_db
from ..models.models import User
from ..schemas.user import UserUpdate
from ..middleware.auth import get_current_user

router = APIRouter()

@router.get("/me")
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's profile data"""
    return {
        "email": current_user.email,
        "full_name": current_user.full_name,
        "position": current_user.position,
        "company_name": current_user.company_name,
        "company_description": current_user.company_description,
        "gmail_access_token": current_user.gmail_access_token,
        "gmail_refresh_token": current_user.gmail_refresh_token,
        "gmail_token_expiry": str(current_user.gmail_token_expiry) if current_user.gmail_token_expiry else None,
        "email_signature": current_user.email_signature,
        "signature_image_url": getattr(current_user, 'signature_image_url', None)
    }

@router.put("/settings")
async def update_user_settings(
    settings: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Update only the fields that are provided
        update_data = settings.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(current_user, field, value)
        
        db.commit()
        db.refresh(current_user)
        
        # Return the complete user profile
        return {
            "message": "Settings updated successfully",
            "user": {
                "email": current_user.email,
                "full_name": current_user.full_name,
                "position": current_user.position,
                "company_name": current_user.company_name,
                "company_description": current_user.company_description,
                "email_signature": current_user.email_signature,
                "signature_image_url": getattr(current_user, 'signature_image_url', None)
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/signature")
async def update_user_signature(
    signature_data: Dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the user's email signature"""
    try:
        # Update signature fields
        if 'email_signature' in signature_data:
            current_user.email_signature = signature_data['email_signature']
        
        if 'signature_image_url' in signature_data:
            current_user.signature_image_url = signature_data['signature_image_url']
        
        db.commit()
        db.refresh(current_user)
        
        return {
            "message": "Signature updated successfully",
            "signature": {
                "email_signature": current_user.email_signature,
                "signature_image_url": getattr(current_user, 'signature_image_url', None)
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/signature/upload")
async def upload_signature_image(
    signature_image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a signature image for the user"""
    try:
        # Validate file type
        if not signature_image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Validate file size (max 5MB)
        if signature_image.size > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Create uploads directory if it doesn't exist
        upload_dir = "uploads/signatures"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        file_extension = os.path.splitext(signature_image.filename)[1]
        filename = f"{current_user.email}_{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(upload_dir, filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await signature_image.read()
            buffer.write(content)
        
        # Generate URL (you might want to use a CDN or cloud storage in production)
        image_url = f"/uploads/signatures/{filename}"
        
        # Update user's signature image URL
        current_user.signature_image_url = image_url
        db.commit()
        
        return {
            "message": "Image uploaded successfully",
            "image_url": image_url
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}") 

