from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import logging
from sqlalchemy.orm import Session

from app.api.endpoints import emails, friends, auth_gmail, user_settings, templates
from app.api import auth
from app.db.database import engine, get_db
from app.models.models import Base
from app.routers import users
from app.services.followup_tasks import check_and_notify_followups

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Smart Email Generator API")

# Configure CORS FIRST (before other middlewares)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://jolly-bush-0bae83703.6.azurestaticapps.net"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Add HTTPS redirection middleware AFTER CORS
@app.middleware("http")
async def https_redirect(request: Request, call_next):
    # Don't redirect OPTIONS requests (CORS preflight)
    if request.method == "OPTIONS":
        response = await call_next(request)
        return response
    
    # Only redirect HTTP to HTTPS for non-OPTIONS requests
    if request.headers.get("x-forwarded-proto") == "http":
        url = str(request.url)
        url = url.replace("http://", "https://", 1)
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=url, status_code=301)
    
    response = await call_next(request)
    return response

# Include API routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(emails.router, prefix="/api/emails", tags=["Emails"])
app.include_router(friends.router, prefix="/api/friends", tags=["Friends"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(auth_gmail.router, prefix="/api", tags=["Gmail Auth"])
app.include_router(user_settings.router, prefix="/api", tags=["User Settings"])
app.include_router(templates.router, prefix="/api/templates", tags=["Templates"])

@app.get("/")
async def root():
    return {"message": "Smart Email Generator API"}

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring the API status"""
    return {"status": "healthy"}

@app.post("/scheduled/followup-check")
async def run_followup_check(db: Session = Depends(get_db)):
    """Scheduled endpoint to check and process followup emails"""
    try:
        logger.info("Starting scheduled followup check")
        check_and_notify_followups(db)
        logger.info("Scheduled followup check completed successfully")
        return {"status": "success", "message": "Followup check completed"}
    except Exception as e:
        logger.error(f"Error in scheduled followup check: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Followup check failed: {str(e)}")

# Dev-only login endpoint (for testing)
@app.post("/dev-login")
async def dev_login(email: str):
    logger.info(f"Dev login for email: {email}")
    return {"message": f"Dev login successful for {email}"}

@app.get("/cors-test")
async def cors_test(request: Request):
    headers = dict(request.headers)
    return {
        "message": "CORS test successful!",
        "request_headers": headers,
        "origin": request.headers.get("origin"),
        "method": request.method
    }

@app.options("/cors-test")
async def cors_test_options():
    """Handle OPTIONS request for CORS test"""
    return {"message": "CORS preflight successful"} 
