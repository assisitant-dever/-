import time
from abc import ABC, abstractmethod
from cryptography.fernet import Fernet

import hashlib
import hmac
from typing import Iterator, Optional
from openai import OpenAI, APIError, APITimeoutError
def encrypt_api_key(api_key: str) -> str:
    """加密 API Key"""
    if not isinstance(api_key, str):
        api_key = str(api_key)
    encrypted = fernet.encrypt(api_key.encode())
    return encrypted.decode()  # 返回字符串，便于存储

def decrypt_api_key(encrypted_api_key: str) -> str:
    """解密 API Key"""
    if not encrypted_api_key:
        return ""
    decrypted = fernet.decrypt(encrypted_api_key.encode())
    return decrypted.decode()
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

class ErnieClient(BaseAIClient):
    def _get_default_model(self) -> str:
        """文心一言默认模型：ernie-bot-4（旗舰版）"""
        return "ernie-bot-4"
    def __init__(self, api_key, base_url = None, model = None):
        super().__init__(api_key, base_url, model)
    def _initialize_client(self):
        """初始化文心一言客户端（基于OpenAI兼容接口）"""
        try:
            # 文心一言兼容接口地址（根据官方文档）
            default_base_url = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro"
            
            # 处理AK/SK认证（如果提供了secret_key）
            api_key = self.api_key
            if hasattr(self, 'secret_key') and self.secret_key:
                api_key = self._generate_auth_token()
                
            return OpenAI(
                api_key=api_key,
                base_url=self.base_url or default_base_url,
                timeout=30.0  # 添加超时设置
            )
        except ImportError:
            raise ImportError("请安装OpenAI SDK: pip install openai")

    def _generate_auth_token(self) -> str:
        """生成百度API认证Token（当使用AK/SK时）"""
        # 参考文档：https://cloud.baidu.com/doc/QIANFAN/s/Slkkydake
        timestamp = str(int(time.time()))
        sign_str = self.api_key + timestamp
        signature = hmac.new(
            self.secret_key.encode('utf-8'),
            sign_str.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"{self.api_key}:{timestamp}:{signature}"

    def generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.", 
                 temperature: float = 0.7, top_p: float = 0.95) -> str:
        """全量生成（文心一言兼容接口）"""
        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                top_p=top_p,
                # 增加文心一言特有的参数
                penalty_score=1.0,
                request_timeout=60
            )
            
            # 检查返回结果是否有效
            if not completion.choices or not completion.choices[0].message:
                raise ValueError("文心一言返回空结果")
                
            return completion.choices[0].message.content
        
        except APIError as e:
            # 处理API错误
            error_msg = f"文心一言API错误: {str(e)}"
            if e.status_code == 401:
                error_msg += "，可能是API密钥无效或认证失败"
            elif e.status_code == 429:
                error_msg += "，请求频率超限，请稍后再试"
            raise Exception(error_msg) from e
        except APITimeoutError:
            raise Exception("文心一言API请求超时") from None

    def stream_generate(self, prompt: str, system_prompt: str = "You are a helpful assistant.",
                        temperature: float = 0.7, top_p: float = 0.95) -> Iterator[str]:
        """流式生成（文心一言兼容接口）"""
        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                top_p=top_p,
                penalty_score=1.0,
                stream=True  # 开启流式
            )
            
            for chunk in stream:
                # 检查chunk的有效性
                if not chunk.choices:
                    continue
                    
                content = chunk.choices[0].delta.content
                if content and len(content.strip()) > 0:  # 过滤空片段
                    yield content
                    
        except APIError as e:
            error_msg = f"文心一言API流式错误: {str(e)}"
            raise Exception(error_msg) from e
        except APITimeoutError:
            raise Exception("文心一言API流式请求超时") from None

    def set_model(self, model: str) -> None:
        """设置模型，增加模型校验"""
        valid_models = [
            "ernie-bot", "ernie-bot-turbo", "ernie-bot-4",
            "ernie-speed", "ernie-lite"
        ]
        if model not in valid_models and not model.startswith("ernie-"):
            raise ValueError(f"不支持的文心一言模型: {model}，请使用官方支持的模型名称")
        self.model = model

def main():
    # 初始化客户端
    # 方式1: 使用API Key (如果已经通过平台获取了access_token)
    # client = ErnieClient(api_key="你的API_KEY")
    
    # 方式2: 使用AK/SK (推荐，自动生成token)
    client = ErnieClient(
        api_key="bce-v3/ALTAK-k80nyfTEn1ObgfUbsAphF/b8a17c6fd71e75d68c24c24696cdf7ad515738ad",    # 百度智能云控制台获取的API Key
        secret_key="474927614630406fb8b483c54de1588b"  # 百度智能云控制台获取的Secret Key
    )
    
    # 可选：更改模型（默认是ernie-bot-4）
    try:
        client.set_model("ernie-bot-turbo")  # 切换到轻量版模型
        print(f"已设置模型: {client.model}")
    except ValueError as e:
        print(f"设置模型失败: {e}")
        return
    
    # 测试全量生成
    try:
        print("\n===== 测试全量生成 =====")
        prompt = "请简要介绍一下文心一言的主要特点"
        result = client.generate(
            prompt=prompt,
            system_prompt="你是一位AI助手，擅长简明扼要地回答问题",
            temperature=0.5
        )
        print(f"问题: {prompt}")
        print(f"回答: {result}")
    except Exception as e:
        print(f"全量生成出错: {e}")
    
    # 等待一会儿，避免请求过于频繁
    time.sleep(2)
    
    # 测试流式生成
    try:
        print("\n===== 测试流式生成 =====")
        prompt = "请用3个要点说明人工智能的发展趋势"
        print(f"问题: {prompt}")
        print("回答: ", end="", flush=True)
        
        # 流式接收并打印结果
        for chunk in client.stream_generate(
            prompt=prompt,
            temperature=0.8,
            top_p=0.9
        ):
            print(chunk, end="", flush=True)
        print()  # 换行
    except Exception as e:
        print(f"\n流式生成出错: {e}")

if __name__ == "__main__":
    main()
