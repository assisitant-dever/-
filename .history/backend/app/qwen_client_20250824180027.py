import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()  # 读取 .env

QWEN_API_URL = os.getenv("QWEN_API_URL")
QWEN_API_KEY = os.getenv("QWEN_API_KEY")
QWEN_MODEL = os.getenv("QWEN_MODEL") or "qwen-plus"

if not QWEN_API_URL or not QWEN_API_KEY:
    raise ValueError("请在 .env 配置 QWEN_API_URL 和 QWEN_API_KEY")

client = OpenAI(api_key=QWEN_API_KEY, base_url=QWEN_API_URL)

def generate_text(prompt: str) -> str:
    completion = client.chat.completions.create(
        model=QWEN_MODEL,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    return completion.choices[0].message.content
from openai import OpenAI
# 其他平台的 SDK（如 anthropic、google-generativeai）也需要安装
import os

# 支持的平台列表
SUPPORTED_PROVIDERS = {
    "openai",
    "qwen",
    "anthropic",
    "gemini",
    "llama",  # 如通过 Groq 或 Replicate
}

def get_ai_client(provider: str, api_key: str, base_url: str = None, model: str = None):
    """
    根据 provider 动态返回 client 和实际 model 名
    """
    if provider == "openai":
        client = OpenAI(api_key=api_key)
        model = model or "gpt-3.5-turbo"
        return client, model

    elif provider == "qwen":
        # 阿里云通义千问兼容 OpenAI 接口
        client = OpenAI(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"  # 兼容模式
        )
        model = model or "qwen-plus"
        return client, model

    elif provider == "anthropic":
        # 示例（需安装 anthropic）
        from anthropic import Anthropic
        client = Anthropic(api_key=api_key)
        model = model or "claude-3-haiku-20240307"
        return client, model

    elif provider == "gemini":
        # Gemini 使用 google-generativeai
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model_name = model or "gemini-pro"
        model = genai.GenerativeModel(model_name)
        return model, None  # Gemini 不用 client 模式，直接返回 model

    else:
        raise ValueError(f"不支持的平台: {provider}")
def generate_text_for_user(user_id: int, prompt: str) -> str:
    # 从数据库获取用户配置
    user_config = get_user_model_preference(user_id)  # 自定义函数

    if not user_config:
        raise ValueError("未设置 AI 模型偏好")

    provider = user_config["provider"]
    api_key = user_config["api_key"]
    base_url = user_config.get("base_url")
    model_name = user_config.get("model_name")

    # 获取客户端和模型
    client, resolved_model = get_ai_client(provider, api_key, base_url, model_name)

    try:
        if provider == "openai" or provider == "qwen":
            completion = client.chat.completions.create(
                model=resolved_model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
            )
            return completion.choices[0].message.content

        elif provider == "anthropic":
            message = client.messages.create(
                model=resolved_model,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text

        elif provider == "gemini":
            response = client.generate_content(prompt)
            return response.text

        else:
            raise ValueError(f"未知平台: {provider}")

    except Exception as e:
        # 记录错误，可 fallback 到默认模型
        print(f"调用 {provider} 失败: {e}")
        raise