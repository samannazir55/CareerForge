from sqlalchemy import Column, String, Boolean, DateTime, Text, func
from ..database import Base

class Template(Base):
    __tablename__ = "templates"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    is_premium = Column(Boolean, default=False)
    html_content = Column(Text, nullable=False)
    css_styles = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Template(id='{self.id}', name='{self.name}')>"
    def __str__(self):
        return f"Template(id='{self.id}', name='{self.name}')"
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "is_premium": self.is_premium,
            "html_content": self.html_content,
            "css_styles": self.css_styles,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    def from_dict(self, data):
        for key, value in data.items():
            if hasattr(self, key):
                setattr(self, key, value)
        return self
    def update(self, data):
        for key, value in data.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.updated_at = func.now()
        return self
    def __eq__(self, other):
        if not isinstance(other, Template):
            return False
        return self.id == other.id and self.name == other.name and self.category == other.category and self.is_premium == other.is_premium
    def __ne__(self, other):
        return not self.__eq__(other)
    def __hash__(self):
        return hash((self.id, self.name, self.category, self.is_premium))
    def __lt__(self, other):
        if not isinstance(other, Template):
            return NotImplemented
        return (self.name, self.category) < (other.name, other.category)
    def __le__(self, other):
        if not isinstance(other, Template):
            return NotImplemented
        return (self.name, self.category) <= (other.name, other.category)
    def __gt__(self, other):
        if not isinstance(other, Template):
            return NotImplemented
        return (self.name, self.category) > (other.name, other.category)