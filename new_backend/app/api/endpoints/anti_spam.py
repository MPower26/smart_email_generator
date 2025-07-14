from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import User
from app.services.anti_spam_service import AntiSpamService
from app.schemas.anti_spam import AntiSpamDashboardResponse
from pydantic import BaseModel, EmailStr
from email_validator import validate_email, EmailNotValidError
import dns.resolver
from typing import Optional

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

class DomainDNSValidationRequest(BaseModel):
    value: str  # email or domain

class DomainDNSValidationResponse(BaseModel):
    domain: str
    spf_found: bool
    spf_record: Optional[str] = None
    dkim_found: bool
    dkim_record: Optional[str] = None
    dmarc_found: bool
    dmarc_record: Optional[str] = None

@router.post("/validate-domain-dns", response_model=DomainDNSValidationResponse)
async def validate_domain_dns(request: DomainDNSValidationRequest = Body(...)):
    """Check SPF, DKIM, DMARC DNS records for a domain or email."""
    import re
    value = request.value.strip()
    # Extract domain from email if needed
    if '@' in value:
        domain = value.split('@')[-1].lower()
    else:
        domain = value.lower()
    spf_found = False
    spf_record = None
    dkim_found = False
    dkim_record = None
    dmarc_found = False
    dmarc_record = None
    try:
        # SPF: TXT record with v=spf1
        answers = dns.resolver.resolve(domain, 'TXT')
        for rdata in answers:
            txt = ''.join(rdata.strings if hasattr(rdata, 'strings') else rdata)
            if isinstance(txt, bytes):
                txt = txt.decode('utf-8')
            if 'v=spf1' in txt:
                spf_found = True
                spf_record = txt
                break
    except Exception:
        pass
    try:
        # DKIM: TXT record at default._domainkey.domain
        dkim_domain = f'default._domainkey.{domain}'
        answers = dns.resolver.resolve(dkim_domain, 'TXT')
        for rdata in answers:
            txt = ''.join(rdata.strings if hasattr(rdata, 'strings') else rdata)
            if isinstance(txt, bytes):
                txt = txt.decode('utf-8')
            if 'v=DKIM1' in txt:
                dkim_found = True
                dkim_record = txt
                break
    except Exception:
        pass
    try:
        # DMARC: TXT record at _dmarc.domain
        dmarc_domain = f'_dmarc.{domain}'
        answers = dns.resolver.resolve(dmarc_domain, 'TXT')
        for rdata in answers:
            txt = ''.join(rdata.strings if hasattr(rdata, 'strings') else rdata)
            if isinstance(txt, bytes):
                txt = txt.decode('utf-8')
            if 'v=DMARC1' in txt:
                dmarc_found = True
                dmarc_record = txt
                break
    except Exception:
        pass
    return DomainDNSValidationResponse(
        domain=domain,
        spf_found=spf_found,
        spf_record=spf_record,
        dkim_found=dkim_found,
        dkim_record=dkim_record,
        dmarc_found=dmarc_found,
        dmarc_record=dmarc_record
    ) 
