from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, List
from pydantic import BaseModel
import os

from parser_service import smart_block_parser
from xml_generator import generate_xml

# =============================
# 🔐 AUTH + SECURITY
# =============================
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext

# =============================
# 🗄️ DATABASE
# =============================
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.exc import SQLAlchemyError

# =============================
# 🔹 CONFIG
# =============================
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./users.db"
)

# =============================
# 🔹 APP INIT
# =============================
app = FastAPI()

# =============================
# 🔐 CORS
# =============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://survey-studio-ten.vercel.app",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================
# 🔐 SECURITY (🔥 FIX)
# =============================
security = HTTPBearer()

# =============================
# 🔹 DATABASE ENGINE
# =============================
def get_engine():
    if DATABASE_URL.startswith("sqlite"):
        return create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False}
        )
    else:
        return create_engine(
            DATABASE_URL,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=1800
        )

engine = get_engine()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

# =============================
# 👤 USER MODEL
# =============================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    password = Column(String)

# =============================
# 🔐 PASSWORD HASHING
# =============================
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

def validate_password(password: str):
    if not password or len(password.strip()) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

def hash_password(password: str):
    password = password.strip()
    validate_password(password)
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str):
    try:
        return pwd_context.verify(plain.strip(), hashed)
    except Exception:
        return False

# =============================
# 🔐 TOKEN
# =============================
def create_token(data: dict):
    if "sub" not in data:
        raise HTTPException(500, "Token must include 'sub'")

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    })

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if "sub" not in payload:
            raise HTTPException(401, "Invalid token")

        return payload

    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

# =============================
# 🔐 AUTH DEPENDENCY (🔥 FIXED)
# =============================
ALLOWED_EMAILS = [
    "lokesh.m",
    "nishmitha.k",
    "goureesh.hegde",
    "dinesh1.kalimuthu",
    "shiprapandey"
]

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    payload = decode_token(token)
    email = payload["sub"]

    if email not in ALLOWED_EMAILS:
        raise HTTPException(403, "Access denied")

    return email

# =============================
# 🔹 DB SESSION
# =============================
def get_db():
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError:
        db.rollback()
        raise
    finally:
        db.close()

# =============================
# 🌱 SEED USERS
# =============================
def seed_users():
    db = SessionLocal()

    users = [
        {"email": "lokesh.m", "password": "Loke@1902"},
        {"email": "nishmitha.k", "password": "Nish@8980"},
        {"email": "goureesh.hegde", "password": "Gour@6564"},
        {"email": "dinesh1.kalimuthu", "password": "Dine@7860"},
        {"email": "shiprapandey", "password": "Ship@1424"},
    ]

    for u in users:
        existing = db.query(User).filter(User.email == u["email"]).first()

        if not existing:
            db.add(User(
                email=u["email"],
                password=hash_password(u["password"])
            ))

    db.commit()
    db.close()

# =============================
# 🚀 STARTUP
# =============================
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    seed_users()

# =============================
# 🔹 REQUEST MODELS
# =============================
class TextRequest(BaseModel):
    text: str

class AuthRequest(BaseModel):
    email: str
    password: str

# =============================
# 🔐 AUTH ROUTES
# =============================
@app.post("/login")
def login(req: AuthRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()

    if email not in ALLOWED_EMAILS:
        raise HTTPException(403, "Access restricted")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(401, "User not found")

    if not verify_password(req.password, user.password):
        raise HTTPException(401, "Invalid credentials")

    token = create_token({"sub": user.email})

    return {"token": token}

# =============================
# 🔹 PREVIEW
# =============================
@app.post("/preview")
async def preview(req: TextRequest):
    try:
        questions = smart_block_parser(req.text)
        return {"questions": questions}
    except Exception as e:
        return {"error": str(e), "questions": []}

# =============================
# 🔒 GENERATE (PROTECTED)
# =============================
@app.post("/generate")
async def generate(
    payload: List[Dict],
    user=Depends(get_current_user)
):
    try:
        if not payload:
            raise HTTPException(400, "Empty payload")

        xml = generate_xml(payload)

        return {
            "xml": xml,
            "user": user
        }

    except Exception as e:
        return {"error": str(e), "xml": ""}
    

