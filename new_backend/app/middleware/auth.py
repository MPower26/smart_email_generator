from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..models.models import User
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current authenticated user based on the email in the Authorization header.
    This is a simplified version that uses email as the authentication token.
    """
    try:
        logger.info(f"Received credentials: {credentials.credentials}")
        
        # Extract email from credentials - handle both "Bearer email" and direct email formats
        email = credentials.credentials
        if email.lower().startswith('bearer '):
            email = email.split(' ')[1]
        
        logger.info(f"Extracted email: {email}")
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            logger.error(f"No user found for email: {email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.info(f"Successfully authenticated user: {email}")
        return user
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) 