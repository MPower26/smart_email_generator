from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from ...db.database import get_db
from ...models.models import User, VerificationCode, Waitlist
from ...schemas.auth import Token, VerificationRequest
from datetime import datetime, timedelta
from typing import Dict, Any
from pydantic import BaseModel, EmailStr

router = APIRouter()

class WaitlistEntry(BaseModel):
    first_name: str
    last_name: str
    company: str
    email: EmailStr
    subscribe_to_updates: bool = False

@router.post("/waitlist", status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    entry: WaitlistEntry,
    db: Session = Depends(get_db)
):
    """Add a new entry to the waitlist"""
    try:
        # Check if email already exists in waitlist
        existing_entry = db.query(Waitlist).filter(Waitlist.email == entry.email).first()
        if existing_entry:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already on our waitlist"
            )

        # Create new waitlist entry
        new_entry = Waitlist(
            first_name=entry.first_name,
            last_name=entry.last_name,
            company=entry.company,
            email=entry.email,
            subscribe_to_updates=entry.subscribe_to_updates
        )
        
        db.add(new_entry)
        db.commit()
        
        return {"message": "Successfully added to waitlist"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) 