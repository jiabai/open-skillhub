# <img src="docs/figure/skillhub-logo.png" alt="Open SkillHub Logo" width="5%" style="vertical-align: middle;"> Open SkillHub 私有化 Skills 管理 SaaS

<p align="center">
  <a href="https://pypi.org/project/open-skillhub/"><img src="https://img.shields.io/badge/python-3.10+-blue" alt="Python Version"></a>
  <a href="https://pypi.org/project/open-skillhub/"><img src="https://img.shields.io/pypi/v/open-skillhub.svg?logo=pypi" alt="PyPI Version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-black" alt="License"></a>
  <a href="https://github.com/zouyingcao/open-skillhub"><img src="https://img.shields.io/github/stars/zouyingcao/open-skillhub?style=social" alt="GitHub Stars"></a>
</p>

<p align="center">
  简体中文 | <a href="./README.md">English</a>
</p>

## 📖 项目概览

Open SkillHub 是**私有化 Skills 管理 SaaS**，提供多用户账户体系、私有 Skill 空间、可视化控制台与 MCP 接入能力。系统通过 Web API 管理 Skill 生命周期，并通过 MCP HTTP/SSE 端点供客户端执行 Skills，实现"上传-管理-调用"的闭环。

## ✅ 核心能力

- 多用户账户与 JWT 认证
- API Token 管理与 MCP 访问控制
- Skill 创建、上传（ZIP）、版本归档与回滚、下架与启用
- 统一控制台：Skills、Tokens、个人资料与安全设置
- 概览指标与统计维护接口
- MCP HTTP/SSE 入口与用户隔离

## 🧩 企业私有云 P0 对齐

- 企业认证与身份映射（LDAP/AD/SSO）
- RBAC 与企业/团队/个人可见性
- MCP/REST 接口契约（`skill://list`、`skill://{id}@{version}`、`execute_skill`、`skills/download`）
- 审计日志采集、查询与导出
- 版本自动递增策略与冲突校验

详见 [docs/project-spec.md](docs/project-spec.md)、[docs/task_list.md](docs/task_list.md)、[docs/checklist.md](docs/checklist.md)。

## 🚀 快速开始（SaaS 模式）

### 1. 安装依赖

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，至少设置以下变量：

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

## 🔌 MCP 接入示例

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

## 📚 文档入口

- 文档导航：[docs/README.md](docs/README.md)
- 技术规范：[docs/project-spec.md](docs/project-spec.md)
- 部署指南：[docs/deployment.md](docs/deployment.md)
- MCP 工具说明：[docs/tools.md](docs/tools.md)

## 🤝 贡献指南

欢迎提交 PR 与反馈问题。

## ⚖️ 许可证

本项目采用 Apache License 2.0 许可证 —— 详情请参见 [LICENSE](./LICENSE) 文件。