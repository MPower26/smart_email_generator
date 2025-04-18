from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.api.endpoints import emails
from app.api import auth
from app.db.database import engine
from app.models.models import Base

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Smart Email Generator API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(emails.router, prefix="/api/emails", tags=["Emails"])

@app.get("/")
async def root():
    return {"message": "Smart Email Generator API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Dev-only login endpoint (for testing)
@app.post("/dev-login")
async def dev_login(email: str):
    logger.info(f"Dev login for email: {email}")
    return {"message": f"Dev login successful for {email}"} 