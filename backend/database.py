from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError
import os

# =============================
# 🔐 DATABASE CONFIG
# =============================

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./users.db"  # fallback for local dev
)

# =============================
# ⚙️ ENGINE SETUP
# =============================

def get_engine():
    """
    Creates and returns SQLAlchemy engine
    Handles SQLite vs PostgreSQL differences
    """

    if DATABASE_URL.startswith("sqlite"):
        return create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False}
        )
    else:
        return create_engine(
            DATABASE_URL,
            pool_size=10,          # persistent connections
            max_overflow=20,       # burst traffic
            pool_pre_ping=True,    # reconnect dead connections
            pool_recycle=1800      # avoid stale connections (30 mins)
        )

engine = get_engine()

# =============================
# 🧠 SESSION FACTORY
# =============================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# =============================
# 🧱 BASE MODEL
# =============================

Base = declarative_base()

# =============================
# 🔌 DB DEPENDENCY (FASTAPI)
# =============================

def get_db():
    """
    FastAPI dependency
    Ensures DB session is always closed
    """
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError:
        db.rollback()
        raise
    finally:
        db.close()

# =============================
# 🚀 INIT DB (CALL ON STARTUP)
# =============================

def init_db():
    """
    Import all models and create tables
    """
    from models import User  # 🔥 import ALL models here

    Base.metadata.create_all(bind=engine)

# =============================
# 🔍 HEALTH CHECK (OPTIONAL)
# =============================

def check_db_connection():
    """
    Useful for debugging / monitoring
    """
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        return True
    except Exception:
        return False