from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Table
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    templates = relationship("EmailTemplate", back_populates="owner")
    generated_emails = relationship("GeneratedEmail", back_populates="user")
    verification_codes = relationship("VerificationCode", back_populates="user")
    friends = relationship(
        "User",
        secondary=user_friendship,
        primaryjoin=(id == user_friendship.c.user_id),
        secondaryjoin=(id == user_friendship.c.friend_id),
        backref="friend_of"
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
    content = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    template_id = Column(Integer, ForeignKey("email_templates.id"))
    status = Column(String(50))  # draft, sent, failed
    follow_up_status = Column(String(50))  # none, scheduled, sent
    follow_up_date = Column(DateTime(timezone=True), nullable=True)
    final_follow_up_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="generated_emails")
    template = relationship("EmailTemplate", back_populates="generated_emails") 