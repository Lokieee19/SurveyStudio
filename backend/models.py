from sqlalchemy import Column, Integer, String, DateTime, func
from database import Base

# =============================
# 👤 USER MODEL
# =============================

class User(Base):
    __tablename__ = "users"

    # =============================
    # 🔑 PRIMARY KEY
    # =============================
    id = Column(Integer, primary_key=True, index=True)

    # =============================
    # 📧 USER INFO
    # =============================
    email = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    password = Column(
        String(255),
        nullable=False
    )

    # =============================
    # 🕒 TIMESTAMPS
    # =============================
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # =============================
    # 🔍 DEBUG / LOGGING
    # =============================
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}')>"