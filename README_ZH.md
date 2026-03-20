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

复制 `.env.example` 为 `.env` 并配置：

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
uvicorn skillhub.api_app:app --host 0.0.0.0 --port 8000
```

### 5. 启动前端控制台

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

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

1. 通过 `/api/v1/auth/login` 登录获取 JWT Token
2. 通过 `/api/v1/tokens` 创建 API Token
3. 使用 API Token（`ask_live_...`）访问 MCP 服务
4. MCP 服务自动识别用户身份，访问其私有 Skill 空间

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
| [docs/project-spec.md](docs/project-spec.md) | 技术规范 |
| [docs/deployment.md](docs/deployment.md) | 部署指南 |
| [docs/tools.md](docs/tools.md) | MCP 工具文档 |
| [docs/frontend-design/](docs/frontend-design/) | 前端设计规范 |

## API 端点

### 认证
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - 刷新 Token
- `POST /api/v1/auth/verify-email` - 邮箱验证

### 技能管理
- `GET /api/v1/skills` - 获取技能列表
- `POST /api/v1/skills` - 创建技能
- `GET /api/v1/skills/{id}` - 获取技能详情
- `PUT /api/v1/skills/{id}` - 更新技能
- `DELETE /api/v1/skills/{id}` - 删除技能
- `POST /api/v1/skills/{id}/upload` - 上传技能 ZIP 包
- `POST /api/v1/skills/{id}/rollback` - 版本回滚

### Token 管理
- `GET /api/v1/tokens` - 获取 API Token 列表
- `POST /api/v1/tokens` - 创建 API Token
- `DELETE /api/v1/tokens/{id}` - 撤销 Token

### MCP
- `POST /mcp` - MCP HTTP 端点
- `GET /sse` - MCP SSE 端点

## 许可证

本项目采用 Apache License 2.0 许可证 —— 详情请参见 [LICENSE](./LICENSE) 文件。

## 贡献指南

欢迎提交 PR 与反馈问题。