from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...db.database import get_db
from ...models.models import Waitlist
from ...schemas.waitlist import WaitlistCreate, WaitlistResponse

router = APIRouter()

@router.post("/", response_model=WaitlistResponse)
def create_waitlist_entry(waitlist_data: WaitlistCreate, db: Session = Depends(get_db)):
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
        return db_waitlist
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create waitlist entry") 