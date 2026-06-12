from sqlalchemy import Column, Integer, String, DateTime, func, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..database import Base

class CV(Base):
    __tablename__ = "cvs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    data = Column(JSON, nullable=False)  # Flexible CV data blob (JSON)
    template_id = Column(String, default="modern", nullable=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship back to the owning user
    owner = relationship("User", backref="cvs")

    def __repr__(self):
        return f"<CV(id={self.id}, user_id={self.user_id}, title='{self.title}')>"
    def __str__(self):
        return f"CV(id={self.id}, user_id={self.user_id}, title='{self.title}')"
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "data": self.data,
            "template_id": self.template_id,
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