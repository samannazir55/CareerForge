from pydantic import BaseModel, EmailStr
from typing import Optional

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

class User(UserBase):
    id: int
    is_active: bool
    subscription_plan: str

    class Config:
        orm_mode = True

class UserProfile(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    subscription_plan: str

    class Config:
        orm_mode = True
class UserResponse(BaseModel):
    success: bool
    data: Optional[UserProfile] = None
    error: Optional[str] = None  # Error message if any

    class Config:
        orm_mode = True
        anystr_strip_whitespace = True  # Automatically strip whitespace from strings
        use_enum_values = True  # Use enum values instead of enum names in the output