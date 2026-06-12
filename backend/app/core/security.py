from datetime import datetime, timedelta
from typing import Optional, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
from .config import settings

# ========================================
# BCRYPT 4.x COMPATIBILITY FIX
# ========================================
# Passlib expects bcrypt to have __about__.__version__
# but bcrypt 4.x removed it. We patch it here.
try:
    import bcrypt
    # Check if __about__ exists, if not create it
    if not hasattr(bcrypt, '__about__'):
        class About:
            __version__ = bcrypt.__version__
        bcrypt.__about__ = About()
except ImportError:
    pass

# Setup hashing engine
# Use bcrypt with explicit backend configuration
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.
    
    Args:
        plain_password: The plain text password to verify
        hashed_password: The hashed password to check against
        
    Returns:
        bool: True if password matches, False otherwise
    """
    if not plain_password or not hashed_password:
        return False
        
    # Safety Check: Bcrypt crashes if input > 72 bytes
    try:
        # Passlib handles some of this, but we add extra safety
        encoded = plain_password.encode('utf-8')
        if len(encoded) > 72:
            # Truncate to 72 bytes
            plain_password = encoded[:72].decode('utf-8', errors='ignore')
            
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, Exception) as e:
        # Log the error in production
        print(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    IMPORTANT: Bcrypt cannot digest > 72 bytes. We truncate to stay safe.
    This maintains security while preventing server crashes.
    
    Args:
        password: The plain text password to hash
        
    Returns:
        str: The hashed password
        
    Raises:
        ValueError: If password is empty
        RuntimeError: If hashing fails
    """
    if not password:
        raise ValueError("Password cannot be empty")
    
    # Truncate to 72 bytes for bcrypt compatibility
    encoded = password.encode('utf-8')
    if len(encoded) > 72:
        password = encoded[:72].decode('utf-8', errors='ignore')
    
    try:
        return pwd_context.hash(password)
    except Exception as e:
        # More detailed error for debugging
        raise RuntimeError(f"Password hashing failed: {str(e)}") from e


def create_jwt_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT token with the given data.
    
    Args:
        data: Dictionary of claims to encode in the token
        expires_delta: Optional custom expiration time
        
    Returns:
        str: The encoded JWT token
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_jwt_token(token: str) -> dict:
    """
    Verify and decode a JWT token.
    
    Args:
        token: The JWT token to verify
        
    Returns:
        dict: The decoded token payload, or None if invalid
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


# Deployment Trigger Update: 1767356701.6331584