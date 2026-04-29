from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import JSONResponse

from typing import Dict, List
from pydantic import BaseModel
import os, time

from parser_service import smart_block_parser
from xml_generator import generate_xml

# =============================
# 🔐 AUTH
# =============================
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext

# =============================
# 🗄️ DATABASE
# =============================
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# =============================
# 🚦 RATE LIMITING
# =============================
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# =============================
# 🔹 CONFIG
# =============================
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY missing")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./users.db")

# =============================
# 🔹 APP INIT
# =============================
app = FastAPI(docs_url=None, redoc_url=None)

# =============================
# 🔐 REQUEST MODEL (FIX)
# =============================
class TextRequest(BaseModel):
    text: str

# =============================
# 🔐 CORS
# =============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://survey-studio-ten.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
)

# =============================
# 🔐 HOST SECURITY
# =============================
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]
)

# =============================
# 🔐 SECURITY HEADERS
# =============================
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=63072000"
    return response

# =============================
# 🔐 REQUEST SIZE LIMIT
# =============================
@app.middleware("http")
async def limit_body(request: Request, call_next):
    body = await request.body()
    if len(body) > 200_000:
        return JSONResponse(status_code=413, content={"error": "Too large"})
    request._body = body
    return await call_next(request)

# =============================
# 🚦 RATE LIMIT
# =============================
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"error": "Too many requests"})

# =============================
# 🔹 DATABASE
# =============================
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =============================
# 👤 USER MODEL
# =============================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)

    role = Column(String, default="user")
    is_locked = Column(Boolean, default=False)
    failed_attempts = Column(Integer, default=0)

# =============================
# 📱 SESSION MODEL
# =============================
class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    user_email = Column(String, index=True)
    token = Column(String)
    ip = Column(String)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# =============================
# 🔐 PASSWORD
# =============================
pwd_context = CryptContext(schemes=["bcrypt_sha256"])

def hash_password(p):
    return pwd_context.hash(p)

def verify_password(p, h):
    try:
        return pwd_context.verify(p, h)
    except:
        return False

# =============================
# 🔐 TOKEN
# =============================
def create_token(data: dict):
    now = datetime.utcnow()
    payload = {
        "sub": data["sub"],
        "role": data.get("role", "user"),
        "iat": now,
        "exp": now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid token")

# =============================
# 🔐 AUTH
# =============================
def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")

    payload = decode_token(token)

    session = db.query(SessionModel).filter(SessionModel.token == token).first()
    if not session:
        raise HTTPException(401, "Session invalid")

    return payload

# =============================
# 🧾 AUDIT LOG
# =============================
def audit(user, action):
    print(f"[AUDIT] {user} -> {action} @ {time.time()}")

# =============================
# 🔹 LOGIN
# =============================
@app.post("/login")
@limiter.limit("5/minute")
def login(data: dict, request: Request, response: Response, db: Session = Depends(get_db)):
    email = data.get("email")
    password = data.get("password")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(401, "Invalid credentials")

    if user.is_locked:
        raise HTTPException(403, "Account locked")

    if not verify_password(password, user.password):
        user.failed_attempts += 1
        if user.failed_attempts >= 5:
            user.is_locked = True
        db.commit()
        raise HTTPException(401, "Invalid credentials")

    user.failed_attempts = 0
    db.commit()

    token = create_token({"sub": user.email, "role": user.role})

    db.add(SessionModel(
        user_email=user.email,
        token=token,
        ip=request.client.host,
        user_agent=request.headers.get("user-agent")
    ))
    db.commit()

    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="None")

    audit(user.email, "login")

    return {"message": "ok"}

# =============================
# 🔹 LOGOUT
# =============================
@app.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")

    db.query(SessionModel).filter(SessionModel.token == token).delete()
    db.commit()

    response = JSONResponse({"msg": "logout"})
    response.delete_cookie("access_token")

    return response

# =============================
# 🔹 PREVIEW
# =============================
@app.post("/preview")
@limiter.limit("20/minute")
async def preview(req: TextRequest):
    try:
        return {"questions": smart_block_parser(req.text)}
    except Exception:
        return {"questions": []}

# =============================
# 🔒 GENERATE
# =============================
@app.post("/generate")
@limiter.limit("10/minute")
def generate(payload: List[Dict], user=Depends(get_current_user)):
    audit(user["sub"], "generate")

    xml = generate_xml(payload)

    return {"xml": xml}