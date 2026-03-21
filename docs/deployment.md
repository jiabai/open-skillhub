# 部署指南

本文档提供 Open SkillHub 的本地开发与生产部署说明，涵盖 FastAPI 模式与 FlowLLM 模式。

## 部署模式

### FastAPI 模式（HTTP API + MCP）
- 适用：多用户 Web API、MCP HTTP/SSE 访问
- 入口：`skillhub.api_app:app`
- MCP 端点：`/mcp`、`/sse`

### FlowLLM 模式（stdio/SSE）
- 适用：本地单用户、CLI 集成
- 入口：`skillhub.main`

## 部署能力开关建议（企业私有化）

企业私有化部署的能力开关建议以本文与 `project-spec.md` 第 1.5 节为准。

## 术语与开关口径

- 本文中的部署能力口径与 `project-spec.md` 保持一致
- 可见性术语统一使用“企业级 / 团队级 / 个人级”，对应配置与接口字段口径 `visible`
- 可见性示例值统一使用 `enterprise | team | private`
- 权限术语统一使用 RBAC 权限点（`resource.action`），如 `skill.download`、`audit.read`
- 功能开关统一使用 `ENABLE_*` 命名，部署时仅通过环境变量控制能力组合，不在代码层分叉实现
- 示例值模板统一复用 `project-spec.md` 中“术语与状态统一口径”的 JSON/env 示例，避免跨文档漂移

## 前置条件

- Python 3.10+
- PostgreSQL 14+（生产环境）
- Node.js 18+（前端控制台）
- 可选：Docker / Docker Compose

## 环境变量配置

复制 `.env.example` 并按需修改：

> 说明：`.env.example` 展示的是代码内建默认值与示例值；私有化部署需显式覆盖相关能力开关。

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/skillhub
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10
DATABASE_POOL_TIMEOUT=30
DATABASE_POOL_RECYCLE=1800
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
DEBUG=false
CORS_ORIGINS=["https://your-domain.com"]
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=/var/log/skillhub/app.log
SKILL_STORAGE_PATH=/data/skills
SKILL_ARCHIVE_BACKEND=local
SKILL_ARCHIVE_S3_BUCKET=
SKILL_ARCHIVE_S3_REGION=
SKILL_ARCHIVE_S3_ENDPOINT=
SKILL_ARCHIVE_S3_ACCESS_KEY_ID=
SKILL_ARCHIVE_S3_SECRET_ACCESS_KEY=
SKILL_ARCHIVE_S3_FORCE_PATH_STYLE=true
SKILL_DOWNLOAD_TTL_SECONDS=3600
SKILL_CACHE_TTL_SECONDS=604800
SKILL_VERSION_BUMP_STRATEGY=patch
SKILL_EXECUTION_TIMEOUT_SECONDS=300
SKILL_MAX_CONCURRENT_EXECUTIONS_PER_USER=4
SKILL_MAX_CONCURRENT_EXECUTIONS_PER_TEAM=16
SKILL_MAX_WORKDIR_BYTES=1073741824
SKILL_MAX_OUTPUT_BYTES=1048576
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
METRICS_RETENTION_DAYS=90
FLOW_LLM_API_KEY=your-api-key
FLOW_LLM_BASE_URL=https://api.openai.com/v1
POSTGRES_USER=skillhub
POSTGRES_PASSWORD=skillhub
POSTGRES_DB=skillhub
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=your-sender@example.com
SMTP_USE_TLS=true
ALIYUN_DM_ACCESS_KEY_ID=your-aliyun-access-key-id
ALIYUN_DM_ACCESS_KEY_SECRET=your-aliyun-access-key-secret
ALIYUN_DM_ACCOUNT_NAME=sender@your-domain.com
ALIYUN_DM_FROM_ALIAS=SkillHub
ALIYUN_DM_REPLY_TO_ADDRESS=true
ALIYUN_DM_ENDPOINT=https://dm.aliyuncs.com/
ENABLE_PUBLIC_SIGNUP=true
ENABLE_EMAIL_OTP_LOGIN=true
ENABLE_SSO=false
ENABLE_LDAP=false
ENABLE_ORG_MODEL=false
ENABLE_RBAC=false
ENABLE_SKILL_VISIBILITY=false
ENABLE_AUDIT_LOG=false
ENABLE_AUDIT_EXPORT=false
ENABLE_SKILL_DOWNLOAD_ENCRYPTION=true
ENABLE_LOCAL_CACHE_ENCRYPTION=true
ENABLE_CACHE_OFFLINE_FALLBACK=true
ENABLE_SANDBOX_EXECUTION=false
ENABLE_RESOURCE_QUOTA=false
ENABLE_NETWORK_EGRESS_CONTROL=false
ENABLE_RATE_LIMIT=true
ENABLE_METRICS=true
DEFAULT_SKILL_VISIBILITY=private
DEFAULT_ROLE=member
DEFAULT_USER_STATUS=active
RBAC_ROLE_PERMISSIONS={"admin":["*"],"member":["skill.list","skill.read","skill.create","skill.update","skill.delete","skill.upload","skill.download","skill.execute"],"viewer":["skill.list","skill.read","skill.download"]}
SSO_JWT_SECRET=
SSO_JWT_ISSUER=
SSO_JWT_AUDIENCE=
SSO_JWT_ALGORITHM=HS256
SSO_EMAIL_CLAIM=email
SSO_USERNAME_CLAIM=username
SSO_ENTERPRISE_CLAIM=enterprise_id
SSO_TEAM_CLAIM=team_id
SSO_ROLE_CLAIM=role
SSO_STATUS_CLAIM=status
LDAP_URL=
LDAP_USER_DN_TEMPLATE=
LDAP_SEARCH_BASE=
LDAP_SEARCH_FILTER=(uid={username})
LDAP_EMAIL_ATTR=mail
LDAP_USERNAME_ATTR=uid
LDAP_ENTERPRISE_ATTR=enterprise_id
LDAP_TEAM_ATTR=team_id
LDAP_ROLE_ATTR=role
LDAP_STATUS_ATTR=status
```

### 企业私有化最小能力开关示例

```bash
ENABLE_PUBLIC_SIGNUP=false
ENABLE_EMAIL_OTP_LOGIN=false
ENABLE_SSO=true
ENABLE_LDAP=true
ENABLE_ORG_MODEL=true
ENABLE_RBAC=true
ENABLE_SKILL_VISIBILITY=true
ENABLE_AUDIT_LOG=true
ENABLE_AUDIT_EXPORT=true
```

## 数据库准备

```bash
createdb skillhub
alembic upgrade head
```

## Skill 存储准备

```bash
mkdir -p /data/skills
chmod 755 /data/skills
```

## 邮件与验证码运行要求

### 发送通道策略
- DEBUG=true：使用 SMTP 备选方案（自建邮箱/业务邮箱）
- DEBUG=false：使用阿里云邮件推送服务

### 异步任务与持久化
- 邮件发送建议通过任务队列或后台任务执行，避免阻塞 API 请求
- 生产环境验证码存储建议使用 Redis 或数据库，保证多实例与重启一致性

### 模板与内容管理
- 模板需包含验证码、有效期与重发间隔提示
- 建议提供中英模板与品牌文案配置

### 监控与审计
- 监控投递成功率、失败原因分布与重试次数
- 发送失败需触发告警并写入审计日志

## 本地开发部署

### 1. 安装依赖

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 2. 启动 FastAPI 服务

```bash
uvicorn skillhub.api_app:app --host 0.0.0.0 --port 8000
```

### 3. 启动前端控制台

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

## 生产部署（Docker Compose，Ubuntu）

### 1. 准备环境变量

- 生产环境必须设置 `SECRET_KEY`、`CORS_ORIGINS`，且 `DEBUG=false`
- `.env` 用于存放敏感信息与生产配置

### 2. 启动服务（包含迁移）

```bash
docker compose --env-file .env up -d --build
```

`migrate` 服务会在 `db` 就绪后执行迁移并退出，`api` 会在迁移完成后启动。

### 3. 单独执行迁移（可选）

```bash
docker compose run --rm migrate
```

## 运行 FlowLLM 模式（可选）

```bash
skillhub-mcp
```

## 健康检查与指标

```bash
GET /health
```

返回示例：

```json
{
  "status": "healthy",
  "db_connected": true
}
```

```bash
GET /metrics
```

返回字段包括数据库连接状态与资源使用率（磁盘、内存、CPU）。

## 备份策略

### 数据库备份（Linux/macOS）

```bash
pg_dump skillhub > backup/skillhub_$(date +%Y%m%d).sql
find /backup -name "skillhub_*.sql" -mtime +7 -delete
```

### 数据库备份（Windows PowerShell）

```powershell
$backupPath = "C:\backup\skillhub_$(Get-Date -Format 'yyyyMMdd').sql"
pg_dump skillhub > $backupPath
Get-ChildItem "C:\backup\skillhub_*.sql" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item
```

### Skill 文件备份（Linux/macOS）

```bash
tar -czf backup/skills_$(date +%Y%m%d).tar.gz /data/skills
find /backup -name "skills_*.tar.gz" -mtime +7 -delete
```

### Skill 文件备份（Windows PowerShell）

```powershell
$backupPath = "C:\backup\skills_$(Get-Date -Format 'yyyyMMdd').zip"
Compress-Archive -Path "C:\data\skills" -DestinationPath $backupPath -Force
Get-ChildItem "C:\backup\skills_*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item
```

## 监控建议

- API 响应时间（P99）
- 数据库连接状态
- 磁盘使用率与内存占用
- HTTP 5xx 错误率
- Token 调用频率异常峰值

## MCP 接入示例

```json
{
  "mcpServers": {
    "skillhub-mcp": {
      "type": "http",
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer ask_live_xxx..."
      }
    }
  }
}
```

## 常见问题

### 1. CORS 报错
- 生产环境必须显式设置 `CORS_ORIGINS`，且不能包含 `*`

### 2. MCP 认证失败
- 确认 `Authorization` 头使用 `Bearer ask_live_xxx...`
- 确认 Token 未过期或撤销
