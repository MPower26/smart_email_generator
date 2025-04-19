from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User, FriendRequest, user_friendship, GeneratedEmail
from app.api.auth import get_current_user

router = APIRouter()

class FriendRequestData(BaseModel):
    email: str

class FriendResponseData(BaseModel):
    status: str

class ShareData(BaseModel):
    share_enabled: bool

@router.get("/list", response_model=List[Dict[str, Any]])
async def get_friends_list(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of friends for the current user"""
    friends = []
    for friend in current_user.friends:
        friends.append({
            "id": friend.id,
            "email": friend.email,
            "name": friend.full_name,
            "combine_contacts": friend.combine_contacts
        })
    return friends

@router.get("/requests", response_model=List[Dict[str, Any]])
async def get_friend_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pending friend requests for the current user"""
    # Query for received pending requests
    pending_requests = db.query(FriendRequest).filter(
        and_(
            FriendRequest.to_user_id == current_user.id,
            FriendRequest.status == 'pending'
        )
    ).all()
    
    requests = []
    for request in pending_requests:
        sender = db.query(User).filter(User.id == request.from_user_id).first()
        if sender:
            requests.append({
                "id": sender.id,
                "email": sender.email,
                "name": sender.full_name,
                "created_at": request.created_at
            })
    return requests

@router.post("/request", status_code=status.HTTP_201_CREATED)
async def send_friend_request(
    request_data: FriendRequestData = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a friend request to another user"""
    # Check if friend exists
    friend = db.query(User).filter(User.email == request_data.email).first()
    if not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already friends
    if friend in current_user.friends:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already friends with this user"
        )
    
    # Check if request already exists
    existing_request = db.query(FriendRequest).filter(
        and_(
            FriendRequest.from_user_id == current_user.id,
            FriendRequest.to_user_id == friend.id,
            FriendRequest.status == 'pending'
        )
    ).first()
    
    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Friend request already sent"
        )
    
    # Create friend request
    friend_request = FriendRequest(
        from_user_id=current_user.id,
        to_user_id=friend.id,
        status='pending'
    )
    db.add(friend_request)
    db.commit()
    
    return {"message": "Friend request sent successfully"}

@router.post("/respond/{request_id}")
async def respond_to_friend_request(
    request_id: int,
    response_data: FriendResponseData = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Respond to a friend request"""
    if response_data.status not in ['accepted', 'rejected']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Must be 'accepted' or 'rejected'"
        )
    
    # Get the friend request
    request = db.query(FriendRequest).filter(
        and_(
            FriendRequest.from_user_id == request_id,
            FriendRequest.to_user_id == current_user.id,
            FriendRequest.status == 'pending'
        )
    ).first()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found"
        )
    
    # Update request status
    request.status = response_data.status
    
    # If accepted, create friendship
    if response_data.status == 'accepted':
        db.execute(
            user_friendship.insert().values(
                user_id=current_user.id,
                friend_id=request_id
            )
        )
        # Create reverse friendship
        db.execute(
            user_friendship.insert().values(
                user_id=request_id,
                friend_id=current_user.id
            )
        )
    
    db.commit()
    return {"message": f"Friend request {response_data.status}"}

@router.post("/share/{friend_id}")
async def toggle_friend_sharing(
    friend_id: int,
    share_data: ShareData = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle sharing with a friend"""
    # Check if they are friends
    friendship = db.query(user_friendship).filter(
        and_(
            user_friendship.c.user_id == current_user.id,
            user_friendship.c.friend_id == friend_id
        )
    ).first()
    
    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend not found"
        )
    
    # Get the friend
    friend = db.query(User).filter(User.id == friend_id).first()
    if not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend not found"
        )
    
    # Update friend's combine_contacts setting
    friend.combine_contacts = share_data.share_enabled
    
    # Keep track of updated emails
    updated_emails = []
    
    if share_data.share_enabled:
        # Get friend's sent emails
        friend_sent_emails = db.query(GeneratedEmail).filter(
            and_(
                GeneratedEmail.user_id == friend_id,
                GeneratedEmail.status == 'sent'
            )
        ).all()
        
        # Get current user's emails
        user_emails = db.query(GeneratedEmail).filter(
            GeneratedEmail.user_id == current_user.id
        ).all()
        
        # For each of the user's emails, check if friend has sent to same recipient in same stage
        for user_email in user_emails:
            was_updated = False
            for friend_email in friend_sent_emails:
                if (user_email.recipient_email == friend_email.recipient_email and 
                    user_email.stage == friend_email.stage):
                    # Only mark as sent by friend if not already sent
                    if user_email.status != 'sent':
                        user_email.status = 'sent by friend'
                        user_email.sent_at = friend_email.sent_at
                        was_updated = True
                    break
            if was_updated:
                updated_emails.append({
                    "id": user_email.id,
                    "to": user_email.recipient_email,
                    "subject": user_email.subject,
                    "body": user_email.content,
                    "status": user_email.status,
                    "stage": user_email.stage,
                    "shared_by": friend.email
                })
    else:
        # When sharing is disabled, reset all "sent by friend" emails back to draft
        user_emails = db.query(GeneratedEmail).filter(
            and_(
                GeneratedEmail.user_id == current_user.id,
                GeneratedEmail.status == 'sent by friend'
            )
        ).all()
        
        for email in user_emails:
            email.status = 'draft'
            email.sent_at = None
            updated_emails.append({
                "id": email.id,
                "to": email.recipient_email,
                "subject": email.subject,
                "body": email.content,
                "status": 'draft',
                "stage": email.stage,
                "shared_by": None
            })
    
    db.commit()
    
    return {
        "message": f"Contact sharing {'enabled' if share_data.share_enabled else 'disabled'}",
        "updated_emails": updated_emails
    }

@router.delete("/{friend_id}")
async def remove_friend(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a friend"""
    # Delete both directions of the friendship
    db.execute(
        user_friendship.delete().where(
            or_(
                and_(
                    user_friendship.c.user_id == current_user.id,
                    user_friendship.c.friend_id == friend_id
                ),
                and_(
                    user_friendship.c.user_id == friend_id,
                    user_friendship.c.friend_id == current_user.id
                )
            )
        )
    )
    db.commit()
    return {"message": "Friend removed"}

@router.get("/shared-emails", response_model=List[Dict[str, Any]])
async def get_shared_emails(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get emails shared by friends"""
    # Get friends who have sharing enabled
    friends_with_sharing = []
    for friend in current_user.friends:
        if friend.combine_contacts:
            friends_with_sharing.append(friend.id)
    
    if not friends_with_sharing:
        return []
    
    # Get emails from friends
    shared_emails = db.query(GeneratedEmail).filter(
        GeneratedEmail.user_id.in_(friends_with_sharing)
    ).all()
    
    return [
        {
            "id": email.id,
            "recipient_email": email.recipient_email,
            "recipient_name": email.recipient_name,
            "recipient_company": email.recipient_company,
            "subject": email.subject,
            "content": email.content,
            "status": email.status,
            "stage": email.stage,
            "created_at": email.created_at,
            "shared_by": db.query(User).get(email.user_id).email
        }
        for email in shared_emails
    ] 