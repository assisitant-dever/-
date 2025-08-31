# API设计文档

API设计文档是后端与前端、第三方服务交互的"通信协议"，其核心价值在于通过统一规则确保接口的一致性和易用性，降低协作成本并减少对接故障。一份规范的API文档需清晰定义交互标准，涵盖从接口命名到错误处理的全流程细节。

## API概述

设计原则应围绕"简洁性"与"可扩展性"展开：接口命名需直观反映资源属性，适用范围需明确覆盖所有前后端数据交互场景（如用户操作、数据传输、文件处理等）。

### 基础规范

- **基础路径**：所有API接口均以`/api`为前缀
- **数据格式**：请求和响应均使用JSON格式
- **认证方式**：JWT Token（在Authorization头中传递）
- **状态码**：遵循HTTP标准状态码
- **版本控制**：当前为v1版本（路径中未显式标注）

## 接口列表（按功能模块分类）

### 用户认证模块

| 接口路径 | 方法 | 功能描述 | 权限要求 |
|---------|------|---------|---------|
| `/auth/register` | POST | 用户注册 | 公开 |
| `/auth/login` | POST | 用户登录 | 公开 |

### 公文生成模块

| 接口路径 | 方法 | 功能描述 | 权限要求 |
|---------|------|---------|---------|
| `/api/upload-template` | POST | 上传模板文件 | 已认证 |
| `/api/generate` | POST | 生成公文 | 已认证 |
| `/api/download/{filename}` | GET | 下载生成的DOCX文件 | 已认证 |
| `/api/history` | GET | 获取公文历史记录 | 已认证 |
| `/api/templates` | GET | 获取模板列表 | 已认证 |
| `/api/template-content/{template_id}` | GET | 获取模板内容 | 已认证 |

### AI模型配置模块

| 接口路径 | 方法 | 功能描述 | 权限要求 |
|---------|------|---------|---------|
| `/api/keys` | GET | 获取用户AI模型配置列表 | 已认证 |
| `/api/keys` | POST | 创建AI模型配置 | 已认证 |
| `/api/keys/{key_id}` | DELETE | 删除AI模型配置 | 已认证 |
| `/api/keys/{ai_model_id}` | PUT | 更新AI模型配置 | 已认证 |
| `/api/platforms` | GET | 获取系统支持的AI平台及模型 | 已认证 |
| `/api/platforms/{platform_id}/models` | GET | 获取指定平台下的模型 | 已认证 |

### 对话管理模块

| 接口路径 | 方法 | 功能描述 | 权限要求 |
|---------|------|---------|---------|
| `/api/conversations` | GET | 获取对话列表 | 已认证 |
| `/api/conversations` | POST | 创建新对话 | 已认证 |
| `/api/conversations/{conv_id}` | GET | 获取对话详情 | 已认证 |
| `/api/conversations/{conv_id}/messages` | GET | 获取对话消息 | 已认证 |
| `/api/conversations/{conversation_id}/generate_title` | POST | 生成对话标题 | 已认证 |

### 系统模块

| 接口路径 | 方法 | 功能描述 | 权限要求 |
|---------|------|---------|---------|
| `/health` | GET | 健康检查 | 公开 |
| `/api/test-write` | GET | 测试文件写入权限 | 已认证 |

## 接口详细定义要点

### 认证接口

#### 用户注册

- **路径**：`/auth/register`
- **方法**：POST
- **请求体**：
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **响应**：
  - 200 OK: `{"msg": "注册成功"}`
  - 400 Bad Request: `{"detail": "用户名已存在"}`

#### 用户登录

- **路径**：`/auth/login`
- **方法**：POST
- **请求体**：
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **响应**：
  - 200 OK: `{"access_token": "string", "token_type": "bearer"}`
  - 401 Unauthorized: `{"detail": "用户名或密码错误"}`

### 公文生成接口

#### 上传模板

- **路径**：`/api/upload-template`
- **方法**：POST
- **请求体**：multipart/form-data
  - `file`: DOCX文件
- **响应**：
  - 200 OK: 
    ```json
    {
      "id": "integer",
      "filename": "string",
      "original_name": "string",
      "uploaded_at": "datetime"
    }
    ```
  - 400 Bad Request: `{"detail": "请上传正确的docx格式文件"}`

#### 生成公文

- **路径**：`/api/generate`
- **方法**：POST
- **请求体**：multipart/form-data
  - `doc_type`: 文档类型（如"通知"、"请示"等）
  - `user_input`: 用户输入内容
  - `conv_id`: 对话ID（可选）
  - `ai_model_id`: AI模型ID（可选）
  - `template_id`: 模板ID（可选）
- **响应**：
  - 200 OK: 流式响应（SSE格式）
  - 400 Bad Request: `{"detail": "请先在「API Keys管理」中添加AI模型配置"}`

#### 获取公文历史

- **路径**：`/api/history`
- **方法**：GET
- **查询参数**：
  - `page`: 页码（默认1）
  - `page_size`: 每页条数（默认10，最大50）
- **响应**：
  ```json
  {
    "total": "integer",
    "page": "integer",
    "page_size": "integer",
    "data": [
      {
        "id": "integer",
        "doc_type": "string",
        "filename": "string",
        "used_template": "string",
        "created_at": "string",
        "content_preview": "string"
      }
    ]
  }
  ```

### AI模型配置接口

#### 获取用户AI模型配置列表

- **路径**：`/api/keys`
- **方法**：GET
- **响应**：
  ```json
  [
    {
      "id": "integer",
      "platform_name": "string",
      "model_name": "string",
      "api_key_mask": "string",
      "base_url": "string",
      "created_at": "datetime"
    }
  ]
  ```

#### 创建AI模型配置

- **路径**：`/api/keys`
- **方法**：POST
- **请求体**：
  ```json
  {
    "model_id": "integer",
    "api_key": "string",
    "base_url": "string"
  }
  ```
- **响应**：
  ```json
  {
    "id": "integer",
    "platform_name": "string",
    "model_name": "string",
    "api_key_mask": "string",
    "base_url": "string",
    "created_at": "datetime"
  }
  ```

## 认证授权与版本控制

### 认证机制

系统采用JWT（JSON Web Token）认证：

1. 用户通过`/auth/login`接口获取令牌
2. 后续请求在HTTP头部携带令牌：`Authorization: Bearer {token}`
3. 令牌有效期为60分钟（可通过ACCESS_TOKEN_EXPIRE_MINUTES配置）

### 版本控制

当前系统API未进行显式版本控制，所有接口均位于基础路径`/api`下。未来如需版本升级，建议采用URL路径版本控制（如`/api/v2/...`）。

## 接口设计注意事项

1. **命名规范**：
   - 使用名词复数形式表示资源集合（如`/templates`而非`/template`）
   - 避免在URL中使用动词（推荐`/history`而非`/get-history`）

2. **参数清晰**：
   - 明确标注必填项（如`filename`为`/download/{filename}`的必填URL参数）
   - 分页接口统一使用`page`和`page_size`参数

3. **响应统一**：
   - 所有接口均返回标准JSON结构
   - 分页响应统一包含`total`、`page`、`page_size`字段
   - 错误响应包含`detail`字段描述错误信息

4. **错误友好**：
   - 错误信息需清晰明确，包含排查关键（如"模板ID不存在：TPL-2023"）
   - 身份验证失败返回401状态码，并包含WWW-Authenticate头

5. **兼容性保障**：
   - 版本升级时新增字段需设为可选
   - 禁止删除旧版本必填参数
   - 接口行为变更需提前通知前端团队