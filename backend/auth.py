from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, Header
import os

# =============================
# 🔐 CONFIG
# =============================

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
ISSUER = "survey-studio"

# =============================
# 🔐 PASSWORD HASHING
# =============================

pwd_context = CryptContext(
    schemes=["bcrypt_sha256"],   # avoids 72-byte bcrypt limit
    deprecated="auto"
)

# =============================
# 🔐 PASSWORD HANDLING
# =============================

def validate_password(password: str):
    if not password or len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long"
        )

def hash_password(password: str):
    password = password.strip()
    validate_password(password)
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain.strip(), hashed)

# =============================
# 🔐 TOKEN CREATION
# =============================

def create_token(data: dict):
    to_encode = data.copy()

    now = datetime.utcnow()
    expire = now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "iss": ISSUER,
    })

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# =============================
# 🔐 TOKEN VERIFICATION
# =============================

def decode_token(token: str):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        # Validate required fields
        if "sub" not in payload:
            raise HTTPException(401, "Invalid token: missing subject")

        if payload.get("iss") != ISSUER:
            raise HTTPException(401, "Invalid token issuer")

        return payload

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

# =============================
# 🔐 AUTH HEADER PARSER (FASTAPI)
# =============================

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header"
        )

    token = authorization.split(" ")[1]

    payload = decode_token(token)

    return payload["sub"]  # typically email