import os
from abc import ABC, abstractmethod
from dotenv import load_dotenv
from .encryption import decrypt_api_key
from .models import AIModel, Conversation 
from sqlalchemy.orm import Session
from typing import Optional, Dict,Iterator,Union
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
    @abstractmethod
    def stream_generate(self, prompt: str, system_prompt: str = None) -> Iterator[str]:
        """生成文本的流式接口（迭代返回片段）"""
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
    def stream_generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> Iterator[str]:
        """流式生成（OpenAI兼容接口）"""
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            stream=True  # 开启流式
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:  # 过滤空内容
                yield content

# 通义千问客户端实现
class QwenClient(BaseAIClient):
    # 实现抽象基类的构造方法
    def __init__(self, api_key: str, base_url: str = None, model: str = None):
        # 调用父类的构造方法，完成基础初始化
        super().__init__(api_key=api_key, base_url=base_url, model=model)

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

    def stream_generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> Iterator[str]:
        """流式生成（通义千问，兼容OpenAI接口）"""
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            stream=True,  # 开启流式
            stream_options={"include_usage": True}  # 确保包含使用统计（可选）
        )
        
        for chunk in stream:
            # 1. 检查是否有choices且不为空
            if not chunk.choices or len(chunk.choices) == 0:
                continue
            
            choice = chunk.choices[0]
            # 2. 检查是否已完成（finish_reason不为None时停止）
            if choice.finish_reason is not None:
                break
            
            # 3. 安全获取delta和content（处理delta为None的情况）
            delta = choice.delta or {}
            content = delta.get("content", "").strip()  # 用get避免KeyError
            
            # 4. 只返回非空内容
            if content:
                yield content



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
    def stream_generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> Iterator[str]:
        """流式生成（Anthropic Claude）"""
        with self.client.messages.stream(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
            system=system_prompt
        ) as stream:
            for event in stream.events:
                if event.type == "content_block_delta":
                    # 提取流式片段
                    yield event.delta.text

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

    def stream_generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> Iterator[str]:
        """流式生成（Google Gemini）"""
        full_prompt = f"{system_prompt}\n\n{prompt}"
        response = self.client.generate_content(full_prompt, stream=True)  # 开启流式
        for chunk in response:
            if chunk.text:  # 过滤空内容
                yield chunk.text
# AI客户端工厂类
class AIClientFactory:
    SUPPORTED_PROVIDERS = {
        "openai": OpenAIClient,
        "qwen": QwenClient,
        "anthropic": AnthropicClient,
        "gemini": GeminiClient,
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
def generate_text_for_user(
    user_id: int, 
    prompt: str, 
    system_prompt: str = None, 
    db: Session = None,
    stream: bool = False  # 新增：是否流式输出
) -> Union[str, Iterator[str]]:
    """根据用户配置生成文本（支持流式/全量）"""
    if db is None:
        raise ValueError("必须提供数据库会话对象(db)")
    
    user_config = get_user_model_preference(user_id, db)
    if not user_config:
        raise ValueError("用户未设置AI模型偏好")

    try:
        client = AIClientFactory.create_client(
            provider=user_config["provider"],
            api_key=user_config["api_key"],
            base_url=user_config.get("base_url"),
            model=user_config.get("model_name")
        )
        
        if stream:
            # 流式生成：返回迭代器
            return client.stream_generate(
                prompt=prompt,
                system_prompt=system_prompt or "You are a helpful assistant."
            )
        else:
            # 全量生成：返回完整文本
            return client.generate(
                prompt=prompt,
                system_prompt=system_prompt or "You are a helpful assistant."
            )
    except Exception as e:
        raise RuntimeError(f"生成文本失败: {str(e)}") from e




def get_user_model_preference(user_id: int, db: Session) -> Optional[Dict]:
    """
    从数据库获取用户的AI模型偏好配置
    """
    # 导入需要的模型（确保已定义Platform模型）
    from .models import Platform,Model  # 新增导入
    
    # 第一步：优先查询用户上次使用的AI模型
    latest_conversation = db.query(Conversation).filter(
        Conversation.user_id == user_id
    ).order_by(
        Conversation.updated_at.desc()
    ).first()
    
    if latest_conversation:
        # 预加载完整关联链：AIModel → Model → Platform
        last_used_ai_model = db.query(AIModel).filter(
            AIModel.id == latest_conversation.ai_model_id,
            AIModel.user_id == user_id
        ).join(
            AIModel.model  # 关联到Model
        ).join(
            Model.platform  # 关联到Platform
        ).first()
        
        if last_used_ai_model:
            return {
                # 通过Platform模型获取名称
                "provider": last_used_ai_model.model.platform.name,
                "api_key": last_used_ai_model.api_key,
                "model_name": last_used_ai_model.model.name,
                "base_url": last_used_ai_model.base_url
            }
    
    # 第二步：若无使用记录，取用户最新添加的AI模型
    latest_added_ai_model = db.query(AIModel).filter(
        AIModel.user_id == user_id
    ).join(
        AIModel.model
    ).join(
        Model.platform
    ).order_by(
        AIModel.created_at.desc()
    ).first()
    
    if not latest_added_ai_model:
        return None
    
    # 第三步：格式化返回
    return {
        # 通过Platform模型获取名称
        "provider": latest_added_ai_model.model.platform.name,
        "api_key": latest_added_ai_model.api_key,
        "model_name": latest_added_ai_model.model.name,
        "base_url": latest_added_ai_model.base_url
    }
    