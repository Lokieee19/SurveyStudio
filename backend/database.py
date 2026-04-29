from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# =============================
# 🔐 DATABASE CONFIG
# =============================

# Use env variable (Render / production)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./users.db"  # fallback for local dev
)

# =============================
# ⚙️ ENGINE SETUP
# =============================

# Special handling for SQLite
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    # PostgreSQL / production setup
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,          # number of persistent connections
        max_overflow=20,       # extra burst connections
        pool_pre_ping=True     # auto-reconnect dead connections
    )

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
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()