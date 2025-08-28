# app/database.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# 加载环境变量
load_dotenv()

# 从环境变量获取数据库连接URL
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://username:password@localhost/dbname")
ASYNC_DATABASE_URL = os.getenv("ASYNC_DATABASE_URL")

# 创建数据库引擎，配置连接池
engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # 连接池大小
    max_overflow=20,       # 最大溢出连接数（超过 pool_size 的连接数）
    pool_timeout=30,       # 连接池中获取连接的最大等待时间（秒）
    pool_recycle=3600,     # 连接池中连接的最大生命周期（秒）
    echo=True              # 输出所有的 SQL 语句到控制台，调试用
)
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,  # 生产环境设为 False，开发环境可设为 True 查看 SQL 日志
    poolclass=NullPool,  # 无连接池（适合服务器less环境）
)
# 创建 SessionLocal 类，用于获取数据库会话
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 声明基本的模型类
Base = declarative_base()

def get_db() -> Session:
    """创建一个数据库会话，用于与数据库交互"""
    db = SessionLocal()
    try:
        yield db  # 返回会话对象
    except Exception as e:
        db.rollback()  # 回滚事务
        raise e  # 抛出异常
    finally:
        db.close()  # 关闭会话
