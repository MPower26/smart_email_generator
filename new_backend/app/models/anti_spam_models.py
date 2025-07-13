from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Table, Text, DECIMAL, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base
from datetime import datetime

class EmailDailyLimit(Base):
    __tablename__ = "email_daily_limits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    send_date = Column(Date, nullable=False)
    emails_sent = Column(Integer, default=0)
    unique_recipients = Column(Integer, default=0)
    last_updated = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="email_daily_limits")

class SenderReputation(Base):
    __tablename__ = "sender_reputation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reputation_score = Column(DECIMAL(3, 2), default=5.00)  # Score de 0 à 10
    total_emails_sent = Column(Integer, default=0)
    bounced_emails = Column(Integer, default=0)
    spam_reports = Column(Integer, default=0)
    successful_deliveries = Column(Integer, default=0)
    last_calculated = Column(DateTime, server_default=func.now())
    warmup_status = Column(String(20), default='new')  # new, warming, active, restricted

    # Relationship
    user = relationship("User", back_populates="sender_reputation")

class AuthorizedDomain(Base):
    __tablename__ = "authorized_domains"

    id = Column(Integer, primary_key=True, autoincrement=True)
    domain_name = Column(String(255), nullable=False, unique=True)
    spf_configured = Column(Boolean, default=False)
    dkim_configured = Column(Boolean, default=False)
    dmarc_configured = Column(Boolean, default=False)
    verification_status = Column(String(20), default='pending')
    created_at = Column(DateTime, server_default=func.now())
    last_verified = Column(DateTime, nullable=True)

class EmailSendLog(Base):
    __tablename__ = "email_send_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=True)
    sent_at = Column(DateTime, server_default=func.now())
    status = Column(String(20), default='pending')  # pending, sent, bounced, delivered
    message_id = Column(String(255), nullable=True)
    bounce_reason = Column(String(500), nullable=True)
    spam_score = Column(DECIMAL(3, 2), nullable=True)

    # Relationship
    user = relationship("User", back_populates="email_send_logs")

class EmailLimitRule(Base):
    __tablename__ = "email_limit_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False)  # daily_limit, hourly_limit, recipient_limit
    default_value = Column(Integer, nullable=False)
    warmup_value = Column(Integer, nullable=False)
    max_value = Column(Integer, nullable=False)
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)