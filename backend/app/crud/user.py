from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from ..models.user import User
from ..schemas import user as schemas
from ..core.security import get_password_hash
from ..services.email_service import generate_otp, otp_expiry, send_otp_email

# ─── Limits ───────────────────────────────────────────────────────────────────
MAX_OTP_ATTEMPTS  = 5    # wrong guesses before lockout
MAX_OTP_RESENDS   = 5    # resends per registration
RESEND_COOLDOWN_S = 60   # seconds between resend requests


def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(User).offset(skip).limit(limit).all()


def create_user(db: Session, user: schemas.UserCreate):
    """
    Create account in pending-verification state and send OTP.
    Account is NOT active until email is verified.
    """
    otp   = generate_otp()
    expiry = otp_expiry(minutes=10)

    db_user = User(
        email             = user.email,
        password_hash     = get_password_hash(user.password),
        full_name         = user.full_name,
        is_active         = True,
        is_email_verified = False,
        subscription_plan = "basic",
        credits           = 3,
        otp_code          = otp,
        otp_expires_at    = expiry,
        otp_attempts      = 0,
        otp_resend_count  = 1,           # counts as first send
        otp_resend_at     = datetime.now(timezone.utc),
        unlocked_templates= "",
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Send OTP (falls back to console in dev if SMTP not configured)
    send_otp_email(db_user.email, db_user.full_name or "there", otp)
    return db_user


def verify_otp(db: Session, email: str, otp: str) -> dict:
    """
    Verify a submitted OTP.
    Returns {"success": bool, "error": str | None}
    """
    user = get_user_by_email(db, email)
    if not user:
        return {"success": False, "error": "Account not found."}

    if user.is_email_verified:
        return {"success": True, "error": None}   # already verified

    # Brute-force guard
    if (user.otp_attempts or 0) >= MAX_OTP_ATTEMPTS:
        return {"success": False, "error": "Too many attempts. Please request a new code."}

    # Expiry check
    if not user.otp_expires_at:
        return {"success": False, "error": "No OTP found. Please request a new code."}

    expires = user.otp_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires:
        return {"success": False, "error": "Code expired. Please request a new one."}

    # Wrong code
    if user.otp_code != otp.strip():
        user.otp_attempts = (user.otp_attempts or 0) + 1
        db.commit()
        remaining = MAX_OTP_ATTEMPTS - user.otp_attempts
        return {"success": False, "error": f"Incorrect code. {remaining} attempt(s) remaining."}

    # ✅ Correct — activate account
    user.is_email_verified = True
    user.otp_code          = None
    user.otp_expires_at    = None
    user.otp_attempts      = 0
    db.commit()
    db.refresh(user)
    return {"success": True, "error": None}


def resend_otp(db: Session, email: str) -> dict:
    """
    Generate and resend a fresh OTP.
    Enforces rate-limiting (cooldown + max resends).
    """
    user = get_user_by_email(db, email)
    if not user:
        return {"success": False, "error": "Account not found."}

    if user.is_email_verified:
        return {"success": True, "error": None}

    # Max resends guard
    if (user.otp_resend_count or 0) >= MAX_OTP_RESENDS:
        return {"success": False, "error": "Maximum resend limit reached. Please contact support."}

    # Cooldown guard
    if user.otp_resend_at:
        last = user.otp_resend_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - last).total_seconds()
        if elapsed < RESEND_COOLDOWN_S:
            wait = int(RESEND_COOLDOWN_S - elapsed)
            return {"success": False, "error": f"Please wait {wait}s before requesting another code."}

    otp    = generate_otp()
    expiry = otp_expiry(minutes=10)

    user.otp_code         = otp
    user.otp_expires_at   = expiry
    user.otp_attempts     = 0
    user.otp_resend_count = (user.otp_resend_count or 0) + 1
    user.otp_resend_at    = datetime.now(timezone.utc)
    db.commit()

    send_otp_email(user.email, user.full_name or "there", otp)
    return {"success": True, "error": None}


def unlock_template(db: Session, user_id: int, template_id: str) -> bool:
    """Add a template to a user's unlocked list."""
    user = get_user(db, user_id)
    if not user:
        return False
    current = set(t for t in (user.unlocked_templates or "").split(",") if t)
    current.add(template_id)
    user.unlocked_templates = ",".join(current)
    db.commit()
    return True


def get_unlocked_templates(db: Session, user_id: int) -> list:
    user = get_user(db, user_id)
    if not user or not user.unlocked_templates:
        return []
    return [t for t in user.unlocked_templates.split(",") if t]


def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    for key, value in user_update.model_dump(exclude_unset=True).items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, user_id: int):
    user = get_user(db, user_id)
    if user:
        db.delete(user)
        db.commit()
        return True
    return False
