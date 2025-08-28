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
