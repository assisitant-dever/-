# encryption.py
from cryptography.fernet import Fernet
import os
from dotenv import load_dotenv

load_dotenv()

# 从环境变量读取加密密钥
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if not ENCRYPTION_KEY:
    raise ValueError("请在 .env 中设置 ENCRYPTION_KEY")

# Fernet 要求是 bytes 类型
try:
    fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except Exception as e:
    raise ValueError(f"无效的加密密钥: {e}")

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