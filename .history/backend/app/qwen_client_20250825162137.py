import os
from abc import ABC, abstractmethod
from dotenv import load_dotenv
from .encryption import decrypt_api_key

# 加载环境变量
load_dotenv()

# 基础AI客户端抽象类
class BaseAIClient(ABC):
    @abstractmethod
    def __init__(self, api_key: str, base_url: str = None, model: str = None):
        # 统一解密API Key
        self.api_key = decrypt_api_key(api_key)
        self.base_url = base_url
        self.model = model or self._get_default_model()
        self.client = self._initialize_client()

    @abstractmethod
    def _get_default_model(self) -> str:
        """返回平台默认模型"""
        pass

    @abstractmethod
    def _initialize_client(self):
        """初始化平台客户端"""
        pass

    @abstractmethod
    def generate(self, prompt: str, system_prompt: str = None) -> str:
        """生成文本的统一接口"""
        pass


# OpenAI客户端实现
class OpenAIClient(BaseAIClient):
    def _get_default_model(self) -> str:
        return "gpt-3.5-turbo"

    def _initialize_client(self):
        try:
            from openai import OpenAI
            return OpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
        except ImportError:
            raise ImportError("请安装OpenAI SDK: pip install openai")

    def generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
        )
        return completion.choices[0].message.content


# 通义千问客户端实现
class QwenClient(BaseAIClient):
    def _get_default_model(self) -> str:
        return "qwen-plus"

    def _initialize_client(self):
        try:
            from openai import OpenAI
            return OpenAI(
                api_key=self.api_key,
                base_url=self.base_url or "https://dashscope.aliyuncs.com/compatible-mode/v1"
            )
        except ImportError:
            raise ImportError("请安装OpenAI SDK: pip install openai")

    def generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
        )
        return completion.choices[0].message.content


# Anthropic客户端实现
class AnthropicClient(BaseAIClient):
    def _get_default_model(self) -> str:
        return "claude-3-haiku-20240307"

    def _initialize_client(self):
        try:
            from anthropic import Anthropic
            return Anthropic(api_key=self.api_key)
        except ImportError:
            raise ImportError("请安装Anthropic SDK: pip install anthropic")

    def generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ],
            system=system_prompt
        )
        return message.content[0].text


# Gemini客户端实现
class GeminiClient(BaseAIClient):
    def _get_default_model(self) -> str:
        return "gemini-pro"

    def _initialize_client(self):
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            return genai.GenerativeModel(self.model)
        except ImportError:
            raise ImportError("请安装Google Generative AI SDK: pip install google-generativeai")

    def generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        # Gemini将system prompt和user prompt合并处理
        full_prompt = f"{system_prompt}\n\n{prompt}"
        response = self.client.generate_content(full_prompt)
        return response.text


# AI客户端工厂类
class AIClientFactory:
    SUPPORTED_PROVIDERS = {
        "openai": OpenAIClient,
        "qwen": QwenClient,
        "anthropic": AnthropicClient,
        "gemini": GeminiClient
    }

    @classmethod
    def get_supported_providers(cls) -> list:
        """返回支持的平台列表"""
        return list(cls.SUPPORTED_PROVIDERS.keys())

    @classmethod
    def create_client(cls, provider: str, api_key: str, base_url: str = None, model: str = None):
        """创建指定平台的客户端实例"""
        provider = provider.lower()
        if provider not in cls.SUPPORTED_PROVIDERS:
            raise ValueError(f"不支持的平台: {provider}，支持的平台: {cls.get_supported_providers()}")
        
        client_class = cls.SUPPORTED_PROVIDERS[provider]
        try:
            return client_class(api_key=api_key, base_url=base_url, model=model)
        except Exception as e:
            raise RuntimeError(f"初始化{provider}客户端失败: {str(e)}") from e


# 基于环境变量的默认生成函数（向后兼容）
def generate_text(prompt: str) -> str:
    """使用环境变量配置的默认Qwen模型生成文本"""
    qwen_api_key = os.getenv("QWEN_API_KEY")
    qwen_api_url = os.getenv("QWEN_API_URL")
    qwen_model = os.getenv("QWEN_MODEL") or "qwen-plus"

    if not qwen_api_key or not qwen_api_url:
        raise ValueError("请在.env配置QWEN_API_URL和QWEN_API_KEY")

    try:
        client = QwenClient(
            api_key=qwen_api_key,
            base_url=qwen_api_url,
            model=qwen_model
        )
        return client.generate(prompt)
    except Exception as e:
        raise RuntimeError(f"生成文本失败: {str(e)}") from e


# 用户级生成函数
def generate_text_for_user(user_id: int, prompt: str, system_prompt: str = None) -> str:
    """根据用户配置生成文本"""
    # 从数据库获取用户配置（需要实现此函数）
    # 注意：这里假设get_user_model_preference返回的api_key是加密的
    user_config = get_user_model_preference(user_id)
    
    if not user_config:
        raise ValueError("用户未设置AI模型偏好")

    try:
        # 创建客户端（会自动解密API Key）
        client = AIClientFactory.create_client(
            provider=user_config["provider"],
            api_key=user_config["api_key"],  # 传入加密的API Key
            base_url=user_config.get("base_url"),
            model=user_config.get("model_name")
        )
        
        # 生成文本
        return client.generate(
            prompt=prompt,
            system_prompt=system_prompt or "You are a helpful assistant."
        )
    except Exception as e:
        raise RuntimeError(f"生成文本失败: {str(e)}") from e


from sqlalchemy.orm import Session
from .models import AIModel  # 从你的数据库模型文件导入AIModel
from typing import Optional, Dict

def get_user_model_preference(user_id: int, db: Session) -> Optional[Dict]:
    """
    从数据库获取用户的AI模型偏好配置（优先取用户最新添加的有效配置）
    
    参数:
        user_id: 用户ID（关联users表的id字段）
        db: SQLAlchemy数据库会话（确保与业务逻辑的会话一致）
    
    返回:
        字典格式的用户模型配置，包含加密的API Key；无配置时返回None
        返回示例:
        {
            "provider": "openai",          # 平台名称（对应AIModel的platform_name）
            "api_key": "gAAAAABk...",       # 加密后的API Key（直接从AIModel.api_key获取）
            "model_name": "gpt-4",          # 模型名称（对应AIModel的model_name）
            "base_url": None                # 自定义BaseURL（当前数据库无该字段，默认None）
        }
    """
    # 1. 查询用户的所有AI模型配置，按创建时间倒序（优先取最新添加的配置）
    # 关联条件：AIModel.user_id = user_id（确保只获取当前用户的配置）
    user_ai_model = db.query(AIModel).filter(
        AIModel.user_id == user_id
    ).order_by(
        AIModel.created_at.desc()  # 最新添加的配置排在最前
    ).first()  # 取第一条（最新）配置作为用户默认偏好
    
    # 2. 无配置时返回None（上层逻辑需处理“用户未设置模型”的场景）
    if not user_ai_model:
        return None
    
    # 3. 格式化返回结构（与多平台客户端的入参需求对齐）
    return {
        "provider": user_ai_model.platform_name,  # 平台名（如"openai""qwen"）
        "api_key": user_ai_model.api_key,         # 加密的API Key（无需解密，客户端会自动处理）
        "model_name": user_ai_model.model_name,   # 模型名（如"gpt-4""qwen-plus"）
        "base_url": None                          # 注：当前AIModel表无base_url字段，默认None
                                                 # 若后续需支持自定义BaseURL，需在AIModel表新增base_url字段
    }
