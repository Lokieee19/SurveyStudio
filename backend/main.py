from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
from pydantic import BaseModel

from parser_service import smart_block_parser
from xml_generator import generate_xml

# =============================
# 🔐 AUTH IMPORTS
# =============================
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext

from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base, Session


# =============================
# 🔹 APP INIT
# =============================
app = FastAPI()


# =============================
# 🔹 CORS
# =============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================
# 🔹 DATABASE
# =============================
DATABASE_URL = "sqlite:///./users.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)


Base.metadata.create_all(bind=engine)


# =============================
# 🔐 AUTH CONFIG (FIXED)
# =============================
SECRET_KEY = "CHANGE_THIS_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain, hashed)


def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# =============================
# 🔐 TOKEN VALIDATION
# =============================
def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    try:
        parts = authorization.split(" ")

        if len(parts) != 2 or parts[0] != "Bearer":
            raise HTTPException(status_code=401, detail="Invalid auth format")

        token = parts[1]

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        return email

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# =============================
# 🔹 DB SESSION
# =============================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =============================
# 🔹 SEED USERS (FIXED ORDER)
# =============================
def seed_users():
    db = SessionLocal()

    default_users = [
        {"email": "lokesh.m", "password": "Studio123"},
        {"email": "nishmitha.k", "password": "Studio123"},
        {"email": "goureesh.hegde", "password": "Studio123"},
        {"email": "dinesh1.kalimuthu", "password": "Studio123"},
    ]

    for u in default_users:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            db.add(User(
                email=u["email"],
                password=hash_password(u["password"])
            ))

    db.commit()
    db.close()


# Run at startup
@app.on_event("startup")
def startup_event():
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
@app.post("/signup")
def signup(req: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()

    if user:
        raise HTTPException(status_code=400, detail="User already exists")

    new_user = User(
        email=req.email,
        password=hash_password(req.password)
    )

    db.add(new_user)
    db.commit()

    return {"message": "User created successfully"}


@app.post("/login")
def login(req: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()

    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

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
        print("❌ PREVIEW ERROR:", str(e))
        return {"error": str(e), "questions": []}


# =============================
# 🔹 GENERATE (PROTECTED)
# =============================
@app.post("/generate")
async def generate(payload: List[Dict], user=Depends(get_current_user)):
    try:
        if not payload:
            raise HTTPException(status_code=400, detail="Empty payload")

        xml = generate_xml(payload)

        return {
            "xml": xml,
            "user": user
        }

    except Exception as e:
        print("❌ XML ERROR:", str(e))
        return {"error": str(e), "xml": ""}