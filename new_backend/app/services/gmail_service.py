import requests
import base64
import re
import os

class GmailTokenError(Exception):
    """Custom exception for Gmail token-related errors."""
    pass

def send_gmail_email(user, to_email, subject, body):
    """
    Sends an email using the user's Gmail account via the Gmail API.
    Appends the user's HTML signature if present and sends as HTML.

    Args:
        user: User object with .gmail_access_token and .email attributes
        to_email: Recipient's email address
        subject: Email subject
        body: Email body text

    Returns:
        The Gmail API response JSON on success.

    Raises:
        Exception: If Gmail is not connected or sending fails.
    """
    access_token = user.gmail_access_token
    if not access_token:
        raise Exception("Gmail not connected")
    
    # Convert newlines to <br> for HTML formatting
    body = body.replace('\n', '<br>')
    
    # --- Attachment placeholder replacement ---
    # Import here to avoid circular imports
    from app.db.database import get_db
    from app.models.models import Attachment
    
    # Get database session
    db = next(get_db())
    
    # Query all attachments for the user and replace [Placeholder] with the correct HTML tag
    attachments = db.query(Attachment).filter_by(user_id=user.id).all()
    for att in attachments:
        if att.placeholder:
            html_tag = att.blob_url
            if att.file_type.lower().startswith("image"):
                html_tag = f'<img src="{att.blob_url}" style="max-width:300px; height:auto;" alt="Attachment" />'
            elif att.file_type.lower().startswith("video"):
                # Use the watch page URL for videos instead of direct blob URL
                frontend_url = os.getenv("FRONTEND_URL", "https://jolly-bush-0bae83703.6.azurestaticapps.net")
                watch_url = f"{frontend_url}/watch?src={att.blob_url}&title={att.placeholder}"
                
                if getattr(att, 'gif_url', None):
                    html_tag = (
                        f'<a href="{watch_url}" target="_blank" rel="noopener">'
                        f'  <img src="{att.gif_url}" alt="\u25B6\ufe0f Watch video" '
                        f'       style="max-width:300px; height:auto; display:block; margin:0 auto;" />'
                        f'</a>'
                    )
                else:
                    # Fallback to direct video link if no GIF
                    html_tag = f'<a href="{watch_url}" target="_blank" rel="noopener">Watch Video</a>'
            
            # Replace [Placeholder] and [placeholder] (case-insensitive)
            body = re.sub(rf"\\[{att.placeholder}\\]", html_tag, body, flags=re.IGNORECASE)
            subject = re.sub(rf"\\[{att.placeholder}\\]", html_tag, subject, flags=re.IGNORECASE)
    
    # Debug: print signature image URL
    print("User signature image URL:", getattr(user, 'signature_image_url', None))
    
    # Append signature if present
    signature_lines = []
    if user.email_signature:
        # Replace placeholders and split lines for block formatting
        sig = user.email_signature
        sig = sig.replace("[Your Name]", user.full_name or "[Your Name]")
        sig = sig.replace("[Your Position]", user.position or "[Your Position]")
        sig = sig.replace("[Your Company]", user.company_name or "[Your Company]")
        # Split by lines and join with <br>
        sig_block = '<br>'.join([line.strip() for line in sig.splitlines() if line.strip()])
        signature_lines.append(sig_block)
    if hasattr(user, 'signature_image_url') and user.signature_image_url:
        signature_lines.append(f'<br><img src="{user.signature_image_url}" alt="Signature" style="max-width: 300px; height: auto;" />')
    signature_block = '<br>'.join(signature_lines)
    if signature_block:
        body = f"{body}<br><br>{signature_block}"
    
    # Debug: print final email body
    print("Final email body:", body)
    
    # Build MIME message for HTML
    message = f"From: {user.email}\r\nTo: {to_email}\r\nSubject: {subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n{body}"
    raw = base64.urlsafe_b64encode(message.encode("utf-8")).decode("utf-8")
    url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    data = {"raw": raw}
    resp = requests.post(url, headers=headers, json=data)
    
    # Specific check for token errors
    if resp.status_code == 401:
        raise GmailTokenError("Gmail token is expired or invalid. Please reconnect your account.")
        
    if resp.status_code not in [200, 202]:
        raise Exception(f"Gmail sending failed with status {resp.status_code}: {resp.text}")
        
    return resp.json()

def check_reply(user, generated_email):
    """
    Checks if the prospect has replied to an email thread.

    Args:
        user: User object with .gmail_access_token and .email attributes
        generated_email: GeneratedEmail object with .thread_id and .recipient_email

    Returns:
        True if a reply is found from the recipient, False otherwise.
    """
    access_token = user.gmail_access_token
    if not access_token:
        raise Exception("Gmail not connected")
    thread_id = getattr(generated_email, "thread_id", None)
    recipient_email = getattr(generated_email, "recipient_email", None)
    if not thread_id or not recipient_email:
        return False

    url = f"https://gmail.googleapis.com/gmail/v1/users/me/threads/{thread_id}?format=full"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        # If the thread no longer exists or can't be read, treat as not replied
        return False

    data = resp.json()
    messages = data.get("messages", [])
    # Skip the first message (sent by user), check if any other message is from the recipient
    for msg in messages[1:]:
        headers_list = msg.get("payload", {}).get("headers", [])
        from_email = None
        for header in headers_list:
            if header.get("name", "").lower() == "from":
                from_email = header.get("value", "").lower()
                break
        if from_email and recipient_email.lower() in from_email:
            return True
    return False
