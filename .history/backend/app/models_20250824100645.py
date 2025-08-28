from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Index, Boolean
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import pytz  # 推荐使用 pytz 处理 UTC

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    username = Column(String(255), unique=True, index=True, nullable=False)
    id = Column(Integer, primary_key=True, index=True)
    password_hash = Column(String(255), nullable=False)  ：指定长度
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))  ：带时区默认值
    role = Column(String(50), default="user")  ：指定长度
    # 关系
    documents = relationship("DocumentHistory", back_populates="user")
    templates = relationship("Template", back_populates="user")  # ✅ 补充：反向关系
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
    tags = relationship("Tag", secondary="document_tags", back_populates="document_histories")  # ✅ 补充


class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255))  
    original_name = Column(String(255))  
    uploaded_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))  
    content = Column(String(4000))  ，或 Text
    # 关系
    user = relationship("User", back_populates="templates")
    documents = relationship("DocumentHistory", back_populates="template")


class AIModel(Base):
    __tablename__ = "ai_models"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  
    model_type = Column(String(50))  
    training_data = Column(String(500))  ，或 Text
    status = Column(String(20), default="active")  
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # 关系
    user = relationship("User", back_populates="ai_models")
    conversations = relationship("Conversation", back_populates="ai_model")


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        Index('ix_user_id_created_at', 'user_id', 'created_at'),
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ai_model_id = Column(Integer, ForeignKey("ai_models.id"), nullable=False)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))  
    updated_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC), onupdate=lambda: datetime.now(pytz.UTC))  # ✅ 建议：更新时间自动更新
    content = Column(String(1000))  
    # 关系
    user = relationship("User", back_populates="conversations")
    ai_model = relationship("AIModel", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")  # ✅ 补充


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
    # ✅ 联合主键已正确定义，无需额外 id 字段


class APILog(Base):
    __tablename__ = "api_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(String(200))  
    request_params = Column(String(1000))  ，或 JSON
    response = Column(String(1000))  ，或 JSON
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))  
    # 关系
    user = relationship("User", back_populates="api_logs")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String(500))  
    read = Column(Boolean, default=False)  # ✅ 正确使用 Boolean
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