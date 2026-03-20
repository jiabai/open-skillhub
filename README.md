# <img src="docs/figure/skillhub-logo.png" alt="Open SkillHub Logo" width="5%" style="vertical-align: middle;"> Open SkillHub

<p align="center">
  <a href="https://pypi.org/project/open-skillhub/"><img src="https://img.shields.io/badge/python-3.10+-blue" alt="Python Version"></a>
  <a href="https://pypi.org/project/open-skillhub/"><img src="https://img.shields.io/pypi/v/open-skillhub.svg?logo=pypi" alt="PyPI Version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-black" alt="License"></a>
  <a href="https://github.com/zouyingcao/open-skillhub"><img src="https://img.shields.io/github/stars/zouyingcao/open-skillhub?style=social" alt="GitHub Stars"></a>
</p>

<p align="center">
  <a href="./README_ZH.md">简体中文</a> | English
</p>

## Overview

Open SkillHub is a **private Skills management SaaS platform** designed for AI agents. It provides multi-tenant accounts, private skill spaces, a web console, and MCP HTTP/SSE endpoints so clients can execute skills securely. The system manages skill lifecycles through the Web API and exposes MCP endpoints for execution, enabling a complete "upload → manage → run" workflow.

## Features

### Core Capabilities
- **Multi-tenant Architecture** - User isolation with JWT authentication
- **API Token Management** - Secure MCP access control with `ask_live_...` tokens
- **Skill Lifecycle Management** - Create, upload (ZIP), version, rollback, activate/deactivate
- **Web Console** - Dashboard for skills, tokens, profile, and security settings
- **MCP Integration** - HTTP/SSE endpoints for AI agent integration

### Enterprise Features (Optional)
- **Organization Model** - Enterprise/Team/User hierarchy
- **RBAC** - Role-based access control with configurable permissions
- **Skill Visibility** - Enterprise/Team/Private visibility levels
- **Audit Logging** - Comprehensive audit trail with export capability
- **SSO Integration** - JWT-based SSO with LDAP support
- **Email Verification** - OTP login and email verification codes

### MCP Tools (7 Tools)
1. `load_skill_metadata` - Scan available skills
2. `load_skill` - Load skill instructions (SKILL.md)
3. `read_reference_file` - Read skill reference files
4. `run_shell_command` - Execute shell commands (whitelist-controlled)
5. `skill_list_resource` - MCP Resource for `skill://list`
6. `skill_detail_resource` - MCP Resource for `skill://{uuid}@{version}`
7. `execute_skill` - Execute skill with RBAC checks

## Quick Start

### Prerequisites
- Python 3.10+
- PostgreSQL 14+ (production)
- Node.js 18+ (frontend console)

### 1. Install Dependencies

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows
pip install -e ".[dev]"
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/skillhub
SECRET_KEY=your-secret-key-min-32-chars
SKILL_STORAGE_PATH=/data/skills
CORS_ORIGINS=["http://localhost:3000"]
```

### 3. Initialize Database

```bash
alembic upgrade head
```

### 4. Start API Server

```bash
uvicorn skillhub.api_app:app --host 0.0.0.0 --port 8000
```

### 5. Start Frontend Console

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

## MCP Integration

Configure your AI client to connect to Open SkillHub:

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

### Authentication Flow

1. Login via `/api/v1/auth/login` to get JWT token
2. Create API token via `/api/v1/tokens`
3. Use API token (`ask_live_...`) for MCP access
4. MCP service automatically identifies user and accesses their private skill space

## Skill Storage Structure

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

Each user can only access their own skill directory, ensuring data isolation.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/project-spec.md](docs/project-spec.md) | Technical specification |
| [docs/deployment.md](docs/deployment.md) | Deployment guide |
| [docs/tools.md](docs/tools.md) | MCP tools documentation |
| [docs/frontend-design/](docs/frontend-design/) | Frontend design specs |

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/verify-email` - Email verification

### Skills
- `GET /api/v1/skills` - List skills
- `POST /api/v1/skills` - Create skill
- `GET /api/v1/skills/{id}` - Get skill detail
- `PUT /api/v1/skills/{id}` - Update skill
- `DELETE /api/v1/skills/{id}` - Delete skill
- `POST /api/v1/skills/{id}/upload` - Upload skill ZIP
- `POST /api/v1/skills/{id}/rollback` - Rollback to version

### Tokens
- `GET /api/v1/tokens` - List API tokens
- `POST /api/v1/tokens` - Create API token
- `DELETE /api/v1/tokens/{id}` - Revoke token

### MCP
- `POST /mcp` - MCP HTTP endpoint
- `GET /sse` - MCP SSE endpoint

## License

This project is licensed under the Apache License 2.0 - see [LICENSE](./LICENSE) for details.

## Contributing

Issues and pull requests are welcome.