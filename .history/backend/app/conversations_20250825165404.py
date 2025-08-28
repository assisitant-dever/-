from fastapi import APIRouter, HTTPException, Form, Depends
from typing import Optional, List
from .auth import get_current_user
from .database import get_db
from .models import Conversation, Message, ConversationResponse, MessageResponse, AIModel  # 新增AIModel导入
from datetime import datetime, timezone
from sqlalchemy.orm import Session  

router = APIRouter()


# 🔹 获取全部对话（按更新时间倒序，附带最后一条消息+模型信息）
@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    conversations = db.query(Conversation).filter(
        Conversation.user_id == current_user.id
    ).order_by(Conversation.updated_at.desc()).all()
    
    if not conversations:
        return []
    
    result = []
    for conv in conversations:
        # 查最后一条消息（预览用）
        last_message = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.created_at.desc()).first()
        
        # 查关联的模型信息
        ai_model_info = None
        if conv.ai_model_id:
            ai_model = db.query(AIModel).filter(AIModel.id == conv.ai_model_id).first()
            if ai_model:
                ai_model_info = {
                    "platform": ai_model.platform_name,
                    "model_name": ai_model.model_name
                }
        
        result.append({
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "ai_model_info": ai_model_info,
            "last_message": last_message.content[:20] + "..." if last_message else None,
            "messages": []
        })
    
    return result


# 🔹 新建对话（支持指定AI模型）
@router.post("/conversations")
async def new_conversation(
    title: str = Form("新对话"),
    ai_model_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 校验模型归属（若指定）
    ai_model = None
    if ai_model_id:
        ai_model = db.query(AIModel).filter(
            AIModel.id == ai_model_id,
            AIModel.user_id == current_user.id
        ).first()
        if not ai_model:
            raise HTTPException(status_code=404, detail="指定的AI模型不存在或无权访问")
    
    # 创建会话
    conv = Conversation(
        title=title,
        user_id=current_user.id,
        ai_model_id=ai_model_id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    
    return {
        "id": conv.id,
        "title": conv.title,
        "ai_model_id": conv.ai_model_id,
        "ai_model_info": ai_model.model_name if ai_model else None,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at
    }


# 🔹 获取单个对话（附带消息列表+模型信息）
@router.get("/conversations/{conv_id}", response_model=ConversationResponse)
async def get_conversation(
    conv_id: int, 
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conversation:
        raise HTTPException(404, "对话不存在")
    
    # 查关联的消息（按时间正序）
    messages = db.query(Message).filter(
        Message.conversation_id == conv_id
    ).order_by(Message.created_at.asc()).all()
    
    # 查关联的模型信息
    ai_model_info = None
    if conversation.ai_model_id:
        ai_model = db.query(AIModel).filter(AIModel.id == conversation.ai_model_id).first()
        if ai_model:
            ai_model_info = {
                "platform": ai_model.platform_name,
                "model_name": ai_model.model_name
            }
    
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "ai_model_info": ai_model_info,
        "messages": messages
    }


# 🔹 更新对话（支持修改标题/关联模型）
@router.put("/conversations/{conv_id}")
async def update_conversation(
    conv_id: int,
    title: Optional[str] = Form(None),
    ai_model_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conversation:
        raise HTTPException(404, "对话不存在")
    
    # 校验并更新模型（若指定）
    ai_model = None
    if ai_model_id:
        ai_model = db.query(AIModel).filter(
            AIModel.id == ai_model_id,
            AIModel.user_id == current_user.id
        ).first()
        if not ai_model:
            raise HTTPException(status_code=404, detail="指定的AI模型不存在或无权访问")
        conversation.ai_model_id = ai_model_id
    
    # 更新标题（若指定）
    if title:
        conversation.title = title
    
    # 更新时间
    conversation.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(conversation)
    
    return {
        "id": conversation.id,
        "title": conversation.title,
        "ai_model_id": conversation.ai_model_id,
        "ai_model_info": ai_model.model_name if ai_model else None,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at
    }


# 🔹 删除对话（级联删除关联消息）
@router.delete("/conversations/{conv_id}")
async def delete_conversation(
    conv_id: int, 
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()

    if not conversation:
        raise HTTPException(404, "对话不存在")
    
    # 级联删除关联的消息（避免数据残留）
    db.query(Message).filter(Message.conversation_id == conv_id).delete()
    db.delete(conversation)
    db.commit()
    
    return {"message": "删除成功"}


# 🔹 往对话里追加消息（支持切换模型）
@router.post("/conversations/{conv_id}/messages")
async def add_message(
    conv_id: int,
    role: str = Form(...),
    content: str = Form(...),
    docx_file: Optional[str] = Form(None),
    ai_model_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 校验会话归属
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conversation:
        raise HTTPException(404, "对话不存在")
    
    # 切换会话模型（若指定）
    if ai_model_id:
        ai_model = db.query(AIModel).filter(
            AIModel.id == ai_model_id,
            AIModel.user_id == current_user.id
        ).first()
        if not ai_model:
            raise HTTPException(status_code=404, detail="指定的AI模型不存在或无权访问")
        conversation.ai_model_id = ai_model_id
    
    # 创建消息
    message = Message(
        conversation_id=conv_id,
        role=role,
        content=content,
        docx_file=docx_file,
        created_at=datetime.now(timezone.utc)
    )
    db.add(message)
    
    # 更新会话时间
    conversation.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(message)
    db.refresh(conversation)
    
    return {
        "message": message,
        "conversation": {
            "id": conversation.id,
            "updated_at": conversation.updated_at,
            "ai_model_id": conversation.ai_model_id
        }
    }