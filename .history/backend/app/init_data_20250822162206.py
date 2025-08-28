# init_data.py
import json
import os

DATA_FILE = "data.json"

def init_data():
    if os.path.exists(DATA_FILE):
        print(f"{DATA_FILE} 已存在，跳过初始化")
        return

    initial_data = [
        {
            "id": 1,
            "title": "我的第一个会话",
            "messages": [
                {
                    "id": 1755792000000,
                    "role": "assistant",
                    "content": "欢迎使用 AI 公文助手，请输入您的需求。",
                    "created_at": "2025-08-22 10:00:00"
                }
            ]
        }
    ]

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(initial_data, f, ensure_ascii=False, indent=2)

    print(f"{DATA_FILE} 初始化完成")

if __name__ == "__main__":
    init_data()