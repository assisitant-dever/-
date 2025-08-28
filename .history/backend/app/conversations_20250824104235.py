from fastapi import APIRouter, HTTPException, Form,Depends
import os, json, time
from typing import Optional
from .auth import get_current_user
from .database import get_db
from .models import Conversation,Message
from datetime import datetime,timezone
from sqlalchemy.orm import Session  
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
async def get_conversation(conv_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id  # 权限校验
    ).first()
    if not conv:
        raise HTTPException(404, "对话不存在")
    return conv

# 🔹 新建对话
@router.post("/conversations")
async def new_conversation(title: str = Form("新对话"), db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    conv = Conversation(title=title, user_id=current_user.id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv

# 🔹 获取单个对话
@router.get("/conversations/{conv_id}", response_model=ConversationResponse)
async def get_conversation(conv_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # 获取对话并检查权限
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id  # 权限校验
    ).first()
    if not conversation:
        raise HTTPException(404, "对话不存在")
    
    # 返回对话内容（包括消息）
    return conversation

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
    docx_file: str = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. 校验对话是否存在 & 是否属于当前用户
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conversation:
        raise HTTPException(404, "对话不存在")

    # 2. 创建消息
    message = Message(
        conversation_id=conv_id,
        role=role,
        content=content,
        docx_file=docx_file
    )
    db.add(message)

    # 3. 更新对话的 updated_at
    conversation.updated_at = datetime.now(timezone.utc)
    # 4. 提交事务
    db.commit()
    db.refresh(message)
    return message
# 🔹 往对话里追加一条消息（核心逻辑函数）
def _add_message_to_conversation(data: list, conv_id: int, role: str, content: str, docx_file: str = None):
    """
    内部函数：向指定会话添加消息
    """
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
            conv["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")  # 更新会话时间
            return msg
    return None

# 🔹 往对话里追加一条消息（API 接口）
@router.post("/conversations/{conv_id}/messages")
async def add_message(
    conv_id: int,
    role: str = Form(...),
    content: str = Form(...),
    docx_file: Optional[str] = Form(None),
    current_user = Depends(get_current_user),
):
    data = load_data()
    msg = _add_message_to_conversation(data, conv_id, role, content, docx_file)
    if msg:
        save_data(data)
        return msg
    raise HTTPException(status_code=404, detail="对话不存在")