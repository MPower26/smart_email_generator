from fastapi import APIRouter, Request, Depends, HTTPException
from urllib.parse import urlencode
import os
import requests
from app.models.models import User, get_db
from sqlalchemy.orm import Session

router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_OAUTH_REDIRECT_URI")
SCOPES = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly"

@router.get("/gmail/auth/start")
def gmail_auth_start():
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent"
    }
    return {"auth_url": "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)}

@router.get("/gmail/auth/callback")
def gmail_auth_callback(code: str, db: Session = Depends(get_db), user: User = Depends()):
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
    # Save tokens in user model
    user.gmail_access_token = tokens["access_token"]
    user.gmail_refresh_token = tokens.get("refresh_token")
    user.gmail_token_expiry = tokens.get("expires_in")
    db.commit()
    return {"success": True}
