from fastapi import FastAPI, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import logging
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import json
from typing import Dict, List

from app.api.endpoints import emails, friends, auth_gmail, user_settings, templates
from app.api import auth
from app.db.database import engine, get_db
from app.models.models import Base
from app.routers import users
from app.services.followup_tasks import check_and_notify_followups
from app.websocket_manager import manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize background scheduler
scheduler = BackgroundScheduler()

def run_followup_check_job():
    """Background job to check and notify about followups"""
    try:
        logger.info("Starting scheduled followup check job")
        # Create a new database session for the background job
        from app.db.database import SessionLocal
        db = SessionLocal()
        try:
            check_and_notify_followups(db)
            logger.info("Scheduled followup check job completed successfully")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error in scheduled followup check job: {str(e)}")

# Schedule the followup check to run every hour
scheduler.add_job(
    func=run_followup_check_job,
    trigger=CronTrigger(hour="*"),  # Run every hour
    id="followup_check_job",
    name="Check and notify followups",
    replace_existing=True
)

# Start the scheduler
scheduler.start()
logger.info("Background scheduler started")

# Create FastAPI app
app = FastAPI(title="Smart Email Generator API", redirect_slashes=False)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://jolly-bush-0bae83703.6.azurestaticapps.net"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Add HTTPS redirection middleware SECOND
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

# Add explicit OPTIONS handlers for all API routes
@app.options("/api/emails/generate")
async def emails_generate_options():
    return Response(status_code=200)

@app.options("/api/emails/followup")
async def emails_followup_options():
    return Response(status_code=200)

@app.options("/api/emails/last-chance")
async def emails_lastchance_options():
    return Response(status_code=200)

@app.options("/api/friends/list")
async def friends_list_options():
    return Response(status_code=200)

@app.options("/api/users/profile")
async def users_profile_options():
    return Response(status_code=200)

@app.options("/auth/login")
async def auth_login_options():
    return Response(status_code=200)

@app.options("/api/gmail/auth")
async def gmail_auth_options():
    return Response(status_code=200)

@app.options("/api/settings")
async def settings_options():
    return Response(status_code=200)

@app.get("/")
async def root():
    return {"message": "Smart Email Generator API"}

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring the API status"""
    return {"status": "healthy"}

@app.websocket("/ws/progress/{user_id}")
async def websocket_progress(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time progress tracking"""
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Echo back to confirm connection
            await websocket.send_text(json.dumps({"type": "ping", "message": "connected"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

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

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources when the app shuts down"""
    logger.info("Shutting down background scheduler")
    scheduler.shutdown()
    logger.info("Background scheduler stopped") 
