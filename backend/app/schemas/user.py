from pydantic import BaseModel, EmailStr
from typing import Optional, List

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    subscription_plan: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenPayload(BaseModel):
    user_id: int
    email: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

class OTPResend(BaseModel):
    email: EmailStr

class User(UserBase):
    id: int
    is_active: bool
    is_email_verified: bool
    subscription_plan: str
    credits: Optional[int] = 3
    unlocked_templates: Optional[str] = ""

    class Config:
        from_attributes = True
        orm_mode = True

class UserProfile(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    is_email_verified: bool
    subscription_plan: str
    credits: Optional[int] = 3
    unlocked_templates: Optional[str] = ""

    class Config:
        from_attributes = True
        orm_mode = True

class UserResponse(BaseModel):
    success: bool
    data: Optional[UserProfile] = None
    error: Optional[str] = None

    class Config:
        from_attributes = True
        orm_mode = True
