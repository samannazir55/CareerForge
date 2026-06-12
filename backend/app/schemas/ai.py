from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any, Union 

# INPUT SCHEMA
class AIGenerationRequest(BaseModel):
    full_name: str
    email: EmailStr
    desired_job_title: str
    experience_level: str
    top_skills: List[str]
    personal_strengths: Optional[str] = None
    
    # Metadata required by main.py
    title: Optional[str] = "My AI CV" 
    template_id: Optional[str] = "modern" 

# OUTPUT SCHEMAS - ENHANCED VERSION
class AIConciseCVContent(BaseModel):
    full_name: str  # ← ADDED
    email: str      # ← ADDED
    phone: Optional[str] = ""  # ← ADDED
    desired_job_title: str  # ← ADDED
    professional_summary: str
    experience_points: List[str]
    education_formatted: str
    suggested_skills: List[str]

class AIGeneratedContent(AIConciseCVContent):
    additional_sections: Optional[Dict[str, Any]] = None

class AIResponse(BaseModel):
    success: bool
    data: Optional[Union[AIGeneratedContent, AIConciseCVContent]] = None
    error: Optional[Dict[str, Any]] = None