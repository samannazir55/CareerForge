
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .core.config import settings

# --- DATABASE URL PATCHER ---
# Render/Neon give "postgres://", but SQLAlchemy requires "postgresql://"
connection_string = settings.DATABASE_URL

if connection_string and connection_string.startswith("postgres://"):
    connection_string = connection_string.replace("postgres://", "postgresql://", 1)

# Ensure no surrounding quotes (User error protection)
if connection_string:
    connection_string = connection_string.strip('"').strip("'")

# Create Engine
# Note: connect_args={'check_same_thread': False} is only for SQLite.
# We need to detect if we are using SQLite or Postgres to apply correct args.

connect_args = {}
if "sqlite" in connection_string:
    connect_args = {"check_same_thread": False}

engine = create_engine(
    connection_string, 
    connect_args=connect_args,
    pool_pre_ping=True # Helps keep connection alive
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
