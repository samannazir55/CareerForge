from sqlalchemy import Column, Integer, String, Boolean, Float, Text
from ..database import Base

class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)           # e.g. "Student Pack"
    
    # Base price in USD (we'll convert to local currency on frontend)
    price_usd = Column(Float)                   # e.g. 9.99
    
    credits = Column(Integer)                   # e.g. 10 downloads
    description = Column(Text)                  # Benefits list
    
    # Universal Payment Gateway (Stripe, LemonSqueezy, Paddle)
    # These support automatic currency conversion worldwide
    stripe_payment_link = Column(String, nullable=True)      # Stripe Payment Link
    lemonsqueezy_link = Column(String, nullable=True)        # LemonSqueezy variant URL
    paddle_product_id = Column(String, nullable=True)        # Paddle product ID
    
    # Region-Specific Payment Methods (JSON structure)
    # Example: {"PK": "https://sadabiz.pk/...", "IN": "https://razorpay/...", "BR": "https://mercadopago/..."}
    regional_payment_links = Column(Text, nullable=True)     # Store as JSON string
    
    badge = Column(String, nullable=True)       # "POPULAR", "HOT DEAL"
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    
    # Metadata
    features_list = Column(Text, nullable=True)  # JSON array of features