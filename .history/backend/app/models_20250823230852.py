from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime, timezone
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(TIMESTAMP, default=datetime.now(timezone.utc))
    documents = relationship("DocumentHistory", back_populates="user")
    role = Column(String, default="user")  # admin, user, ai

class DocumentHistory(Base):
    __tablename__ = "document_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    doc_type = Column(String)
    content = Column(String)
    filename = Column(String)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)  
    created_at = Column(TIMESTAMP, default=datetime.now(timezone.utc))
    user = relationship("User", back_populates="documents")
    template = relationship("Template", back_populates="documents")  

class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    original_name = Column(String)
    uploaded_at = Column(TIMESTAMP, default=datetime.now(timezone.utc))
    user = relationship("User")
    content = Column(String) 
    documents = relationship("DocumentHistory", back_populates="template")  

class AIModel(Base):
    __tablename__ = "ai_models"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    model_type = Column(String)  # 例如，GPT、BERT等
    training_data = Column(String)  # 训练数据的描述或路径
    status = Column(String, default="active")  # 状态，如active, inactive
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User")

class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        Index('ix_user_id_created_at', 'user_id', 'created_at'),  # 索引优化
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ai_model_id = Column(Integer, ForeignKey("ai_models.id"))
    created_at = Column(TIMESTAMP, default=datetime.now(timezone.utc))
    updated_at = Column(TIMESTAMP, default=datetime.now(timezone.utc))
    content = Column(String)  # 存储对话内容的摘要或完整记录
    user = relationship("User")
    ai_model = relationship("AIModel")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    document_histories = relationship("DocumentHistory", secondary="document_tags")

class DocumentTags(Base):
    __tablename__ = "document_tags"
    __table_args__ = (
        Index('ix_document_id_tag_id', 'document_id', 'tag_id'),  # 索引优化
    )
    document_id = Column(Integer, ForeignKey("document_history.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)

class APILog(Base):
    __tablename__ = "api_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    endpoint = Column(String)
    request_params = Column(String)
    response = Column(String)
    created_at = Column(TIMESTAMP, default=datetime.now(timezone.utc))
    user = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    read = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.now(timezone.utc))
    user = relationship("User")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    role = Column(String)
    content = Column(String)
    created_at = Column(TIMESTAMP, default=datetime.now(timezone.utc))
    conversation = relationship("Conversation", back_populates="messages")
