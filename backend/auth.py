from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

# =============================
# 🔐 CONFIG
# =============================

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("❌ SECRET_KEY is not set in environment variables")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# =============================
# 🔐 SECURITY SCHEME (🔥 IMPORTANT)
# =============================

security = HTTPBearer()

# =============================
# 🔐 PASSWORD HASHING
# =============================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

def validate_password(password: str) -> str:
    if not password:
        raise HTTPException(status_code=400, detail="Password required")

    password = password.strip()

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    return password


def hash_password(password: str) -> str:
    password = validate_password(password)
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain.strip(), hashed)
    except Exception:
        return False


# =============================
# 🔐 TOKEN GENERATION
# =============================

def create_token(data: dict) -> str:
    """
    Expected:
    {
        "sub": user_email
    }
    """
    if "sub" not in data:
        raise HTTPException(status_code=500, detail="Token must include 'sub'")

    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    payload = {
        **data,
        "exp": expire,
        "iat": now,
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# =============================
# 🔐 TOKEN DECODE
# =============================

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if "sub" not in payload:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        return payload

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# =============================
# 🔐 CURRENT USER (🔥 FIXED)
# =============================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Extracts user from Bearer token (Swagger compatible)
    Returns: email
    """
    token = credentials.credentials

    payload = decode_token(token)
    email = payload["sub"]

    return email


# =============================
# 🔐 OPTIONAL (if you still need raw header parsing)
# =============================

def extract_token(authorization: str) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    return authorization.split(" ")[1]