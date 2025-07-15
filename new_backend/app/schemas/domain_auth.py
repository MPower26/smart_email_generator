from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class CheckType(str, Enum):
    SPF = "SPF"
    DKIM = "DKIM"
    DMARC = "DMARC"

class AlertLevel(str, Enum):
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class AlertType(str, Enum):
    SPF_MISSING = "SPF_MISSING"
    SPF_INVALID = "SPF_INVALID"
    DKIM_MISSING = "DKIM_MISSING"
    DKIM_INVALID = "DKIM_INVALID"
    DMARC_MISSING = "DMARC_MISSING"
    DMARC_PERMISSIVE = "DMARC_PERMISSIVE"

class DomainAuthCheckData(BaseModel):
    check_type: CheckType
    record_found: bool
    is_valid: bool
    last_checked: datetime
    next_check: Optional[datetime] = None
    check_data: Optional[Dict[str, Any]] = None

class DomainAlertData(BaseModel):
    alert_type: AlertType
    level: AlertLevel
    message: str
    is_resolved: bool = False
    created_at: datetime
    resolved_at: Optional[datetime] = None

class DomainBase(BaseModel):
    domain_name: str = Field(..., description="Domain name (e.g., example.com)")
    is_primary: bool = False
    is_active: bool = True

    @validator('domain_name')
    def validate_domain_name(cls, v):
        if not v or '.' not in v:
            raise ValueError('Domain name must be valid (e.g., example.com)')
        return v.lower().strip()

class DomainCreate(DomainBase):
    pass

class DomainUpdate(BaseModel):
    domain_name: Optional[str] = None
    is_primary: Optional[bool] = None
    is_active: Optional[bool] = None
    dkim_selector: Optional[str] = None

    @validator('domain_name')
    def validate_domain_name(cls, v):
        if v is not None:
            if not v or '.' not in v:
                raise ValueError('Domain name must be valid (e.g., example.com)')
            return v.lower().strip()
        return v

class DomainResponse(DomainBase):
    id: int
    user_id: int
    dkim_selector: Optional[str] = None
    dkim_public_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    auth_checks: List[DomainAuthCheckData] = []
    alerts: List[DomainAlertData] = []

    class Config:
        from_attributes = True

class DomainAuthStatus(BaseModel):
    domain: str
    auth_checks: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    overall_status: str  # "valid", "warning", "error", "critical"

class DomainAuthCheckRequest(BaseModel):
    domain_name: str
    check_types: Optional[List[CheckType]] = None  # If None, check all types

class DomainAuthCheckResponse(BaseModel):
    domain: str
    checks: List[DomainAuthCheckData]
    alerts: List[DomainAlertData]
    summary: Dict[str, Any]

class DKIMKeyPair(BaseModel):
    selector: str
    private_key: str
    public_key: str
    dns_record: str

class DomainConfiguration(BaseModel):
    domain_name: str
    spf_record: Optional[str] = None
    dkim_record: Optional[str] = None
    dmarc_record: Optional[str] = None
    recommendations: List[str] = [] 