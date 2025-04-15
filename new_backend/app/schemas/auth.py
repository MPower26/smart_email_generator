from pydantic import BaseModel, EmailStr

class VerificationRequest(BaseModel):
    email: EmailStr
    code: str = None

class VerificationResponse(BaseModel):
    message: str
    email: EmailStr 