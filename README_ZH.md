# <img src="docs/figure/skillhub-logo.png" alt="Open SkillHub Logo" width="5%" style="vertical-align: middle;"> Open SkillHub

<p align="center">
  <a href="https://pypi.org/project/open-skillhub/"><img src="https://img.shields.io/badge/python-3.10+-blue" alt="Python Version"></a>
  <a href="https://pypi.org/project/open-skillhub/"><img src="https://img.shields.io/pypi/v/open-skillhub.svg?logo=pypi" alt="PyPI Version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-black" alt="License"></a>
  <a href="https://github.com/zouyingcao/open-skillhub"><img src="https://img.shields.io/github/stars/zouyingcao/open-skillhub?style=social" alt="GitHub Stars"></a>
</p>

<p align="center">
  简体中文 | <a href="./README.md">English</a>
</p>

## 项目简介

Open SkillHub 是一个**私有化 Skills 管理 SaaS 平台**，专为 AI Agent 设计。它提供多租户账户体系、私有技能空间、可视化控制台以及 MCP HTTP/SSE 接入能力。系统通过 Web API 管理 Skill 生命周期，并通过 MCP 端点供客户端执行 Skills，实现"上传-管理-调用"的完整闭环。

## 功能特性

### 核心能力
- **多租户架构** - 用户隔离与 JWT 认证
- **API Token 管理** - 通过 `ask_live_...` Token 安全访问 MCP
- **Skill 生命周期管理** - 创建、上传（ZIP）、版本管理、回滚、启用/停用
- **Web 控制台** - 技能、Token、个人资料与安全设置的统一管理界面
- **MCP 集成** - HTTP/SSE 端点供 AI Agent 接入

### 企业级功能（可选）
- **组织模型** - 企业/团队/用户层级结构
- **RBAC 权限** - 基于角色的访问控制，权限可配置
- **技能可见性** - 企业级/团队级/私有三级可见性
- **审计日志** - 完整的操作审计追踪，支持导出
- **SSO 集成** - 基于 JWT 的 SSO，支持 LDAP
- **邮件验证** - OTP 登录与邮箱验证码

### MCP 工具（7 个）
1. `load_skill_metadata` - 扫描可用技能
2. `load_skill` - 加载技能指令（SKILL.md）
3. `read_reference_file` - 读取技能参考文件
4. `run_shell_command` - 执行 Shell 命令（白名单控制）
5. `skill_list_resource` - MCP Resource `skill://list`
6. `skill_detail_resource` - MCP Resource `skill://{uuid}@{version}`
7. `execute_skill` - 执行技能（带 RBAC 检查）

## 快速开始

### 环境要求
- Python 3.10+
- PostgreSQL 14+（生产环境）
- Node.js 18+（前端控制台）

### 1. 安装依赖

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows
pip install -e ".[dev]"
```

### 2. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env` 并配置：

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/skillhub
SECRET_KEY=your-secret-key-min-32-chars
SKILL_STORAGE_PATH=/data/skills
CORS_ORIGINS=["http://localhost:3000"]
```

### 3. 初始化数据库

```bash
alembic upgrade head
```

### 4. 启动后端 API

```bash
uvicorn backend.api_app:app --host 0.0.0.0 --port 8000
```

## Docker Compose 部署

### 快速开始（推荐）

```bash
# 启动所有服务
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend | 80 | Web 控制台 (Next.js) |
| API | 8001 | 后端 API（仅内网） |
| PostgreSQL | 5432 | 数据库（仅内网） |
| Adminer | 18080 | 数据库管理界面 |

### 配置说明

1. 复制 `backend/.env.example` 为 `backend/.env` 并配置
2. 环境变量自动从 `backend/.env` 加载
3. 生产环境请确保设置了 `SECRET_KEY` 且 `DEBUG=false`

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                      外部网络                            │
│                                                         │
│   浏览器 ───► http://your-domain.com (端口 80)         │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Docker 网络                            │
│                                                         │
│   ┌─────────────┐      ┌─────────────┐                │
│   │   Frontend  │◄────►│     API      │                │
│   │  (Next.js)  │代理  │  (FastAPI)   │                │
│   │   :3000     │      │   :8001      │                │
│   └─────────────┘      └──────┬───────┘                │
│                               │                         │
│                               ▼                         │
│                        ┌─────────────┐                 │
│                        │ PostgreSQL  │                 │
│                        │   :5432     │                 │
│                        └─────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

所有外部流量通过 Frontend 进入，由 Frontend 代理 API 请求。

## MCP 接入配置

在 AI 客户端中配置 Open SkillHub：

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

### 认证流程

1. 通过 `POST /api/v1/auth/verification-code` 发送验证码（用途：`login`/`register`/`delete_account`）
2. 通过 `POST /api/v1/auth/login` 使用邮箱和验证码登录获取 JWT Token
3. 通过 `POST /api/v1/tokens` 创建 API Token
4. 使用 API Token（`ask_live_...`）访问 MCP 服务
5. MCP 服务自动识别用户身份，访问其私有 Skill 空间

## Skill 存储结构

```
/data/skills/
├── {user_id_1}/
│   ├── pdf/
│   │   ├── SKILL.md
│   │   └── reference.md
│   └── xlsx/
│       └── SKILL.md
├── {user_id_2}/
│   └── pdf/
│       └── SKILL.md
└── ...
```

每个用户只能访问自己目录下的 Skills，确保数据隔离与安全。

## 文档

| 文档 | 说明 |
|------|------|
| [docs/backend-design/](docs/backend-design/) | 后端架构与设计文档 |
| [docs/deployment.md](docs/deployment.md) | 部署指南 |
| [docs/tools.md](docs/tools.md) | MCP 工具文档 |
| [docs/frontend-design/](docs/frontend-design/) | 前端设计规范 |

## API 端点

### 认证
- `POST /api/v1/auth/verification-code` - 发送邮箱验证码
- `POST /api/v1/auth/register` - 用户注册（验证码方式）
- `POST /api/v1/auth/login` - 用户登录（验证码方式）
- `POST /api/v1/auth/refresh` - 刷新 Token
- `POST /api/v1/auth/sso/login` - SSO 登录
- `POST /api/v1/auth/ldap/login` - LDAP 登录

### 用户管理
- `GET /api/v1/users/me` - 获取当前用户信息
- `PUT /api/v1/users/me` - 更新用户信息
- `POST /api/v1/users/me/delete-request` - 请求删除账户验证码
- `DELETE /api/v1/users/me` - 删除账户（需验证码）
- `POST /api/v1/users/bind-email` - 绑定邮箱
- `PUT /api/v1/users/{user_id}/identity` - 更新用户身份（管理员）

### 技能管理
- `GET /api/v1/skills` - 获取技能列表
- `GET /api/v1/skills/cache-policy` - 获取缓存策略
- `POST /api/v1/skills` - 创建技能
- `GET /api/v1/skills/{id}` - 获取技能详情
- `PUT /api/v1/skills/{id}` - 更新技能
- `DELETE /api/v1/skills/{id}` - 删除技能
- `POST /api/v1/skills/upload` - 上传技能 ZIP 包
- `POST /api/v1/skills/download` - 下载技能（仅管理员）
- `POST /api/v1/skills/{id}/deactivate` - 停用技能
- `POST /api/v1/skills/{id}/activate` - 启用技能
- `GET /api/v1/skills/{id}/versions` - 获取技能版本列表
- `POST /api/v1/skills/{id}/versions/{version}/rollback` - 版本回滚
- `GET /api/v1/skills/{id}/files` - 获取文件列表
- `GET /api/v1/skills/{id}/files/{file_path}` - 读取文件内容

### Token 管理
- `GET /api/v1/tokens` - 获取 API Token 列表
- `POST /api/v1/tokens` - 创建 API Token
- `DELETE /api/v1/tokens/{id}` - 撤销 Token

### 仪表盘
- `GET /api/v1/dashboard/overview` - 获取仪表盘概览
- `POST /api/v1/dashboard/metrics/cleanup` - 清理指标数据（仅管理员）
- `POST /api/v1/dashboard/metrics/reset-24h` - 重置24小时指标（仅管理员）

### 审计日志
- `GET /api/v1/audit/logs` - 查询审计日志
- `POST /api/v1/audit/logs/export` - 导出审计日志

### MCP
- `POST /mcp` - MCP HTTP 端点
- `GET /sse` - MCP SSE 端点

## 许可证

本项目采用 Apache License 2.0 许可证 —— 详情请参见 [LICENSE](./LICENSE) 文件。

## 贡献指南

欢迎提交 PR 与反馈问题。