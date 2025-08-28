from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Index, Boolean
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import pytz
from pydantic import BaseModel
from typing import List, Optional

# 基础声明
Base = declarative_base()


# Pydantic模型：用于响应
class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    docx_file: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse]

    class Config:
        from_attributes = True
class AIModelCreate(BaseModel):
    platform: str
    model_name: str
    api_key: str  # 用户提交明文 key
    class Config:
        from_attributes = True



class PlatformModelResponse(BaseModel):
    platform: str  # 平台名称，如 OpenAI
    models: List[str]  # 平台下的模型列表，如 ["gpt-3.5", "gpt-4"]

    class Config:
        from_attributes = True

# SQLAlchemy模型定义
class User(Base):
    __tablename__ = "users"
    username = Column(String(255), unique=True, index=True, nullable=False)
    id = Column(Integer, primary_key=True, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))
    role = Column(String(50), default="user")

    # 关系
    documents = relationship("DocumentHistory", back_populates="user")
    templates = relationship("Template", back_populates="user")
    ai_models = relationship("AIModel", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    api_logs = relationship("APILog", back_populates="user")


class DocumentHistory(Base):
    __tablename__ = "document_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doc_type = Column(String(100))
    content = Column(String(4000))
    filename = Column(String(255))
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系
    user = relationship("User", back_populates="documents")
    template = relationship("Template", back_populates="documents")
    tags = relationship("Tag", secondary="document_tags", back_populates="document_histories")


class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255))
    original_name = Column(String(255))
    uploaded_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))
    content = Column(String(4000))
    status = Column(String(50), default="active")

    # 关系
    user = relationship("User", back_populates="templates")
    documents = relationship("DocumentHistory", back_populates="template")


class AIModel(Base):
    __tablename__ = "ai_models"
    id = Column(Integer, primary_key=True, index=True)
    platform_name = Column(String(100), nullable=False)  # 平台名称，如 OpenAI、HuggingFace
    model_name = Column(String(100), nullable=False)  # 用户选择的模型名称
    api_key = Column(String(255), nullable=False)  # 用户输入的API Key
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))  # 创建时间
    updated_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC), onupdate=lambda: datetime.now(pytz.UTC))  # 更新时间

    # 关系
    user = relationship("User", back_populates="ai_models")



class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        Index('ix_user_id_created_at', 'user_id', 'created_at'),
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ai_model_id = Column(Integer, ForeignKey("ai_models.id"), nullable=False)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))
    updated_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC), onupdate=lambda: datetime.now(pytz.UTC))
    content = Column(String(1000))
    title = Column(String(50))
    status = Column(String(20), default="active")

    # 关系
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)

    # 关系
    document_histories = relationship("DocumentHistory", secondary="document_tags", back_populates="tags")


class DocumentTags(Base):
    __tablename__ = "document_tags"
    __table_args__ = (
        Index('ix_document_id_tag_id', 'document_id', 'tag_id'),
    )
    document_id = Column(Integer, ForeignKey("document_history.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)


class APILog(Base):
    __tablename__ = "api_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(String(200))
    request_params = Column(String(1000))
    response = Column(String(1000))
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系
    user = relationship("User", back_populates="api_logs")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String(500))
    read = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系
    user = relationship("User", back_populates="notifications")


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(String(2000))
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系
    conversation = relationship("Conversation", back_populates="messages")
