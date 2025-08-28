from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import router as api_router
from .conversations import router as conv_router
from .auth import router as auth_router  # 新加

app = FastAPI()

# CORS 设置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发阶段允许所有
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册
app.include_router(auth_router, prefix="/auth")           # 用户注册/登录
app.include_router(api_router, prefix="/api")            # 公文生成等通用接口
app.include_router(conv_router, prefix="/api/conversations")  # 对话功能接口
