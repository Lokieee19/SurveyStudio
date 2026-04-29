from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, Request
import os, re, secrets

# =============================
# 🔐 CONFIG
# =============================

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be set")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

ISSUER = "survey-studio"
AUDIENCE = "survey-users"
TOKEN_TYPE = "access"

# =============================
# 🔐 PASSWORD HASHING (STRONG)
# =============================

pwd_context = CryptContext(
    schemes=["bcrypt_sha256"],
    deprecated="auto",
    bcrypt__rounds=12   # stronger cost factor
)

# =============================
# 🔐 PASSWORD VALIDATION
# =============================

def validate_password(password: str):
    if not password or len(password.strip()) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    # 🔒 enforce complexity (enterprise style)
    if not re.search(r"[A-Z]", password):
        raise HTTPException(400, "Password must contain uppercase letter")

    if not re.search(r"[a-z]", password):
        raise HTTPException(400, "Password must contain lowercase letter")

    if not re.search(r"\d", password):
        raise HTTPException(400, "Password must contain a number")

# =============================
# 🔐 PASSWORD FUNCTIONS
# =============================

def hash_password(password: str):
    password = password.strip()
    validate_password(password)
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str):
    try:
        return pwd_context.verify(plain.strip(), hashed)
    except Exception:
        return False  # never leak internals

# =============================
# 🔐 TOKEN CREATION (HARDENED)
# =============================

def create_token(data: dict):
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    payload = {
        "sub": data.get("sub"),              # user identifier
        "role": data.get("role", "user"),   # RBAC
        "iat": now,
        "exp": expire,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "type": TOKEN_TYPE,
        "jti": secrets.token_hex(16)        # unique token id (anti-replay)
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# =============================
# 🔐 TOKEN VERIFICATION (STRICT)
# =============================

def decode_token(token: str):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=AUDIENCE,
            issuer=ISSUER
        )

        # 🔒 required fields
        if payload.get("type") != TOKEN_TYPE:
            raise HTTPException(401, "Invalid token type")

        if "sub" not in payload:
            raise HTTPException(401, "Invalid token")

        return payload

    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

# =============================
# 🔐 COOKIE AUTH + SESSION BINDING
# =============================

def get_current_user(request: Request):
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(401, "Not authenticated")

    payload = decode_token(token)

    # 🔒 Optional: IP binding (light protection)
    request_ip = request.client.host
    token_ip = payload.get("ip")

    if token_ip and token_ip != request_ip:
        raise HTTPException(401, "Session mismatch")

    return {
        "email": payload["sub"],
        "role": payload.get("role", "user"),
        "jti": payload.get("jti")
    }

# =============================
# 🔐 SECURE COOKIE HELPER
# =============================

def set_auth_cookie(response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="None",
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600
    )

# =============================
# 🔐 ROLE CHECK (RBAC)
# =============================

def require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")