from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date

class EmailLimitsResponse(BaseModel):
    emails_sent_today: int
    unique_recipients_today: int
    daily_limit: int
    recipient_limit: int
    reputation_score: float
    warmup_status: str
    remaining_emails: int
    remaining_recipients: int
    warnings: List[str]

class SenderReputationResponse(BaseModel):
    reputation_score: float
    total_emails_sent: int
    bounced_emails: int
    spam_reports: int
    successful_deliveries: int
    warmup_status: str
    last_calculated: datetime

class EmailSendLogResponse(BaseModel):
    id: int
    recipient_email: str
    subject: Optional[str]
    sent_at: datetime
    status: str
    message_id: Optional[str]
    bounce_reason: Optional[str]
    spam_score: Optional[float]

class AntiSpamDashboardResponse(BaseModel):
    user_limits: EmailLimitsResponse
    reputation: SenderReputationResponse
    recent_logs: List[EmailSendLogResponse]
    warnings: List[str]

class EmailLimitCheckRequest(BaseModel):
    recipient_count: int

class EmailLimitCheckResponse(BaseModel):
    can_send: bool
    message: str
    limits: EmailLimitsResponse