from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.models import User
from app.db.database import get_db
from app.api.auth import get_current_user

router = APIRouter()

@router.post("/settings/update_intervals")
async def update_intervals(
    followup_days: int, 
    lastchance_days: int, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Update user's followup interval settings"""
    try:
        # Validate input
        if followup_days < 1 or followup_days > 30:
            raise HTTPException(status_code=400, detail="Followup days must be between 1 and 30")
        if lastchance_days < 1 or lastchance_days > 30:
            raise HTTPException(status_code=400, detail="Last chance days must be between 1 and 30")
        if lastchance_days <= followup_days:
            raise HTTPException(status_code=400, detail="Last chance days must be greater than followup days")
        
        # Update user settings
        current_user.followup_interval_days = followup_days
        current_user.lastchance_interval_days = lastchance_days
        db.commit()
        
        return {
            "success": True, 
            "message": "Intervals updated successfully",
            "followup_days": followup_days,
            "lastchance_days": lastchance_days
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update intervals: {str(e)}")
