# <img src="docs/figure/skillhub-logo.png" alt="Open SkillHub Logo" width="5%" style="vertical-align: middle;"> Open SkillHub - Private Skills SaaS

<p align="center">
  <a href="https://pypi.org/project/open-skillhub/"><img src="https://img.shields.io/badge/python-3.10+-blue" alt="Python Version"></a>
  <a href="https://pypi.org/project/open-skillhub/"><img src="https://img.shields.io/pypi/v/open-skillhub.svg?logo=pypi" alt="PyPI Version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-black" alt="License"></a>
  <a href="https://github.com/zouyingcao/open-skillhub"><img src="https://img.shields.io/github/stars/zouyingcao/open-skillhub?style=social" alt="GitHub Stars"></a>
</p>

<p align="center">
  <a href="./README_ZH.md">简体中文</a> | English
</p>

## 📖 Project Overview

Open SkillHub is a **private Skills management SaaS**. It provides multi-tenant accounts, private Skill spaces, a web console, and MCP HTTP/SSE access so clients can execute Skills securely. The system manages Skill lifecycles through the Web API and exposes MCP endpoints for execution, enabling a complete "upload → manage → run" workflow.

## ✅ Key Capabilities

- Multi-user accounts with JWT authentication
- API Tokens for MCP access control
- Skill creation, ZIP upload, versioning, rollback, deactivate/activate
- Console for Skills, Tokens, profile, and security settings
- Dashboard metrics with maintenance endpoints
- MCP HTTP/SSE endpoints with user isolation

## 🚀 Quick Start (SaaS mode)

### 1. Install dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and set at least:

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/skillhub
SECRET_KEY=your-secret-key-min-32-chars
SKILL_STORAGE_PATH=/data/skills
CORS_ORIGINS=["http://localhost:3000"]
```

### 3. Initialize the database

```bash
alembic upgrade head
```

### 4. Start the API server

```bash
uvicorn skillhub.api_app:app --host 0.0.0.0 --port 8000
```

### 5. Start the frontend console

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

## 🔌 MCP Integration Example

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

## 📚 Documentation

- Docs index: [docs/README.md](docs/README.md)
- Technical spec: [docs/project-spec.md](docs/project-spec.md)
- Deployment guide: [docs/deployment.md](docs/deployment.md)
- MCP tools: [docs/tools.md](docs/tools.md)

## 🤝 Contributing

Issues and pull requests are welcome.

## ⚖️ License

This project is licensed under the Apache License 2.0 — see [LICENSE](./LICENSE).