from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base
from datetime import datetime
from typing import Dict, List, Optional

class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    domain_name = Column(String(255), nullable=False, index=True)
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # DKIM configuration
    dkim_selector = Column(String(100), nullable=True)
    dkim_private_key = Column(Text, nullable=True)  # Encrypted private key
    dkim_public_key = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="domains")
    auth_checks = relationship("DomainAuthCheck", back_populates="domain", cascade="all, delete-orphan")
    alerts = relationship("DomainAlert", back_populates="domain", cascade="all, delete-orphan")

class DomainAuthCheck(Base):
    __tablename__ = "domain_auth_checks"

    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    check_type = Column(String(20), nullable=False)  # SPF, DKIM, DMARC
    record_found = Column(Boolean, default=False)
    is_valid = Column(Boolean, default=False)
    last_checked = Column(DateTime(timezone=True), server_default=func.now())
    next_check = Column(DateTime(timezone=True), nullable=True)
    
    # Additional data for each check type
    check_data = Column(JSON, nullable=True)  # Store specific data for each check type
    
    # Relationships
    domain = relationship("Domain", back_populates="auth_checks")

class DomainAlert(Base):
    __tablename__ = "domain_alerts"

    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    alert_type = Column(String(50), nullable=False)  # SPF_MISSING, DKIM_INVALID, DMARC_PERMISSIVE, etc.
    level = Column(String(20), nullable=False)  # warning, error, critical
    message = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    domain = relationship("Domain", back_populates="alerts") 