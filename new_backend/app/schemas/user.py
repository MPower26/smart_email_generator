from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    position: str | None = None
    company_name: str | None = None
    company_description: str | None = None
    email_signature: str | None = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: str | None = None
    position: str | None = None
    company_name: str | None = None
    company_description: str | None = None
    email_signature: str | None = None

class User(UserBase):
    id: int
    is_verified: bool
    is_active: bool
    created_at: str
    updated_at: str | None = None

    class Config:
        from_attributes = True 
