from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# =============================
# 🔐 CONFIG
# =============================

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./users.db"  # local fallback

# 🔥 Fix Render postgres URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite")
ENV = os.getenv("ENV", "development")

# ⚠️ Never print full DB URL in production
if ENV != "production":
    print(f"✅ Using database: {DATABASE_URL}")

# =============================
# 🔐 ENGINE CONFIG
# =============================

if IS_SQLITE:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        future=True
    )
else:
    # =============================
    # 🔐 SSL ENFORCEMENT
    # =============================
    connect_args = {}

    if "sslmode" not in DATABASE_URL:
        connect_args["sslmode"] = "require"

    # =============================
    # ⚙️ PRODUCTION ENGINE
    # =============================
    engine = create_engine(
        DATABASE_URL,

        # 🔒 Connection pooling
        pool_size=int(os.getenv("DB_POOL_SIZE", 10)),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", 20)),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", 30)),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", 1800)),
        pool_pre_ping=True,

        # 🔒 Security + stability
        connect_args=connect_args,
        echo=False,
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
# 🔌 DB DEPENDENCY (SAFE)
# =============================

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

# =============================
# 🔐 HEALTH CHECK
# =============================

def check_db_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))  # ✅ SQLAlchemy 2.0 safe
        return True
    except Exception as e:
        if ENV != "production":
            print("❌ DB connection failed:", str(e))
        return False