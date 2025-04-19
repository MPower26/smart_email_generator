from pydantic import BaseModel, EmailStr
from typing import Optional

class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_verified: bool

    class Config:
        from_attributes = True

class VerificationRequest(BaseModel):
    email: EmailStr
    code: str = None

class VerificationResponse(BaseModel):
    message: str
    email: EmailStr 