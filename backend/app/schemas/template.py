from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import datetime

# Shared properties
class TemplateBase(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = "general"
    is_premium: Optional[bool] = False

# Properties to receive on creation
class TemplateCreate(TemplateBase):
    id: str
    html_content: str
    css_styles: Optional[str] = ""

# Properties to receive on update
class TemplateUpdate(TemplateBase):
    html_content: Optional[str] = None
    css_styles: Optional[str] = None

# Properties shared by models stored in DB
class TemplateInDBBase(TemplateBase):
    id: str
    html_content: str
    css_styles: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # PYDANTIC V2 CONFIGURATION
    model_config = ConfigDict(from_attributes=True)

# Additional properties to return via API
class Template(TemplateInDBBase):
    pass

class TemplateFull(TemplateInDBBase):
    pass
