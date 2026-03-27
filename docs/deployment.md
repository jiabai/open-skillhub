# 部署指南

本文档提供 Open SkillHub 的完整部署说明，包括开发环境、生产环境（Docker Compose）以及低资源配置优化。

## 目录

- [快速开始](#快速开始)
- [架构说明](#架构说明)
- [部署模式](#部署模式)
- [环境要求](#环境要求)
- [Docker Compose 部署](#docker-compose-部署)
- [手动部署](#手动部署)
- [环境变量配置](#环境变量配置)
- [功能开关](#功能开关)
- [备份策略](#备份策略)
- [监控与告警](#监控与告警)
- [常见问题](#常见问题)

---

## 快速开始

### Docker Compose 部署（推荐）

```bash
# 克隆代码
git clone <repository-url>
cd open-skillhub

# 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 设置必要参数（SECRET_KEY、SMTP 配置）

# 创建数据目录
mkdir -p data logs

# 启动所有服务
docker compose up -d --build

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

访问 http://your-domain.com 即可使用。

---

## 架构说明

### 前后端分离 + API 代理模式

```
┌─────────────────────────────────────────────────────────────┐
│                        外部网络                              │
│                                                             │
│   用户浏览器 ───► https://your-domain.com (端口 443/80)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Docker 网络                             │
│                                                             │
│   ┌──────────────┐          ┌──────────────┐                │
│   │   Frontend   │◄────────►│     API      │                │
│   │  (Next.js)   │  代理     │  (FastAPI)   │                │
│   │   :3000      │  /api/*  │   :8001      │                │
│   └──────────────┘          └──────┬───────┘                │
│                                    │                         │
│                                    ▼                         │
│                             ┌──────────────┐                 │
│                             │   SQLite     │                 │
│                             │  (data/db)   │                 │
│                             └──────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 特点

- **API 不暴露到外网**：所有 API 请求通过 Frontend 的 Next.js rewrites 代理
- **SQLite 数据库**：无需额外数据库容器，节省内存，适合低配机器
- **前后端解耦**：前端可独立扩展
- **数据持久化**：数据库文件存储在 `./data` 目录

---

## 部署模式

| 模式 | 适用场景 | 数据库 | 入口 |
|------|---------|--------|------|
| **Docker Compose (SQLite)** | 测试环境、低配机器 | SQLite | `docker compose up` |
| **Docker Compose (PostgreSQL)** | 生产环境、高并发 | PostgreSQL | 需修改配置 |
| **手动部署** | 开发环境、定制化 | SQLite/PostgreSQL | `uvicorn backend.api_app:app` |

### FastAPI 模式（HTTP API + MCP）

- 适用：多用户 Web API、MCP HTTP/SSE 访问
- 入口：`backend.api_app:app`
- MCP 端点：`/mcp`、`/sse`

### FlowLLM 模式（stdio/SSE）

- 适用：本地单用户、CLI 集成
- 入口：`skillhub.main`

---

## 环境要求

### 最低配置（2核2G）- SQLite 模式

| 组件 | 内存限制 | 说明 |
|------|---------|------|
| API | 512M | 单 worker 模式 |
| Frontend | 384M | Next.js standalone |
| **总计** | ~0.9G | 预留 1.1G 给系统 |

### 推荐配置（4核8G+）- PostgreSQL 模式

| 组件 | 内存限制 | 说明 |
|------|---------|------|
| PostgreSQL | 1G | 默认配置 |
| API | 1G | 多 worker 模式 |
| Frontend | 512M | Next.js standalone |
| **总计** | ~2.5G | 可根据负载扩展 |

### 软件要求

- Docker 20.10+
- Docker Compose 2.0+
- Git

---

## Docker Compose 部署

### 1. 服务器准备

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Docker（如果没有）
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
apt install docker-compose -y
```

### 2. 克隆代码

```bash
git clone <repository-url>
cd open-skillhub
```

### 3. 配置环境变量

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

**必须配置项：**

```bash
# 安全密钥（必须设置，32字符以上）
# 生成命令: python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=your-secure-secret-key-at-least-32-chars

# SMTP 邮件配置（必须，用于发送验证码）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-email@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=your-email@example.com
SMTP_USE_TLS=true

# 数据库（默认 SQLite，无需修改）
DATABASE_URL=sqlite+aiosqlite:///./data/skillhub.db

# 调试模式（生产环境设为 false）
DEBUG=false
LOG_LEVEL=INFO
```

### 4. 启动服务

```bash
# 构建并启动所有服务
docker compose up -d --build

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f api
docker compose logs -f frontend
```

### 5. 验证部署

```bash
# 检查容器健康状态
docker compose ps

# 测试前端访问
curl http://localhost:80

# 访问 Web 控制台
# http://your-server-ip
```

### 6. 服务管理命令

```bash
# 停止服务
docker compose down

# 重启服务
docker compose restart api

# 重新构建
docker compose up -d --build --force-recreate

# 查看资源使用
docker stats

# 进入容器调试
docker compose exec api sh
```

---

## 手动部署

适用于开发环境或需要定制化配置的场景。

### 1. 安装依赖

```bash
# Python 环境
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows
pip install -e ".[dev]"

# Node.js 环境（如需前端）
cd frontend
npm install
cd ..
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env
```

### 3. 初始化数据库

#### SQLite 模式（自动创建）

SQLite 数据库文件会在首次启动时自动创建，无需手动操作。

#### PostgreSQL 模式（可选）

如需使用 PostgreSQL，需先创建数据库：

```bash
# PostgreSQL 命令行
psql -U postgres -c "CREATE DATABASE skillhub;"
psql -U postgres -c "CREATE USER skillhub WITH PASSWORD 'your-secure-password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE skillhub TO skillhub;"
```

#### 执行数据库迁移

```bash
# 执行迁移
alembic upgrade head
```

### 4. 准备数据目录

```bash
mkdir -p ./data/skills
chmod 755 ./data/skills
```

### 5. 启动服务

**后端 API：**

```bash
uvicorn backend.api_app:app --host 0.0.0.0 --port 8000
```

**前端控制台：**

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

---

## 环境变量配置

### 必填项

| 变量 | 说明 | 示例 |
|------|------|------|
| `SECRET_KEY` | JWT 签名密钥（32+字符） | `your-secret-key-min-32-chars` |
| `SMTP_HOST` | SMTP 服务器地址 | `smtp.example.com` |
| `SMTP_PORT` | SMTP 端口 | `587` |
| `SMTP_USERNAME` | SMTP 用户名 | `your-email@example.com` |
| `SMTP_PASSWORD` | SMTP 密码/授权码 | `your-auth-code` |
| `SMTP_FROM` | 发件人地址 | `your-email@example.com` |

### 数据库配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接 URL | `sqlite+aiosqlite:///./data/skillhub.db` |

**PostgreSQL URL 格式：**
```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/skillhub
```

### 可选项（重要）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEBUG` | `false` | 生产环境保持 `false` |
| `LOG_LEVEL` | `INFO` | 日志级别：DEBUG/INFO/WARNING/ERROR |
| `CORS_ORIGINS` | `["http://localhost"]` | CORS 允许的源列表 |
| `SKILL_STORAGE_PATH` | `/app/data/skills` | Skill 文件存储路径 |
| `LOG_FILE` | 空 | 日志文件路径，设为空则输出到 stdout |

---

## 功能开关

### 企业私有化部署建议

**基础模式（公开注册）：**

```bash
ENABLE_PUBLIC_SIGNUP=true
ENABLE_EMAIL_OTP_LOGIN=true
ENABLE_SSO=false
ENABLE_LDAP=false
ENABLE_ORG_MODEL=false
ENABLE_RBAC=false
```

**企业模式（最小权限）：**

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

### 完整开关列表

| 开关 | 说明 | 推荐值 |
|------|------|--------|
| `ENABLE_PUBLIC_SIGNUP` | 允许公开注册 | dev: `true`, prod: `false` |
| `ENABLE_EMAIL_OTP_LOGIN` | 邮箱验证码登录 | `true` |
| `ENABLE_SSO` | SSO 登录 | `false` |
| `ENABLE_LDAP` | LDAP 认证 | `false` |
| `ENABLE_ORG_MODEL` | 组织模型 | `false` |
| `ENABLE_RBAC` | RBAC 权限控制 | `false` |
| `ENABLE_SKILL_VISIBILITY` | Skill 可见性控制 | `false` |
| `ENABLE_AUDIT_LOG` | 审计日志 | `false` |
| `ENABLE_AUDIT_EXPORT` | 审计日志导出 | `false` |
| `ENABLE_RATE_LIMIT` | 速率限制 | `true` |
| `ENABLE_METRICS` | 指标收集 | `true` |

---

## 备份策略

### SQLite 数据库备份

**自动备份脚本：**

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR=/var/backup/skillhub
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份 SQLite 数据库
cp ./data/skillhub.db $BACKUP_DIR/db_$DATE.sqlite

# 备份 Skill 文件
tar -czf $BACKUP_DIR/skills_$DATE.tar.gz ./data/skills

# 保留最近 7 天备份
find $BACKUP_DIR -name "*.sqlite" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

**crontab 定时任务：**

```bash
# 每天凌晨 3 点执行备份
0 3 * * * /opt/open-skillhub/backup.sh >> /var/log/backup.log 2>&1
```

### PostgreSQL 备份（可选）

如果使用 PostgreSQL 模式：

```bash
# 备份数据库
docker compose exec -T db pg_dump -U skillhub > backup.sql

# 恢复
docker compose exec -T db psql -U skillhub < backup.sql
```

---

## 监控与告警

### 健康检查端点

```bash
# API 健康检查（通过前端代理）
curl http://localhost/api/v1/health

# 或直接访问 API 容器内部
docker compose exec api curl http://localhost:8001/health
```

### 推荐监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| API 响应时间 P99 | API 延迟 | > 2s |
| HTTP 5xx 错误率 | 服务错误 | > 1% |
| 磁盘使用率 | 存储空间 | > 80% |
| 内存使用率 | 内存压力 | > 85% |

### Docker 监控命令

```bash
# 查看资源使用
docker stats

# 查看容器日志
docker compose logs -f --tail=100

# 查看容器详情
docker inspect <container_name>
```

---

## 常见问题

### 1. 容器启动失败

```bash
# 查看详细日志
docker compose logs -f <service_name>

# 检查端口占用
lsof -i :80

# 检查磁盘空间
df -h
```

### 2. 数据库文件不存在

SQLite 数据库会在首次启动时自动创建，无需手动创建。如果遇到问题：

```bash
# 检查数据目录权限
ls -la ./data

# 进入容器手动初始化
docker compose exec api sh -c "alembic upgrade head"
```

### 3. CORS 报错

```bash
# 检查 CORS 配置
# 环境变量 CORS_ORIGINS 必须设置，不能包含 *
# 示例：CORS_ORIGINS=["https://your-domain.com"]
```

### 4. 前端无法访问 API

```bash
# 检查 Next.js rewrites 配置
# 确保 API_INTERNAL_URL 正确
# 检查 frontend 容器日志
docker compose logs -f frontend
```

### 5. 验证码邮件发送失败

```bash
# 检查 SMTP 配置是否正确
docker compose logs -f api | grep -i smtp

# 确认 SMTP 服务器支持 TLS
# 端口 587 通常使用 STARTTLS
# 端口 465 通常使用 SSL/TLS
```

---

## 附录

### 服务端口

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|---------|---------|------|
| Frontend | 3000 | 80 | Web 控制台 |
| API | 8001 | - | 后端 API（不暴露） |

### 切换到 PostgreSQL 模式

如需使用 PostgreSQL（推荐用于高并发生产环境）：

1. 修改 `docker-compose.yml`，添加 db 服务
2. 修改 `backend/.env` 的 `DATABASE_URL`
3. 参考 `.env.example` 中 PostgreSQL 相关配置

### 相关文档

- [README.md](../README.md) - 项目简介与快速开始
- [docs/tools.md](tools.md) - MCP 工具文档
- [docs/backend-design/](backend-design/) - 后端架构设计
- [docs/frontend-design/](frontend-design/) - 前端设计规范

---

*最后更新：2026-03-28*