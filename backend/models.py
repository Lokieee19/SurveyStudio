from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    Index, func
)
from database import Base
from datetime import datetime, timedelta


class User(Base):
    __tablename__ = "users"

    # =============================
    # 🆔 PRIMARY KEY
    # =============================
    id = Column(Integer, primary_key=True, index=True)

    # =============================
    # 📧 USER INFO
    # =============================
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)

    # 🔐 Normalize email storage
    # (always store lowercase in backend)

    # =============================
    # 🔐 ROLE & STATUS
    # =============================
    role = Column(String(50), default="user", nullable=False)  # user | admin

    is_active = Column(Boolean, default=True, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)

    # 🔐 Optional lifecycle control
    is_deleted = Column(Boolean, default=False, nullable=False)

    # =============================
    # 🔐 LOGIN PROTECTION
    # =============================
    failed_attempts = Column(Integer, default=0, nullable=False)
    lock_until = Column(DateTime, nullable=True)

    # =============================
    # 🕒 TIMESTAMPS
    # =============================
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    last_login = Column(DateTime, nullable=True)

    # =============================
    # 🌍 SECURITY TRACKING
    # =============================
    last_login_ip = Column(String(100), nullable=True)
    last_user_agent = Column(String(255), nullable=True)

    # =============================
    # ⚡ INDEXES
    # =============================
    __table_args__ = (
        Index("idx_user_email", "email"),
    )

    # =============================
    # 🧠 HELPER METHODS
    # =============================

    def normalize_email(self):
        """Ensure email consistency"""
        if self.email:
            self.email = self.email.strip().lower()

    def is_account_locked(self):
        """Check lock based on time + flag"""
        if self.is_locked:
            return True

        if self.lock_until and self.lock_until > datetime.utcnow():
            return True

        return False

    def register_failed_login(self):
        """Track failed login attempts"""
        self.failed_attempts += 1

        # 🔒 Lock after 5 attempts
        if self.failed_attempts >= 5:
            self.lock_until = datetime.utcnow() + timedelta(minutes=15)
            self.is_locked = True

    def reset_login_attempts(self):
        """Reset after successful login"""
        self.failed_attempts = 0
        self.lock_until = None
        self.is_locked = False

    def update_login_meta(self, ip=None, user_agent=None):
        """Track login activity"""
        self.last_login = datetime.utcnow()
        self.last_login_ip = ip
        self.last_user_agent = user_agent

    def soft_delete(self):
        """Soft delete user (enterprise safe)"""
        self.is_deleted = True
        self.is_active = False

    def __repr__(self):
        return (
            f"<User email={self.email} "
            f"role={self.role} "
            f"active={self.is_active} "
            f"locked={self.is_locked}>"
        )