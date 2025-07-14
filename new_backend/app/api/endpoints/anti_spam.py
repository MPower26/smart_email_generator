from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User
from app.services.anti_spam_service import AntiSpamService
from app.schemas.anti_spam import AntiSpamDashboardResponse
from pydantic import BaseModel, EmailStr
from email_validator import validate_email, EmailNotValidError

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

class EmailValidationRequest(BaseModel):
    email: EmailStr

class EmailValidationResponse(BaseModel):
    valid: bool
    reason: str = None
    normalized: str = None
    mx_found: bool = None
    account_type: str = None  # 'gmail', 'workspace', 'other'
    daily_limit: int = None

@router.post("/validate-email", response_model=EmailValidationResponse)
async def validate_email_endpoint(request: EmailValidationRequest = Body(...)):
    """Validate email syntax and MX records, and return account type and daily limit."""
    try:
        result = validate_email(request.email, check_deliverability=True)
        normalized = result.email
        domain = normalized.split('@')[-1].lower()
        if domain in ["gmail.com", "googlemail.com"]:
            account_type = "gmail"
            daily_limit = 500
        else:
            account_type = "workspace"
            daily_limit = 2000
        return EmailValidationResponse(
            valid=True,
            reason="Valid email address.",
            normalized=normalized,
            mx_found=bool(result.mx),
            account_type=account_type,
            daily_limit=daily_limit
        )
    except EmailNotValidError as e:
        return EmailValidationResponse(
            valid=False,
            reason=str(e),
            normalized=None,
            mx_found=False,
            account_type=None,
            daily_limit=None
        ) 
