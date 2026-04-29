from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
from pydantic import BaseModel
import os

from parser_service import smart_block_parser
from xml_generator import generate_xml

# =============================
# 🔐 AUTH + SECURITY
# =============================
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext

# =============================
# 🗄️ DATABASE
# =============================
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base, Session

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
# 🔐 CORS (IMPORTANT)
# =============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://survey-studio-three.vercel.app"  # 🔥 your actual URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================
# 🔹 DATABASE ENGINE
# =============================
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# =============================
# 👤 USER MODEL
# =============================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    password = Column(String)

Base.metadata.create_all(bind=engine)

# =============================
# 🔐 PASSWORD HASHING
# =============================
pwd_context = CryptContext(
    schemes=["bcrypt_sha256"],
    deprecated="auto"
)

def validate_password(password: str):
    if not password or len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

def hash_password(password: str):
    password = password.strip()
    validate_password(password)
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain.strip(), hashed)

# =============================
# 🔐 TOKEN
# =============================
def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
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
# 🔐 AUTH HEADER
# =============================
def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Invalid authorization header")

    token = authorization.split(" ")[1]
    payload = decode_token(token)

    email = payload["sub"]

    # 🔐 Double-check allowed users
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
    finally:
        db.close()

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
# 🔹 REQUEST MODELS
# =============================
class TextRequest(BaseModel):
    text: str

class AuthRequest(BaseModel):
    email: str
    password: str

# =============================
# 🔐 ALLOWED USERS (FIXED)
# =============================
ALLOWED_EMAILS = [
    "lokesh.m",
    "nishmitha.k",
    "goureesh.hegde",
    "dinesh.kalimuthu",
    "shiprapandey"
]

# =============================
# 🔐 AUTH ROUTES
# =============================

@app.post("/signup")
def signup(req: AuthRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()

    if email not in ALLOWED_EMAILS:
        raise HTTPException(403, "Access restricted")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(400, "User already exists")

    user = User(
        email=email,
        password=hash_password(req.password)
    )

    db.add(user)
    db.commit()

    return {"message": "User created"}

@app.post("/login")
def login(req: AuthRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()

    if email not in ALLOWED_EMAILS:
        raise HTTPException(403, "Access restricted")

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(req.password, user.password):
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
# 🔒 GENERATE (FULLY PROTECTED)
# =============================
@app.post("/generate")
async def generate(payload: List[Dict], user=Depends(get_current_user)):
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