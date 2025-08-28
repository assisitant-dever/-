from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    documents = relationship("DocumentHistory", back_populates="user")
    role = Column(String, default="user")  # admin, user, ai

class DocumentHistory(Base):
    __tablename__ = "document_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    doc_type = Column(String)
    content = Column(String)
    filename = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="documents")

class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    original_name = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")

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
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ai_model_id = Column(Integer, ForeignKey("ai_models.id"))
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime)
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
    document_id = Column(Integer, ForeignKey("document_history.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)

class APILog(Base):
    __tablename__ = "api_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    endpoint = Column(String)
    request_params = Column(String)
    response = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")

