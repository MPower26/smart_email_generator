from fastapi import FastAPI, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
import logging
from sqlalchemy.orm import Session
import json
from typing import Dict, List
import asyncio
from datetime import datetime
import os
import time
import httpx
import urllib.parse

from app.api import auth
from app.db.database import engine, get_db
from app.models.models import Base
from app.routers import users
from app.services.followup_tasks import check_and_notify_followups
from app.websocket_manager import manager
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from ..config.settings import EMAIL_CONFIG
from app.services.gmail_service import send_gmail_email, GmailTokenError
from fastapi import HTTPException
from datetime import datetime
from sqlalchemy.orm import Session
from ..models.models import User, GeneratedEmail

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
# app = FastAPI(title="Smart Email Generator API", redirect_slashes=False)

# Note: Azure App Service has a read-only file system
# File uploads should use cloud storage (Azure Blob Storage) instead of local storage
# For now, we'll handle this gracefully and provide alternative solutions

# Define allowed origins
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://jolly-bush-0bae83703.6.azurestaticapps.net")
origins = [
    FRONTEND_URL,
    "http://localhost:3000",  # For local development
]

# Configure CORS
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
#     expose_headers=["*"]
# )

# Custom middleware to handle CORS for timeout responses
# @app.middleware("http")
# async def cors_timeout_middleware(request: Request, call_next):
#     start_time = time.time()
#     origin = request.headers.get("origin")
    
#     # Log CORS preflight requests
#     if request.method == "OPTIONS":
#         logger.info(f"🔄 CORS preflight request: {request.url.path} from origin: {origin}")
#         logger.info(f"   Headers: {dict(request.headers)}")
    
#     try:
#         logger.info(f"🔄 Processing request: {request.method} {request.url.path} from origin: {origin}")
#         response = await call_next(request)
        
#         # Ensure CORS headers are present for all responses
#         if origin in origins:
#             response.headers["Access-Control-Allow-Origin"] = origin
#             response.headers["Access-Control-Allow-Credentials"] = "true"
#             response.headers["Access-Control-Allow-Methods"] = "*"
#             response.headers["Access-Control-Allow-Headers"] = "*"
            
#             # Log CORS headers for debugging
#             if request.method == "OPTIONS":
#                 logger.info(f"✅ CORS preflight response headers: {dict(response.headers)}")
        
#         duration = time.time() - start_time
#         logger.info(f"✅ Request completed: {request.method} {request.url.path} in {duration:.2f}s")
#         return response
        
#     except Exception as e:
#         duration = time.time() - start_time
#         logger.error(f"❌ Request failed: {request.method} {request.url.path} after {duration:.2f}s")
#         logger.error(f"💥 Error: {str(e)}")
        
#         # If there's an exception (including timeout), return a proper CORS response
#         if origin in origins:
#             return Response(
#                 content=json.dumps({
#                     "error": "Request timeout or server error",
#                     "details": str(e),
#                     "duration": f"{duration:.2f}s"
#                 }),
#                 status_code=500,
#                 headers={
#                     "Access-Control-Allow-Origin": origin,
#                     "Access-Control-Allow-Credentials": "true",
#                     "Access-Control-Allow-Methods": "*",
#                     "Access-Control-Allow-Headers": "*",
#                     "Content-Type": "application/json"
#                 }
#             )
#         return Response(
#             content=json.dumps({
#                 "error": "Request timeout or server error",
#                 "details": str(e),
#                 "duration": f"{duration:.2f}s"
#             }),
#             status_code=500,
#             headers={"Content-Type": "application/json"}
#         )

# Add HTTPS redirection middleware SECOND
# @app.middleware("http")
# async def https_redirect(request: Request, call_next):
#     # Don't redirect OPTIONS requests (CORS preflight)
#     if request.method == "OPTIONS":
#         response = await call_next(request)
#         return response
    
#     # Only redirect HTTP to HTTPS for non-OPTIONS requests
#     if request.headers.get("x-forwarded-proto") == "http":
#         url = str(request.url)
#         url = url.replace("http://", "https://", 1)
#         from fastapi.responses import RedirectResponse
#         return RedirectResponse(url=url, status_code=301)
    
#     response = await call_next(request)
#     return response

# Include API routers
# app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
# app.include_router(users.router, prefix="/api/users", tags=["Users"])
# app.include_router(auth.router, prefix="/api", tags=["Gmail Auth"])
# app.include_router(users.router, prefix="/api", tags=["User Settings"])
# app.include_router(users.router, prefix="/api/templates", tags=["Templates"])
# app.include_router(users.router, prefix="/api/anti-spam", tags=["Anti-Spam"])

# @app.get("/")
# async def root():
#     return {"message": "Smart Email Generator API"}

# @app.get("/health")
# async def health_check():
#     """Health check endpoint for monitoring the API status"""
#     return {"status": "healthy"}

# @app.get("/websocket-test")
# async def websocket_test():
#     """Test endpoint to verify WebSocket support"""
#     try:
#         import websockets
#         import wsproto
#         return {
#             "message": "WebSocket test endpoint",
#             "websocket_support": True,
#             "websockets_version": websockets.__version__,
#             "wsproto_version": wsproto.__version__,
#             "endpoint": "/ws/progress/{user_id}"
#         }
#     except ImportError as e:
#         return {
#             "message": "WebSocket test endpoint",
#             "websocket_support": False,
#             "error": f"Missing WebSocket dependency: {str(e)}",
#             "endpoint": "/ws/progress/{user_id}"
#         }

# @app.websocket("/ws/test")
# async def websocket_test_connection(websocket: WebSocket):
#     """Simple WebSocket test endpoint"""
#     logger.info("WebSocket test connection attempt")
#     try:
#         await websocket.accept()
#         logger.info("WebSocket test connection accepted")
        
#         # Send a test message
#         await websocket.send_text(json.dumps({
#             "type": "test",
#             "message": "WebSocket connection successful!",
#             "timestamp": datetime.utcnow().isoformat()
#         }))
        
#         # Keep connection alive for a moment
#         await asyncio.sleep(1)
        
#         await websocket.close()
#         logger.info("WebSocket test connection closed")
        
#     except Exception as e:
#         logger.error(f"WebSocket test connection error: {str(e)}")
#         await websocket.close()

# @app.websocket("/ws/progress/{user_id}")
# async def websocket_progress(websocket: WebSocket, user_id: str):
#     """WebSocket endpoint for real-time progress tracking"""
#     logger.info(f"WebSocket connection attempt for user: {user_id}")
#     try:
#         await manager.connect(websocket, user_id)
#         logger.info(f"WebSocket connected successfully for user: {user_id}")
        
#         while True:
#             # Keep connection alive
#             data = await websocket.receive_text()
#             logger.debug(f"Received WebSocket message from {user_id}: {data}")
#             # Echo back to confirm connection
#             await websocket.send_text(json.dumps({"type": "ping", "message": "connected"}))
#     except WebSocketDisconnect:
#         logger.info(f"WebSocket disconnected for user: {user_id}")
#         manager.disconnect(websocket, user_id)
#     except Exception as e:
#         logger.error(f"WebSocket error for user {user_id}: {str(e)}")
#         manager.disconnect(websocket, user_id)

# @app.post("/scheduled/followup-check")
# async def run_followup_check(db: Session = Depends(get_db)):
#     """Scheduled endpoint to check and process followup emails"""
#     try:
#         logger.info("Starting scheduled followup check")
#         check_and_notify_followups(db)
#         logger.info("Scheduled followup check completed successfully")
#         return {"status": "success", "message": "Followup check completed"}
#     except Exception as e:
#         logger.error(f"Error in scheduled followup check: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Followup check failed: {str(e)}")

# # Dev-only login endpoint (for testing)
# @app.post("/dev-login")
# async def dev_login(email: str):
#     logger.info(f"Dev login for email: {email}")
#     return {"message": f"Dev login successful for {email}"}

# @app.get("/cors-test")
# async def cors_test(request: Request):
#     headers = dict(request.headers)
#     return {
#         "message": "CORS test successful!",
#         "request_headers": headers,
#         "origin": request.headers.get("origin"),
#         "method": request.method
#     }

# @app.options("/cors-test")
# async def cors_test_options():
#     """Handle OPTIONS request for CORS test"""
#     return {"message": "CORS preflight successful"} 

class EmailServiceError(Exception):
    """Custom exception for email service related errors."""
    pass

# Placeholder for verification email sending
async def send_verification_email(recipient_email: str, code: str):
    """Sends a verification code email using SendGrid."""
    try:
        # Create the email
        message = Mail()
        message.from_email = Email(EMAIL_CONFIG['sender_email'], EMAIL_CONFIG['from_name'])
        message.to = To(recipient_email)
        message.subject = 'Your Smart Email Generator Verification Code'
        
        # HTML content for the email
        html_content = f'''
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Verify Your Email</h2>
                <p>Your verification code is:</p>
                <h1 style="font-size: 32px; letter-spacing: 5px; background: #f5f5f5; padding: 15px; text-align: center; border-radius: 5px;">{code}</h1>
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">This email was sent by {EMAIL_CONFIG['from_name']}</p>
            </div>
        '''
        message.content = Content("text/html", html_content)

        # If a valid template ID is configured, use it
        if EMAIL_CONFIG['template_id'] and EMAIL_CONFIG['template_id'] != "your_template_id_here":
            message.template_id = EMAIL_CONFIG['template_id']
            message.dynamic_template_data = {
                'verification_code': code
            }
        
        # Send the email
        sg = SendGridAPIClient(EMAIL_CONFIG['api_key'])
        try:
            response = sg.send(message)
            if response.status_code not in range(200, 300):
                error_msg = f"SendGrid API returned status code {response.status_code}"
                logger.error(error_msg)
                raise EmailServiceError(error_msg)
        except Exception as e:
            logger.error(f"SendGrid API error: {str(e)}")
            raise EmailServiceError(f"SendGrid API error: {str(e)}") from e
            
        logger.info(f"Verification email sent successfully to {recipient_email}")
        return True
            
    except Exception as e:
        error_msg = f"Failed to send verification email: {str(e)}"
        logger.error(error_msg)
        raise EmailServiceError(error_msg) from e 

def send_email_via_gmail(db: Session, user: User, email: GeneratedEmail):
    """Sends a single generated email using the user's Gmail account."""
    try:
        # The actual sending logic using the Gmail service
        gmail_response = send_gmail_email(
            user=user,
            to_email=email.recipient_email,
            subject=email.subject,
            body=email.content
        )
        
        # If sending is successful, update the email's status in our DB
        email.status = f"{email.stage}_sent"
        email.sent_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Email sent successfully via Gmail", "gmail_response": gmail_response}
        
    except GmailTokenError as e:
        # This is the specific error for an expired/invalid token
        logger.error(f"Gmail token error for user {user.email}: {e}")
        raise HTTPException(
            status_code=401, 
            detail="Gmail token is invalid or expired. Please reconnect your account in settings."
        )
    except Exception as e:
        # Catch any other sending errors
        logger.error(f"Failed to send email {email.id} for user {user.email} via Gmail: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}") 
