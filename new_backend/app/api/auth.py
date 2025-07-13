from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
import logging
from ..db.database import get_db
from ..models.models import User, VerificationCode
from ..services.email_service import send_verification_email
from ..schemas.auth import VerificationRequest, VerificationResponse
from typing import Optional
from sqlalchemy import text

router = APIRouter()
logger = logging.getLogger(__name__)

# Dependency to get current user
async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    logger.info(f"Auth header: {authorization}")
    
    if not authorization:
        logger.error("Missing authorization header")
        raise HTTPException(
            status_code=401,
            detail="Unauthorized - Missing credentials"
        )
    
    # Extract email from Authorization header
    try:
        email = authorization.strip()
        if email.startswith('Bearer '):
            email = email.split(' ')[1].strip()
            # If it's a token, extract the email part
            if ':' in email:
                email = email.split(':')[0].strip()
        
        logger.info(f"Using email: {email}")
    except Exception as e:
        logger.error(f"Error parsing authorization header: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format"
        )
    
    logger.info(f"Looking up user with email: {email}")
    
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # For testing purposes, create a test user if it doesn't exist
        logger.warning(f"Creating test user for email: {email}")
        user = User(
            email=email,
            is_verified=True,
            full_name="Test User",
            company_name="Test Company", 
            position="Test Position"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Created test user with ID: {user.id}")
    else:
        logger.info(f"Found existing user with ID: {user.id}")
    
    return user

def get_user_from_db(user: User = Depends(get_current_user)):
    """Simple dependency to get the user object from the get_current_user dependency."""
    return user

@router.post("/request-code", response_model=VerificationResponse)
async def request_verification_code(request: VerificationRequest, db: Session = Depends(get_db)):
    try:
        logger.info("========= VERIFICATION REQUEST START =========")
        logger.info(f"Timestamp: {datetime.utcnow().isoformat()}")
        logger.info(f"Received verification request for email: {request.email}")
        
        # Log database connection status
        try:
            db.execute(text("SELECT 1"))
            logger.info("Database connection test: SUCCESS")
        except Exception as db_error:
            logger.error(f"Database connection test: FAILED - {str(db_error)}")
            raise HTTPException(
                status_code=500,
                detail="Database connection error"
            )
        
        # Check if user exists
        try:
            user = db.query(User).filter(User.email == request.email).first()
            logger.info(f"User lookup: {'Found' if user else 'Not found'}")
        except Exception as user_error:
            logger.error(f"User lookup error: {str(user_error)}")
            raise HTTPException(
                status_code=500,
                detail="Error looking up user"
            )
        
        # If user doesn't exist, create new user
        if not user:
            try:
                user = User(
                    email=request.email,
                    is_verified=False,
                    failed_verification_attempts=0,
                    last_verification_attempt=None
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info(f"Created new user with email: {request.email}")
                
                # Initialize anti-spam data for new user
                try:
                    from ..services.anti_spam_service import AntiSpamService
                    anti_spam_service = AntiSpamService(db)
                    anti_spam_service.initialize_user_anti_spam(user.id)
                    logger.info(f"Initialized anti-spam data for user {user.id}")
                except Exception as anti_spam_error:
                    logger.warning(f"Failed to initialize anti-spam data for user {user.id}: {str(anti_spam_error)}")
                    # Don't fail the user creation if anti-spam initialization fails
                
            except Exception as create_error:
                logger.error(f"User creation error: {str(create_error)}")
                raise HTTPException(
                    status_code=500,
                    detail="Error creating new user"
                )
        
        # Check verification attempts
        if user.failed_verification_attempts >= 5:
            if user.last_verification_attempt and (datetime.utcnow() - user.last_verification_attempt) < timedelta(minutes=30):
                logger.warning(f"Too many attempts for {request.email} - Last attempt: {user.last_verification_attempt}")
                raise HTTPException(
                    status_code=429,
                    detail="Too many verification attempts. Please try again later."
                )
            else:
                user.failed_verification_attempts = 0
                logger.info(f"Reset verification attempts for {request.email}")
        
        # Generate and store verification code
        try:
            code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
            expires_at = datetime.utcnow() + timedelta(minutes=15)
            
            verification_code = VerificationCode(
                user_id=user.id,
                code=code,
                expires_at=expires_at,
                is_used=False,
                attempts=0
            )
            db.add(verification_code)
            db.commit()
            logger.info("Verification code created and stored")
        except Exception as code_error:
            logger.error(f"Error creating verification code: {str(code_error)}")
            raise HTTPException(
                status_code=500,
                detail="Error generating verification code"
            )
        
        # Send verification email
        try:
            logger.info("Attempting to send verification email...")
            from ..config.settings import EMAIL_CONFIG
            logger.info(f"Email configuration loaded - Sender: {EMAIL_CONFIG['sender_email']}")
            
            await send_verification_email(request.email, code)
            logger.info("Verification email sent successfully")
        except Exception as email_error:
            logger.error(f"Email sending error: {str(email_error)}", exc_info=True)
            # Try to rollback verification code
            try:
                db.delete(verification_code)
                db.commit()
                logger.info("Rolled back verification code due to email error")
            except Exception as rollback_error:
                logger.error(f"Rollback error: {str(rollback_error)}")
            
            raise HTTPException(
                status_code=500,
                detail=f"Failed to send verification email: {str(email_error)}"
            )
        
        logger.info("========= VERIFICATION REQUEST END =========")
        return VerificationResponse(
            message="Verification code sent successfully",
            email=request.email
        )
        
    except HTTPException:
        logger.error("Request failed with HTTPException", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Unexpected error in request_verification_code: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/verify-code", response_model=VerificationResponse)
async def verify_code(request: VerificationRequest, db: Session = Depends(get_db)):
    try:
        logger.info(f"Received verification attempt for email: {request.email}")
        
        # Find user
        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        # Find active verification code
        verification_code = db.query(VerificationCode).filter(
            VerificationCode.user_id == user.id,
            VerificationCode.code == request.code,
            VerificationCode.expires_at > datetime.utcnow(),
            VerificationCode.is_used == False
        ).first()
        
        if not verification_code:
            # Increment failed attempts
            user.failed_verification_attempts += 1
            user.last_verification_attempt = datetime.utcnow()
            db.commit()
            
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired verification code"
            )
        
        # Mark code as used
        verification_code.is_used = True
        verification_code.attempts += 1
        
        # Mark user as verified
        user.is_verified = True
        user.failed_verification_attempts = 0
        user.last_verification_attempt = None
        
        db.commit()
        
        # Generate a simple token (in production, use JWT or similar)
        token = f"{user.email}:{datetime.utcnow().timestamp()}"
        
        return {
            "message": "Email verification successful",
            "email": request.email,
            "token": token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in verify_code: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        ) 
