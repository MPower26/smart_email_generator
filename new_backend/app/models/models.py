from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Table, Text, Date, DateTime, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base
from datetime import datetime

# Association table for user friendships
user_friendship = Table(
    'user_friendship',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('friend_id', Integer, ForeignKey('users.id'), primary_key=True)
)

# Friend requests table
class FriendRequest(Base):
    __tablename__ = "friend_requests"

    id = Column(Integer, primary_key=True)
    from_user_id = Column(Integer, ForeignKey("users.id"))
    to_user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String(20), default='pending')  # pending, accepted, rejected
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    is_verified = Column(Boolean, default=False)
    failed_verification_attempts = Column(Integer, default=0)
    last_verification_attempt = Column(DateTime(timezone=True), nullable=True)
    company_name = Column(String(255))
    company_description = Column(Text)
    position = Column(String(255))
    full_name = Column(String(255))
    contact_info = Column(String(255))
    is_active = Column(Boolean, default=True)
    combine_contacts = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    templates = relationship("EmailTemplate", back_populates="owner")
    generated_emails = relationship("GeneratedEmail", back_populates="user", foreign_keys="GeneratedEmail.user_id")
    verification_codes = relationship("VerificationCode", back_populates="user")
    #gmail connection
    gmail_access_token = Column(String, nullable=True)
    gmail_refresh_token = Column(String, nullable=True)
    gmail_token_expiry = Column(DateTime, nullable=True)
    # Notifications
    followup_interval_days = Column(Integer, default=3)
    lastchance_interval_days = Column(Integer, default=6)
    
    # Email signature (HTML format for banners)
    email_signature = Column(Text, nullable=True)
    signature_image_url = Column(String(500), nullable=True)  # URL to uploaded signature image
    
    # Friend relationships
    friends = relationship(
        "User",
        secondary=user_friendship,
        primaryjoin=(id == user_friendship.c.user_id),
        secondaryjoin=(id == user_friendship.c.friend_id),
        backref="friend_of"
    )
    
    # Friend request relationships
    sent_requests = relationship(
        "FriendRequest",
        foreign_keys=[FriendRequest.from_user_id],
        backref="sender"
    )
    received_requests = relationship(
        "FriendRequest",
        foreign_keys=[FriendRequest.to_user_id],
        backref="receiver"
    )

    # New relationships
    generation_progress = relationship("EmailGenerationProgress", back_populates="user")

    # New relationship for attachments
    attachments = relationship("Attachment", back_populates="user", cascade="all, delete-orphan")

    sent_histories = relationship("SentHistory", back_populates="user")

class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    code = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)

    # Relationship with user
    user = relationship("User", back_populates="verification_codes")

class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    content = Column(String)
    is_default = Column(Boolean, default=False)
    category = Column(String(20), default="outreach")  # outreach, followup, lastchance
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="templates")
    generated_emails = relationship("GeneratedEmail", back_populates="template")

class GeneratedEmail(Base):
    __tablename__ = "generated_emails"

    id = Column(Integer, primary_key=True, index=True)
    recipient_email = Column(String(255), index=True)
    recipient_name = Column(String(255))
    recipient_company = Column(String(255))
    subject = Column(String(255))
    content = Column(Text)
    user_id = Column(Integer, ForeignKey("users.id"))
    template_id = Column(Integer, ForeignKey("email_templates.id"), nullable=True)
    stage = Column(String(50), default="outreach")  # outreach, followup, lastchance
    follow_up_status = Column(String(50), nullable=True)  # none, scheduled, sent
    follow_up_date = Column(DateTime(timezone=True), nullable=True)
    final_follow_up_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    to = Column(String(255), nullable=True)  # Legacy field
    body = Column(Text, nullable=True)  # Legacy field
    group_id = Column(String(255), nullable=True, index=True)  # For grouping emails by campaign/batch

    # Relationships
    user = relationship("User", back_populates="generated_emails", foreign_keys=[user_id])
    template = relationship("EmailTemplate",  back_populates="generated_emails") 
    
    # EMail flow
    followup_due_at = Column(DateTime, nullable=True)
    lastchance_due_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="outreach_pending")  # outreach_sent, followup_due, lastchance_due, sent, etc.
    thread_id = Column(String(255), nullable=True) # For Gmail threading

class EmailGenerationProgress(Base):
    __tablename__ = "email_generation_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_contacts = Column(Integer, nullable=False)
    processed_contacts = Column(Integer, default=0)
    generated_emails = Column(Integer, default=0)
    status = Column(String, default="processing")  # processing, completed, error
    stage = Column(String, nullable=False)  # outreach, followup, lastchance
    error_message = Column(Text, nullable=True)  # To store error details
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    group_id = Column(String(255), nullable=True, index=True)  # For grouping emails by campaign/batch
    paused = Column(Boolean, default=False)  # <-- Added for pause/resume support
    
    # Relationship
    user = relationship("User", back_populates="generation_progress")
    
    def __repr__(self):
        return f"<EmailGenerationProgress(id={self.id}, user_id={self.user_id}, status={self.status})>"

# ---
# Alembic migration required: New table 'attachments' with fields (id, user_id, filename, blob_url, placeholder, file_type, category, created_at)
# ---

class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    blob_url = Column(String(500), nullable=False)
    placeholder = Column(String(100), nullable=False)  # User-defined placeholder
    file_type = Column(String(50), nullable=False)  # e.g., 'image', 'video'
    category = Column(String(50), nullable=True)  # Optional: for grouping
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    gif_url = Column(String(500), nullable=True)  # URL to uploaded GIF preview
    custom_thumbnail_url = Column(String(500), nullable=True)  # URL to custom thumbnail uploaded by user
    user = relationship("User", back_populates="attachments")

    def __repr__(self):
        return f"<Attachment(id={self.id}, user_id={self.user_id}, placeholder={self.placeholder}, file_type={self.file_type}, gif_url={self.gif_url}, custom_thumbnail_url={self.custom_thumbnail_url})>"

class SentHistory(Base):
    __tablename__ = "sent_history"
    __table_args__ = {'schema': 'dbo'}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    prospect_email = Column(String(255), nullable=False)
    prospect_name = Column(String(255), nullable=True)
    completed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sent_histories")

# --- Warm-up & Anti-spam: External SQL tables ---

class EmailDailyLimits(Base):
    __tablename__ = "email_daily_limits"
    __table_args__ = {'schema': 'dbo'}
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    send_date = Column(Date, nullable=False)
    emails_sent = Column(Integer, nullable=True)
    unique_recipients = Column(Integer, nullable=True)
    last_updated = Column(DateTime, nullable=True)

class EmailLimitRules(Base):
    __tablename__ = "email_limit_rules"
    __table_args__ = {'schema': 'dbo'}
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_name = Column(String, nullable=False)
    rule_type = Column(String, nullable=False)
    default_value = Column(Integer, nullable=False)
    warmup_value = Column(Integer, nullable=False)
    max_value = Column(Integer, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=True)

class EmailSendingLimits(Base):
    __tablename__ = "email_sending_limits"
    __table_args__ = {'schema': 'dbo'}
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    daily_limit = Column(Integer, nullable=True)
    hourly_limit = Column(Integer, nullable=True)
    current_tier = Column(String, nullable=True)
    warm_up_started_at = Column(DateTime, nullable=True)
    last_limit_increase = Column(DateTime, nullable=True)
    is_suspended = Column(Integer, nullable=True)  # tinyint (0/1)
    suspension_reason = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

class EmailSendingStats(Base):
    __tablename__ = "email_sending_stats"
    __table_args__ = {'schema': 'dbo'}
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    date = Column(Date, nullable=False)
    emails_sent = Column(Integer, nullable=True)
    emails_bounced = Column(Integer, nullable=True)
    emails_complained = Column(Integer, nullable=True)
    reputation_score = Column(Numeric, nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

class Waitlist(Base):
    __tablename__ = "waitlist"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    subscribe_to_updates = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Waitlist(id={self.id}, email={self.email}, company={self.company})>"
