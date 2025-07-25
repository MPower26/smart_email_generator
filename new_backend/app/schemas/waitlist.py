from pydantic import BaseModel, EmailStr

class WaitlistCreate(BaseModel):
    first_name: str
    last_name: str
    company: str
    email: EmailStr
    subscribe_to_updates: bool

class WaitlistResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    company: str
    email: str
    subscribe_to_updates: bool

    class Config:
        from_attributes = True 