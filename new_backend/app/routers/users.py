from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict
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
        "company_description": current_user.company_description
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
                "company_description": current_user.company_description
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 