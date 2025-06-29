from pydantic import BaseModel, EmailStr
from typing import List, Optional

class AttachmentBase(BaseModel):
    id: int
    filename: str
    blob_url: str
    placeholder: str
    file_type: str
    category: Optional[str] = None
    created_at: Optional[str] = None
    class Config:
        orm_mode = True

class AttachmentOut(AttachmentBase):
    pass

class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    position: str | None = None
    company_name: str | None = None
    company_description: str | None = None
    email_signature: str | None = None
    signature_image_url: str | None = None
    attachments: List[AttachmentOut] = []

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: str | None = None
    position: str | None = None
    company_name: str | None = None
    company_description: str | None = None
    email_signature: str | None = None
    signature_image_url: str | None = None

class User(UserBase):
    id: int
    is_verified: bool
    is_active: bool
    created_at: str
    updated_at: str | None = None

    class Config:
        from_attributes = True 
