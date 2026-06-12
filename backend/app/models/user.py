from sqlalchemy import Column, Integer, String, Boolean
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String, index=True)
    password_hash = Column(String)
    is_active = Column(Boolean, default=True)
    subscription_plan = Column(String, default="basic")
    
    # 💰 NEW: The Wallet System
    credits = Column(Integer, default=3) # Free trial credits
