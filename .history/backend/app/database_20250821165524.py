from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# MySQL 连接字符串
# 格式: mysql+pymysql://username:password@host:port/dbname
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:123456@localhost:3306/public_doc"

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


