from sqlalchemy import Column, Integer, String, Boolean, DateTime
from database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    # =============================
    # 🆔 PRIMARY KEY
    # =============================
    id = Column(Integer, primary_key=True, index=True)

    # =============================
    # 📧 USER INFO
    # =============================
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)

    # =============================
    # 🔐 ACCOUNT STATUS
    # =============================
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)

    # 🔒 Optional future security
    is_locked = Column(Boolean, default=False, nullable=False)

    # =============================
    # 🕒 TIMESTAMPS
    # =============================
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # =============================
    # 🔐 SECURITY / TRACKING
    # =============================
    last_login = Column(DateTime, nullable=True)

    # =============================
    # 🧠 HELPER METHODS
    # =============================

    def __repr__(self):
        return f"<User email={self.email} active={self.is_active}>"