from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
import bcrypt
from .config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password using native bcrypt.
    """
    if not plain_password or not hashed_password:
        return False
        
    try:
        # Safety Check: Bcrypt crashes if input > 72 bytes
        encoded_password = plain_password.encode('utf-8')
        if len(encoded_password) > 72:
            encoded_password = encoded_password[:72]
            
        encoded_hash = hashed_password.encode('utf-8')
        return bcrypt.checkpw(encoded_password, encoded_hash)
    except Exception as e:
        print(f"Native password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password using native bcrypt.
    """
    if not password:
        raise ValueError("Password cannot be empty")
    
    encoded_password = password.encode('utf-8')
    if len(encoded_password) > 72:
        encoded_password = encoded_password[:72]
    
    try:
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(encoded_password, salt)
        return hashed.decode('utf-8')
    except Exception as e:
        raise RuntimeError(f"Password hashing failed: {str(e)}") from e


def create_jwt_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT token with the given data.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_jwt_token(token: str) -> Optional[dict]:
    """
    Verify and decode a JWT token. Returns the payload dict or None if invalid.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None