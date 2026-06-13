import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # --- Project Settings ---
    PROJECT_NAME: str = "CareerForge"
    PROJECT_VERSION: str = "1.0.0"
    DEBUG: bool = False  # Set to False in production

    # --- Database Settings ---
    # Render will provide DATABASE_URL via environment variable
    # Fallback to SQLite for local development
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./cv_builder_local.db")

    # --- Security ---
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "unsafe-secret-key-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    # --- ADMIN ---
    # Defines who can upload templates
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@example.com")

    # --- AI BRAIN KEYS ---
    GEMINI_API_KEY: Optional[str] = None   # Primary — free at aistudio.google.com
    GROQ_API_KEY: Optional[str] = None     # Fallback (blocked on some Render IPs)
    OPENAI_API_KEY: Optional[str] = None   # Fallback
    
    # --- Email / SMTP ---
    SMTP_HOST:     str           = "smtp.gmail.com"
    SMTP_PORT:     int           = 587
    SMTP_USER:     Optional[str] = None   # e.g. yourapp@gmail.com
    SMTP_PASSWORD: Optional[str] = None   # Gmail App Password
    SMTP_FROM:     Optional[str] = None   # defaults to SMTP_USER

    # --- Legacy/Optional ---
    HUGGING_FACE_TOKEN: Optional[str] = None

    # --- CONFIGURATION ---
    # This magic line tells Pydantic: 
    # "Read .env file" AND "Ignore any extra variables you don't know about"
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore"  # <--- THIS STOPS THE CRASH
    )

settings = Settings()

def get_settings() -> Settings:
    return settings