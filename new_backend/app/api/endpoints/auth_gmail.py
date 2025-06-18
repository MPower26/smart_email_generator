from fastapi import APIRouter, Request, Depends, HTTPException, Query
from urllib.parse import urlencode
import os
import requests
from datetime import datetime, timedelta
from fastapi.responses import RedirectResponse
from app.models.models import User
from app.db.database import get_db
from sqlalchemy.orm import Session

router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_OAUTH_REDIRECT_URI")
FRONTEND_SUCCESS_URL = os.getenv("FRONTEND_SUCCESS_URL", "https://jolly-bush-0bae83703.6.azurestaticapps.net/gmail/success")
SCOPES = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly"

@router.get("/gmail/auth/start")
def gmail_auth_start(email: str = Query(...)):
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": email  # Pass user email as state
    }
    return {"auth_url": "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)}

@router.get("/gmail/auth/callback")
def gmail_auth_callback(
    code: str,
    state: str,  # This is the user email
    db: Session = Depends(get_db)
):
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    resp = requests.post(token_url, data=data)
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="OAuth failed")
    tokens = resp.json()
    
    # Calculate actual expiry timestamp
    expires_in = tokens.get("expires_in", 3600)  # Default to 1 hour if not provided
    expiry_timestamp = datetime.utcnow() + timedelta(seconds=expires_in)
    
    # Find user by email (state)
    user = db.query(User).filter_by(email=state).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found for Gmail OAuth callback")
    
    # Save tokens in user model
    user.gmail_access_token = tokens["access_token"]
    user.gmail_refresh_token = tokens.get("refresh_token")
    user.gmail_token_expiry = expiry_timestamp
    db.commit()
    # Redirect to frontend success page
    return RedirectResponse(FRONTEND_SUCCESS_URL)
