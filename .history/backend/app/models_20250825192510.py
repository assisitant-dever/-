# models.py
from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, Index, Boolean, Text
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import pytz
from pydantic import BaseModel, field_validator
from typing import List, Optional 

Base = declarative_base()


# -------------------------- Pydantic 模型调整（优先规范关联逻辑） --------------------------
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
    # 补充：显示当前会话使用的 AI 模型信息（从关联的 AIModel 推导）
    used_model: Optional[str] = None  # 如 "OpenAI - gpt-3.5"

    class Config:
        from_attributes = True

    # 自动填充 used_model（从 AIModel 关联推导）
    @field_validator("used_model", mode="before")
    def fill_used_model(cls, v, values):
        if "ai_model" in values:
            ai_model = values["ai_model"]
            return f"{ai_model.platform.name} - {ai_model.model.name}"
        return v


# 1. 系统级平台响应模型（调整：与 Platform/Model 表字段对齐，补充实用信息）
class PlatformModelResponse(BaseModel):
    platform_id: int  # 补充：系统平台ID（便于前端关联用户配置）
    platform: str     # 平台名称（如 "OpenAI"）
    base_url: Optional[str] = None  # 补充：系统默认 BaseURL（用户配置时可复用）
    is_active: bool   # 补充：平台是否启用（系统级开关）
    models: List[str] # 平台下支持的模型列表（如 ["gpt-3.5", "gpt-4"]）
    model_details: Optional[List[dict]] = None  # 可选：模型详情（如含描述）

    class Config:
        from_attributes = True

    # 验证：确保平台名称非空、模型列表为数组
    @field_validator("platform")
    def platform_not_empty(cls, v):
        if not v.strip():
            raise ValueError("平台名称不能为空")
        return v

    @field_validator("models")
    def models_must_be_list(cls, v):
        if not isinstance(v, list):
            raise ValueError("模型列表必须为数组格式")
        return v


# 2. 系统级模型响应模型（新增：单独返回模型详情，供用户配置时选择）
class SystemModelResponse(BaseModel):
    model_id: int
    name: str          # 模型名称（如 "gpt-3.5"）
    platform_id: int
    platform_name: str # 关联平台名称（如 "OpenAI"）
    description: Optional[str] = None  # 模型描述（如 "适用于轻量对话场景"）
    is_supported: bool # 是否支持当前业务（如公文生成）

    class Config:
        from_attributes = True


# 3. 用户 AI 配置请求模型（调整：用系统模型ID替代字符串，避免冗余）
class AIModelCreate(BaseModel):
    model_id: int     # 关键调整：关联系统 Model 表的 ID（而非手动输入 model_name）
    api_key: str      # 用户提交的明文 API Key
    base_url: Optional[str] = None  # 可选：用户自定义 BaseURL（默认复用 Platform.base_url）

    class Config:
        from_attributes = True

    # 验证：确保模型ID有效（前端需传系统存在的 model_id）
    @field_validator("model_id")
    def model_id_positive(cls, v):
        if v <= 0:
            raise ValueError("模型ID必须为正整数")
        return v


# 4. 用户 AI 配置响应模型（调整：从关联表获取平台/模型名称，避免冗余）
class AIModelResponse(BaseModel):
    id: int
    # 关键调整：不再直接存 platform_name/model_name，从关联表推导
    platform_name: str
    model_name: str
    api_key_mask: str  # 脱敏后的 API Key
    base_url: Optional[str] = None  # 用户配置的 BaseURL（或复用系统默认）
    created_at: datetime

    class Config:
        from_attributes = True

    # 从关联的 Platform/Model 表获取名称（避免冗余存储）
    @field_validator("platform_name", mode="before")
    def get_platform_name(cls, v, values):
        if "platform" in values:
            return values["platform"].name
        return v

    @field_validator("model_name", mode="before")
    def get_model_name(cls, v, values):
        if "model" in values:
            return values["model"].name
        return v

    # API Key 脱敏（保留前4后4，中间用***替代）
    @field_validator("api_key_mask", mode="before")
    def mask_api_key(cls, v, values):
        raw_api_key = values.get("api_key")  # 从 AIModel 表的 api_key 字段获取
        if not raw_api_key:
            return ""
        if len(raw_api_key) <= 8:
            return raw_api_key[:4] + "***"
        return f"{raw_api_key[:4]}***{raw_api_key[-4:]}"


# -------------------------- SQLAlchemy 模型调整（核心：外键关联+解耦） --------------------------
class User(Base):
    __tablename__ = "users"
    username = Column(String(255), unique=True, index=True, nullable=False)
    id = Column(Integer, primary_key=True, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))
    role = Column(String(50), default="user")

    # 关系（无调整，保持与用户配置的关联）
    documents = relationship("DocumentHistory", back_populates="user")
    templates = relationship("Template", back_populates="user")
    ai_models = relationship("AIModel", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    api_logs = relationship("APILog", back_populates="user", cascade="all, delete-orphan")


class DocumentHistory(Base):
    __tablename__ = "document_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doc_type = Column(String(100))
    content = Column(Text)  # 调整：用 Text 替代 String(4000)，支持更长公文内容
    filename = Column(String(255))
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系（无调整）
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
    content = Column(Text)  # 调整：用 Text 替代 String(4000)，支持更长模板
    status = Column(String(50), default="active")

    # 关系（无调整）
    user = relationship("User", back_populates="templates")
    documents = relationship("DocumentHistory", back_populates="template")


# 1. 系统级平台表（调整：补充默认配置，关联系统模型）
class Platform(Base):
    __tablename__ = "platforms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)  # 平台名称（如 "OpenAI"）
    base_url = Column(String(255), nullable=False)  # 补充：系统默认 BaseURL（如 OpenAI 官方地址）
    description = Column(Text, nullable=True)  # 补充：平台描述（如 "OpenAI 通用大模型平台"）
    is_active = Column(Boolean, default=True)  # 补充：系统级开关（是否启用该平台）
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系：一个平台对应多个系统模型（一对多）
    models = relationship("Model", back_populates="platform", cascade="all, delete-orphan")

    # 转换为 PlatformModelResponse 结构（对齐 Pydantic 模型）
    def to_response(self, include_details: bool = False) -> dict:
        base = {
            "platform_id": self.id,
            "platform": self.name,
            "base_url": self.base_url,
            "is_active": self.is_active,
            "models": [model.name for model in self.models]  # 模型名称列表
        }
        # 可选：返回模型详情（如描述、是否支持）
        if include_details:
            base["model_details"] = [
                {
                    "model_id": model.id,
                    "name": model.name,
                    "description": model.description,
                    "is_supported": model.is_supported
                }
                for model in self.models
            ]
        return base


# 2. 系统级模型表（新增：关联平台，记录系统支持的模型）
class Model(Base):
    __tablename__ = "models"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # 模型名称（如 "gpt-3.5-turbo"）
    platform_id = Column(Integer, ForeignKey("platforms.id"), nullable=False)  # 关联系统平台
    description = Column(Text, nullable=True)  # 模型描述（如 "轻量对话模型，适合快速响应"）
    is_supported = Column(Boolean, default=True)  # 是否支持当前业务（如公文生成）
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系：一个模型属于一个平台，关联多个用户配置（AIModel）
    platform = relationship("Platform", back_populates="models")
    user_ai_configs = relationship("AIModel", back_populates="model", cascade="all, delete-orphan")


# 3. 用户 AI 配置表（关键调整：用外键关联系统 Platform/Model，删除冗余字符串）
class AIModel(Base):
    __tablename__ = "ai_models"
    id = Column(Integer, primary_key=True, index=True)
    # 关键调整：用外键关联系统 Model（替代原 platform_name/model_name）
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    api_key = Column(String(255), nullable=False)  # 加密存储的 API Key
    base_url = Column(String(255), nullable=True)  # 用户自定义 BaseURL（默认复用 Platform.base_url）
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))
    updated_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC), onupdate=lambda: datetime.now(pytz.UTC))

    # 关系：关联用户、系统模型（间接关联系统平台）
    user = relationship("User", back_populates="ai_models")
    model = relationship("Model", back_populates="user_ai_configs")
    # 间接关联平台（通过 Model → Platform）
    @property
    def platform(self):
        return self.model.platform

    # 新增：获取系统平台默认 BaseURL（用户未自定义时复用）
    @property
    def effective_base_url(self):
        return self.base_url or self.platform.base_url


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        Index('ix_user_id_created_at', 'user_id', 'created_at'),
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ai_model_id = Column(Integer, ForeignKey("ai_models.id"), nullable=False)  # 关联用户 AI 配置
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))
    updated_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC), onupdate=lambda: datetime.now(pytz.UTC))
    title = Column(String(100))  # 调整：加长标题长度（原 50 可能不够）
    status = Column(String(20), default="active")

    # 关系：关联用户、用户 AI 配置、消息
    user = relationship("User", back_populates="conversations")
    ai_model = relationship("AIModel")  # 关联用户当前使用的 AI 配置
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)

    # 关系（无调整）
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
    request_params = Column(Text)  # 调整：用 Text 替代 String(1000)，支持更长参数
    response = Column(Text)  # 调整：用 Text 替代 String(1000)，支持更长响应
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系（无调整）
    user = relationship("User", back_populates="api_logs")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String(500))
    read = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系（无调整）
    user = relationship("User", back_populates="notifications")


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text)  # 调整：用 Text 替代 String(2000)，支持更长消息
    docx_file = Column(String(255), nullable=True)  # 补充：关联生成的 DOCX 文件（原在 Conversation 中分散存储）
    created_at = Column(TIMESTAMP, default=lambda: datetime.now(pytz.UTC))

    # 关系（无调整）
    conversation = relationship("Conversation", back_populates="messages")