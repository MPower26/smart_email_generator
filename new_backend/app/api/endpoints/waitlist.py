from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from ...db.database import get_db
from ...models.models import Waitlist
from ...schemas.waitlist import WaitlistCreate, WaitlistResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="",  # The prefix will be added in main.py
    tags=["Waitlist"]
)

@router.get("/")
async def get_waitlist_info():
    """Get waitlist information"""
    logger.info("GET /waitlist endpoint called")
    return {"message": "Waitlist endpoint is working"}

@router.options("/")
async def waitlist_options():
    """Handle OPTIONS request for CORS preflight"""
    logger.info("OPTIONS /waitlist endpoint called")
    return {}

@router.post("/", response_model=WaitlistResponse)
async def create_waitlist_entry(waitlist_data: WaitlistCreate, db: Session = Depends(get_db)):
    """Create a new waitlist entry"""
    logger.info(f"POST /waitlist endpoint called with data: {waitlist_data}")
    
    # Check if email already exists
    existing_entry = db.query(Waitlist).filter(Waitlist.email == waitlist_data.email).first()
    if existing_entry:
        raise HTTPException(status_code=400, detail="Email already registered in waitlist")
    
    # Create new waitlist entry
    db_waitlist = Waitlist(
        first_name=waitlist_data.first_name,
        last_name=waitlist_data.last_name,
        company=waitlist_data.company,
        email=waitlist_data.email,
        subscribe_to_updates=waitlist_data.subscribe_to_updates
    )
    
    try:
        db.add(db_waitlist)
        db.commit()
        db.refresh(db_waitlist)
        logger.info(f"Successfully created waitlist entry for {waitlist_data.email}")
        return db_waitlist
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create waitlist entry: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create waitlist entry") 