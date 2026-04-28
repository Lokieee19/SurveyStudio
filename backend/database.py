from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# =============================
# 🔐 DATABASE CONFIG
# =============================
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./users.db"
)

# 🔥 Fix Render postgres URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"✅ Using database: {DATABASE_URL}")

# =============================
# ⚙️ ENGINE SETUP
# =============================
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        future=True
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        future=True
    )

# =============================
# 🧠 SESSION FACTORY
# =============================
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)

# =============================
# 🧱 BASE MODEL
# =============================
Base = declarative_base()

# =============================
# 🔌 DB DEPENDENCY
# =============================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()