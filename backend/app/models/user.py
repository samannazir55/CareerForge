from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from ..database import Base

class User(Base):
    __tablename__ = "users"

    id                   = Column(Integer, primary_key=True, index=True)
    email                = Column(String, unique=True, index=True)
    full_name            = Column(String, index=True)
    password_hash        = Column(String)
    is_active            = Column(Boolean, default=True)
    subscription_plan    = Column(String, default="basic")
    credits              = Column(Integer, default=3)

    # ── Email verification ────────────────────────────────────────────────────
    is_email_verified    = Column(Boolean, default=False)
    otp_code             = Column(String, nullable=True)        # 6-digit code
    otp_expires_at       = Column(DateTime, nullable=True)      # UTC expiry
    otp_attempts         = Column(Integer, default=0)           # brute-force guard
    otp_resend_count     = Column(Integer, default=0)           # resend rate limit
    otp_resend_at        = Column(DateTime, nullable=True)      # last resend time

    # ── Purchased templates ───────────────────────────────────────────────────
    # Stored as comma-separated template IDs  e.g. "startup_bold,executive"
    unlocked_templates   = Column(String, default="")
