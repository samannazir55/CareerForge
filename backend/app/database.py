from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .core.config import settings
import re # Added for safe string replacement

connection_string = settings.DATABASE_URL

if connection_string:
    # 1. Clean up surrounding quotes
    connection_string = connection_string.strip('"').strip("'")
    
    # 2. Correct "postgres://" to "postgresql://"
    if connection_string.startswith("postgres://"):
        connection_string = connection_string.replace("postgres://", "postgresql://", 1)
        
    # 3. Strip out "channel_binding" as older psycopg2 builds on Render will crash on it
    connection_string = re.sub(r'[&?]channel_binding=[^&]+', '', connection_string)

# Create Engine
connect_args = {}
# Added the 'connection_string and' check to prevent NoneType crash
if connection_string and "sqlite" in connection_string:
    connect_args = {"check_same_thread": False}

engine = create_engine(
    connection_string, 
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()