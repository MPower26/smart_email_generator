from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User
from app.services.anti_spam_service import AntiSpamService
from app.schemas.anti_spam import AntiSpamDashboardResponse

router = APIRouter()

@router.get("/dashboard", response_model=AntiSpamDashboardResponse)
async def get_anti_spam_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = AntiSpamService(db)
    # You may need to implement get_dashboard_for_user in AntiSpamService
    if not hasattr(service, 'get_dashboard_for_user'):
        raise HTTPException(status_code=501, detail="Dashboard method not implemented in AntiSpamService.")
    dashboard = service.get_dashboard_for_user(current_user.id)
    if not dashboard:
        raise HTTPException(status_code=404, detail="No anti-spam data found")
    return dashboard 
