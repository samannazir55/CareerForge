from pydantic import BaseModel
from typing import List, Optional
import datetime

class CVData(BaseModel):
    """
    Detail of all structured CV fields (mirrors most frontend form fields).
    NOW WITH CUSTOM SIDEBAR FIELDS!
    """
    # Core Fields
    full_name: str
    email: str
    phone: str
    job_title: str
    summary: str
    experience: str
    education: str
    skills: List[str]
    
    # NEW: Custom Sidebar Fields
    location: Optional[str] = ""
    hobbies: Optional[List[str]] = []
    languages: Optional[List[str]] = []
    certifications: Optional[List[str]] = []
    
    # NEW: Social Links
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    portfolio: Optional[str] = ""

class CVCreate(BaseModel):
    title: str
    data: CVData
    template_id: str = "modern"

class CVUpdate(BaseModel):
    title: Optional[str] = None
    data: Optional[CVData] = None
    template_id: Optional[str] = None

class CVInDB(BaseModel):
    id: int
    user_id: int
    title: str
    template_id: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        orm_mode = True

class CV(CVInDB):
    data: CVData

class CVList(BaseModel):
    """List of CVs for a user."""
    cvs: List[CV]

    class Config:
        orm_mode = True

class CVResponse(BaseModel):
    """Unified response schema for CV operations."""
    success: bool
    data: Optional[CV] = None
    error: Optional[str] = None

    class Config:
        orm_mode = True
        anystr_strip_whitespace = True
        use_enum_values = True