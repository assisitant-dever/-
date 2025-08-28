from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict

app = FastAPI()

# 假设有存储对话和消息的字典
conversations: Dict[int, List[Dict]] = {}

class Message(BaseModel):
    content: str

class Conversation(BaseModel):
    title: str

# 获取所有对话
@app.get("/api/conversations")
async def get_conversations():
    return list(conversations.values())

# 获取某个对话的消息
@app.get("/api/conversations/{conv_id}/messages")
async def get_messages(conv_id: int):
    if conv_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversations[conv_id]

# 创建一个新对话
@app.post("/api/conversations")
async def create_conversation(conv: Conversation):
    conv_id = len(conversations) + 1
    conversations[conv_id] = []  # 新对话，初始没有消息
    return {"id": conv_id, "title": conv.title}

# 发送消息到某个对话
@app.post("/api/conversations/{conv_id}/messages")
async def send_message(conv_id: int, message: Message):
    if conv_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversations[conv_id].append(message.dict())  # 添加新消息到对话中
    return {"message": "Message added successfully", "data": message.content}
