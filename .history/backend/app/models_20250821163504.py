# 占位 ORM 文件，可扩展为 SQLAlchemy 模型
# models.py
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class DocumentHistory(Base):
    __tablename__ = "document_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    content = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
