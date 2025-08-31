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
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            stream=True,
            stream_options={"include_usage": True}
        )
        
        for chunk_idx, chunk in enumerate(stream):
            content = ""  # 初始化，避免未定义
            print(f"[Qwen 流式片段 {chunk_idx}] 存在choices: {bool(chunk.choices)}")
            
            if not chunk.choices or len(chunk.choices) == 0:
                continue
            
            choice = chunk.choices[0]
            if choice.finish_reason is not None:
                print(f"[Qwen 流式结束] finish_reason: {choice.finish_reason}")
                break
            
            if choice.delta and choice.delta.content is not None:
                content = choice.delta.content.strip()
                # ✅ 新增：过滤长度为0的空片段
                if len(content) == 0:
                    print(f"[Qwen 过滤空片段] 片段 {chunk_idx} 内容为空，跳过")
                    continue
                
                print(f"[Qwen 有效片段 {chunk_idx}] 内容: {content}")
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
class ErnieClient(BaseAIClient):
    def _get_default_model(self) -> str:
        """文心一言默认模型：ernie-bot-4（旗舰版）"""
        return "ernie-bot-4"  # 对应原生接口的模型名

    def _initialize_client(self):
        """初始化文心一言客户端（基于百度原生API，使用requests）"""
        try:
            import requests
            return requests.Session()  # 复用连接，提升性能
        except ImportError:
            raise ImportError("请安装requests: pip install requests")

    def generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        """全量生成（百度原生API）"""
        # 原生接口地址（从百度云示例复制，注意模型对应的后缀）
        # 例如：ernie-bot-4对应/completions_pro，基础版对应/ernie_bot
        base_url = self.base_url or "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro"
        
        # 原生接口需要在URL中携带API Key和Secret Key（从百度云获取）
        # 注意：这里的api_key和secret_key是百度云控制台的"API Key"和"Secret Key"
        if not self.api_key:
            raise ValueError("文心一言需要API Key（格式：'API_KEY,SECRET_KEY'）")
        api_key, secret_key = self.api_key.split(',', 1)  # 从api_key字段拆分
        url = f"{base_url}?api_key={api_key}&secret_key={secret_key}"

        # 原生接口的请求体格式（参考百度云示例）
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "top_p": 0.95,
            "penalty_score": 1.0,
            "disable_search": False,  # 是否禁用搜索增强（部分模型支持）
            "response_format": {"type": "text"}
        }

        headers = {"Content-Type": "application/json"}
        response = self.client.post(url, headers=headers, json=payload)
        response.raise_for_status()  # 抛出HTTP错误
        result = response.json()
        
        # 原生接口的响应格式解析（参考百度云示例的返回结构）
        if "error_code" in result:
            raise RuntimeError(f"文心一言API错误: {result['error_msg']} (错误码: {result['error_code']})")
        return result.get("result", "")  # 原生接口的文本结果在"result"字段

    def stream_generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> Iterator[str]:
        """流式生成（百度原生API，基于SSE）"""
        base_url = self.base_url or "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro"
        
        if not self.api_key:
            raise ValueError("文心一言需要API Key（格式：'API_KEY,SECRET_KEY'）")
        api_key, secret_key = self.api_key.split(',', 1)
        url = f"{base_url}?api_key={api_key}&secret_key={secret_key}"

        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "stream": True  # 开启流式
        }

        headers = {"Content-Type": "application/json"}
        with self.client.post(url, headers=headers, json=payload, stream=True) as response:
            response.raise_for_status()
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                # 百度原生SSE格式：data: {"id":"...","result":"...","is_end":false}
                line = line.lstrip("data: ").strip()
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                    if "error_code" in chunk:
                        raise RuntimeError(f"流式错误: {chunk['error_msg']}")
                    # 流式片段在"result"字段，is_end标记结束
                    if chunk.get("result"):
                        yield chunk["result"]
                    if chunk.get("is_end", False):
                        break
                except json.JSONDecodeError:
                    continue


class SparkClient(BaseAIClient):
    def _get_default_model(self) -> str:
        """讯飞星火默认模型：spark-4.0（旗舰版）"""
        return "spark-4.0"

    def _initialize_client(self):
        """初始化讯飞星火客户端（原生API）"""
        try:
            import requests  # 讯飞星火无官方SDK，使用requests调用
            return requests.Session()  # 返回会话对象复用连接
        except ImportError:
            raise ImportError("请安装requests: pip install requests")

    def generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        """全量生成（讯飞星火原生API）"""
        # 讯飞星火API要求：base_url需包含版本路径（如/v3.1/chat/completions）
        if not self.base_url:
            raise ValueError("讯飞星火客户端必须配置base_url（如：https://spark-api.xf-yun.com/v3.1/chat/completions）")
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 2048,  # 讯飞星火默认最大 tokens
            "temperature": 0.7
        }

        response = self.client.post(self.base_url, headers=headers, json=payload)
        response.raise_for_status()  # 抛出HTTP错误
        result = response.json()
        return result["choices"][0]["message"]["content"]

    def stream_generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> Iterator[str]:
        """流式生成（讯飞星火原生API，基于SSE）"""
        if not self.base_url:
            raise ValueError("讯飞星火客户端必须配置base_url（如：https://spark-api.xf-yun.com/v3.1/chat/completions）")
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 2048,
            "temperature": 0.7,
            "stream": True
        }

        # 流式请求（SSE格式，需解析分块数据）
        with self.client.post(
            self.base_url, headers=headers, json=payload, stream=True
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                # 讯飞星火SSE格式：data: {"id":"...","choices":[...]}
                line = line.lstrip("data: ").strip()
                if line == "[DONE]":  # 流式结束标记
                    break
                try:
                    import json
                    chunk_data = json.loads(line)
                    content = chunk_data["choices"][0]["delta"].get("content")
                    if content and len(content.strip()) > 0:
                        yield content
                except json.JSONDecodeError:
                    continue

class GLMClient(BaseAIClient):
    def _get_default_model(self) -> str:
        """GLM默认模型：glm-4（旗舰版）"""
        return "glm-4"

    def _initialize_client(self):
        """初始化GLM客户端（基于OpenAI兼容接口）"""
        try:
            from openai import OpenAI
            # 智谱兼容接口默认地址：https://open.bigmodel.cn/api/paas/v4/chat/completions
            default_base_url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
            return OpenAI(
                api_key=self.api_key,
                base_url=self.base_url or default_base_url
            )
        except ImportError:
            raise ImportError("请安装OpenAI SDK: pip install openai")

    def generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        """全量生成（GLM兼容接口）"""
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2048
        )
        return completion.choices[0].message.content

    def stream_generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> Iterator[str]:
        """流式生成（GLM兼容接口）"""
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2048,
            stream=True
        )
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content and len(content.strip()) > 0:
                yield content

class LLaMAClient(BaseAIClient):
    def _get_default_model(self) -> str:
        """LLaMA 2 默认模型（Hugging Face 模型名）"""
        return "meta-llama/Llama-2-7b-chat-hf"  # 7B对话版（需申请访问权限）

    def _initialize_client(self):
        """初始化LLaMA客户端（基于Hugging Face Inference API）"""
        try:
            from huggingface_hub import InferenceClient
            return InferenceClient(
                model=self.model,
                token=self.api_key  # Hugging Face API Token
            )
        except ImportError:
            raise ImportError("请安装huggingface-hub: pip install huggingface-hub")

    def generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        """全量生成（Hugging Face Inference API）"""
        # LLaMA 2 要求对话格式：<s>[INST] <<SYS>>{system_prompt}<</SYS>> {prompt} [/INST]
        formatted_prompt = f"<s>[INST] <<SYS>>{system_prompt}<</SYS>> {prompt} [/INST]"
        
        response = self.client.text_generation(
            formatted_prompt,
            max_new_tokens=2048,
            temperature=0.7,
            stop_sequences=["</s>"]  # LLaMA 2 结束标记
        )
        # 提取响应（去除 prompt 部分和结束标记）
        return response.replace(formatted_prompt, "").replace("</s>", "").strip()

    def stream_generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> Iterator[str]:
        """流式生成（Hugging Face Inference API）"""
        formatted_prompt = f"<s>[INST] <<SYS>>{system_prompt}<</SYS>> {prompt} [/INST]"
        
        # 流式生成（迭代返回token）
        stream = self.client.text_generation(
            formatted_prompt,
            max_new_tokens=2048,
            temperature=0.7,
            stop_sequences=["</s>"],
            stream=True
        )
        for token in stream:
            if token and not token.endswith("</s>"):  # 过滤结束标记
                yield token
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
        "ernie": ErnieClient,    # 百度文心一言
        "spark": SparkClient,    # 讯飞星火
        "glm": GLMClient,        # 智谱GLM-4
        "llama": LLaMAClient     # Meta LLaMA 2
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
            try:
                # ✅ 捕获stream_generate的异常
                return client.stream_generate(prompt=prompt, system_prompt=system_prompt)
            except Exception as stream_e:
                raise RuntimeError(f"流式生成过程中失败: {str(stream_e)}") from stream_e
        else:
            return client.generate(prompt=prompt,system_prompt=system_prompt)
    except Exception as e:
        # 确保错误信息包含具体原因
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
