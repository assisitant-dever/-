# app/crud.py

from sqlalchemy.orm import Session
from app.models import User, DocumentHistory
from app.schemas import UserCreate

def create_user(db: Session, user: UserCreate):
    db_user = User(username=user.username, password_hash=user.password_hash)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# 其他增删改查操作...
