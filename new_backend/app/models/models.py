from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Table, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base

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
    status = Column(String(50))  # draft, sent, failed
    stage = Column(String(50), default="outreach")  # outreach, followup, lastchance
    follow_up_status = Column(String(50))  # none, scheduled, sent
    follow_up_date = Column(DateTime(timezone=True), nullable=True)
    final_follow_up_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    to = Column(String(255))  # Legacy field
    body = Column(Text)  # Legacy field

    # Relationships
    user = relationship("User", back_populates="generated_emails", foreign_keys=[user_id])
    template = relationship("EmailTemplate", back_populates="generated_emails") 