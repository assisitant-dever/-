from fastapi import APIRouter, HTTPException, Form
import os, json, time
from typing import Optional

router = APIRouter()

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "conversations.json")

if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump([], f, ensure_ascii=False, indent=2)

def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# 🔹 获取全部对话
@router.get("/conversations")
async def get_conversations():
    return load_data()

# 🔹 新建对话
@router.post("/conversations")
async def new_conversation(title: str = "新对话"):
    data = load_data()
    conv = {
        "id": int(time.time() * 1000),
        "title": title,
        "messages": [],
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    data.append(conv)
    save_data(data)
    return conv

# 🔹 获取单个对话
@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: int):
    data = load_data()
    for conv in data:
        if conv["id"] == conv_id:
            return conv
    raise HTTPException(status_code=404, detail="对话不存在")

# 🔹 更新对话（改标题）
@router.put("/conversations/{conv_id}")
async def update_conversation(conv_id: int, payload: dict):
    data = load_data()
    for conv in data:
        if conv["id"] == conv_id:
            conv.update(payload)
            save_data(data)
            return conv
    raise HTTPException(status_code=404, detail="对话不存在")

# 🔹 删除对话
@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: int):
    data = load_data()
    new_data = [c for c in data if c["id"] != conv_id]
    if len(new_data) == len(data):
        raise HTTPException(status_code=404, detail="对话不存在")
    save_data(new_data)
    return {"message": "删除成功"}

# 🔹 往对话里追加一条消息
@router.post("/conversations/{conv_id}/messages")
async def add_message(
    conv_id: int,
    role: str = Form(...),
    content: str = Form(...),
    docx_file: Optional[str] = Form(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    role: "user" | "assistant"
    content: 消息内容
    docx_file: 可选，AI生成的docx文件名
    """
    data = load_data()
    for conv in data:
        if conv["id"] == conv_id:
            msg = {
                "id": int(time.time() * 1000),
                "role": role,
                "content": content,
                "docx_file": docx_file,
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            conv["messages"].append(msg)
            save_data(data)
            return msg
    raise HTTPException(status_code=404, detail="对话不存在")
