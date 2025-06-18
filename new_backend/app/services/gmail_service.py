import requests
import base64

def send_gmail_email(user, to_email, subject, body):
    access_token = user.gmail_access_token
    if not access_token:
        raise Exception("Gmail not connected")
    message = f"From: {user.email}\r\nTo: {to_email}\r\nSubject: {subject}\r\n\r\n{body}"
    raw = base64.urlsafe_b64encode(message.encode("utf-8")).decode("utf-8")
    url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    data = {"raw": raw}
    resp = requests.post(url, headers=headers, json=data)
    if resp.status_code not in [200, 202]:
        raise Exception(f"Gmail sending failed: {resp.text}")
    return resp.json()
