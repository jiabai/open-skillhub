# Docker Healthcheck Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate Docker startup healthcheck failures by making backend startup deterministic, separating schema migration from API serving, standardizing health endpoint semantics, and removing host-path permission coupling from the default Compose deployment.

**Architecture:** The backend image will run only the FastAPI process under a dedicated non-root user. Docker Compose will add a one-shot `migrate` service, use a named volume for SQLite persistence, keep logs on stdout/stderr, and point container health checks to a dedicated readiness endpoint while keeping `/health` backward-compatible.

**Tech Stack:** FastAPI, Uvicorn, Alembic, Docker, Docker Compose, SQLite, uv, pytest

---

## 背景

当前 Docker 健康检查失败不是单一配置错误，而是多项运行时职责耦合后暴露出的启动脆弱性：

1. 后端代码使用 `EmailStr`，但运行时依赖未声明 `email-validator`，应用在导入阶段就可能失败。
2. `backend/Dockerfile` 目前把 `alembic upgrade head` 和 `uvicorn` 串在同一个 `CMD` 中，导致“迁移失败”和“API 进程不健康”无法分离。
3. `docker-compose.yml` 目前使用宿主机 bind mount 的 `./data` 和 `./logs`，再叠加固定 `user: "1000:1000"`，首启容易因目录权限而失败。
4. `/health` 同时承担存活探测和就绪探测语义，而 Compose 健康检查直接依赖它，缺少更清晰的 liveness / readiness 边界。
5. 当前缺少一个最小启动 smoke test，导致“应用无法导入”这类错误只能在容器启动时暴露。

## 目标

- 让 `api` 容器职责单一，只负责提供 HTTP 服务。
- 将数据库迁移从 API 启动流程中拆出，变成可独立执行、可观察的 one-shot 任务。
- 让默认 Compose 部署不依赖宿主机目录权限状态。
- 让日志遵循容器标准实践，默认输出到 stdout/stderr。
- 将健康检查拆成明确的 liveness / readiness 语义。
- 为启动链路补最小测试覆盖，避免运行时依赖缺失再次进入主分支。

## 非目标

- 本轮不引入 PostgreSQL 作为默认数据库。
- 本轮不做与健康检查无关的大规模后端文件拆分。
- 本轮不改前端运行时能力模型或业务 API 语义。
- 本轮不引入 Kubernetes 探针或编排层升级。

## 目标架构

### 1. Backend Image

- `backend/Dockerfile` 构建出单一运行镜像。
- 运行镜像内创建专用低权限用户，例如 `skillhub`。
- 默认 `CMD` 只运行 `uvicorn backend.api_app:app --host 0.0.0.0 --port 8001 --workers 1`。
- 镜像内预创建 `/app/data`，确保首次挂载 named volume 时具备可写目录基线。

### 2. Compose Topology

- 新增 `migrate` one-shot service，复用 `api` 镜像。
- `migrate` 只运行 Alembic migration，并在成功后退出。
- `api` 依赖迁移完成后启动。
- SQLite 数据持久化改为 Docker named volume，例如 `skillhub-data:/app/data`。
- 删除 `./logs:/app/logs` 文件日志挂载。

### 3. Logging Contract

- 应用默认不写容器内文件日志。
- `LOG_FILE` 默认值改为空字符串，未显式配置时仅输出 stderr/stdout。
- 默认 Compose 配置不覆盖 `LOG_FILE` 为文件路径。

### 4. Health Endpoint Contract

- 新增 `/livez`：仅表示应用进程和路由系统可用，不依赖数据库。
- 新增 `/readyz`：表示 API 已准备好提供服务，必须校验数据库连通性。
- 保留 `/health` 作为兼容入口，并使其语义与 `/readyz` 对齐。
- Compose healthcheck 改为命中 `http://127.0.0.1:8001/readyz`。

### 5. Verification Contract

- 增加应用启动 smoke test，覆盖“应用可导入 / `create_application()` 可执行”。
- 增加 `/livez`、`/readyz`、`/health` 的显式测试。
- 为 Compose 流程定义固定验证命令与通过标准。

## 关键设计决策

### 决策 A: 迁移与 API 分离

**决策**

- 不再在 API 容器启动命令里串联 Alembic。
- 使用独立的 `migrate` 服务执行迁移。

**理由**

- 将“模式变更失败”和“API 进程不可用”解耦。
- 让故障点可观察、可重试、可单独调试。
- 符合容器单一职责原则。

**完成标准**

- `backend/Dockerfile` 的默认 `CMD` 不含 `alembic`。
- `docker-compose.yml` 存在单独的 `migrate` service。
- `migrate` 服务命令仅负责 migration。

### 决策 B: 默认持久化改为 named volume

**决策**

- 默认 Compose 配置改用 Docker named volume 存储 SQLite 数据。

**理由**

- 降低 Linux/Windows/macOS 对宿主机目录权限和路径差异的敏感性。
- 比 bind mount 更适合作为仓库默认 quickstart。

**完成标准**

- `docker-compose.yml` 定义 `volumes: skillhub-data:`
- `api` 和 `migrate` 使用 `skillhub-data:/app/data`
- 默认 Compose 中不再出现 `./data:/app/data`

### 决策 C: 日志默认走 stdout/stderr

**决策**

- 默认不使用文件日志挂载。
- 保留 `LOG_FILE` 配置能力，但默认值为空。

**理由**

- 容器日志应由 Docker 接管，而不是依赖容器内文件。
- 避免首启时目录创建、权限、日志轮转等非业务故障。

**完成标准**

- `backend/config/settings.py` 中 `LOG_FILE` 默认值为空。
- `docker-compose.yml` 不再注入 `/app/logs/skillhub.log`
- `docker-compose.yml` 不再挂载 `./logs:/app/logs`

### 决策 D: 明确健康检查语义

**决策**

- `/livez` 用于存活探测。
- `/readyz` 用于就绪探测。
- `/health` 兼容保留，但语义对齐 readiness。

**理由**

- 避免一个端点同时承担多个运维语义。
- 为将来引入更复杂编排层提供一致接口。

**完成标准**

- `/livez` 在数据库故障时仍返回 `200`
- `/readyz` 在数据库故障时返回 `503`
- `/health` 在数据库故障时返回 `503`
- Compose healthcheck 指向 `/readyz`

## 计划文件边界

### 预计修改文件

- `pyproject.toml`
- `uv.lock`
- `backend/Dockerfile`
- `docker-compose.yml`
- `backend/api_app.py`
- `backend/config/settings.py`
- `backend/.env.example`
- `README.md`
- `README-zh.md`
- `docs/deployment.md`
- `tests/test_api_auth.py`

### 预计新增文件

- `tests/test_app_startup.py`

### 明确不改的文件

- `frontend/Dockerfile`
- 业务 API 路由路径（除新增运维端点）
- SQLite 以外的数据库接入策略

## 里程碑

### Milestone 1: 修正运行时依赖并建立启动 smoke test

**范围**

- 补齐 `email-validator`
- 新增最小应用启动测试

**完成标准**

- 后端应用可以完成导入和 `create_application()` 调用
- 启动 smoke test 单独可通过

### Milestone 2: 重构 backend image 运行职责

**范围**

- 后端镜像创建低权限用户
- 默认命令只运行 Uvicorn

**完成标准**

- `backend/Dockerfile` 不再把 migration 与 API 启动耦合
- 容器运行用户不依赖 Compose 中的固定 UID/GID

### Milestone 3: 重构 Compose 拓扑与持久化策略

**范围**

- 新增 `migrate` service
- 数据目录切换为 named volume
- 删除默认文件日志挂载

**完成标准**

- `docker compose config` 解析通过
- 默认 Compose 中不再存在 `./data` / `./logs` bind mount

### Milestone 4: 标准化健康检查端点

**范围**

- 新增 `/livez`、`/readyz`
- 兼容保留 `/health`
- 更新 Compose healthcheck

**完成标准**

- 三个端点的状态码语义与计划一致
- 相关测试通过

### Milestone 5: 文档与部署收口

**范围**

- 更新 README、中文 README、部署文档和 `.env.example`

**完成标准**

- Quickstart 与实际 Compose 行为一致
- 部署文档明确 migration-first 启动方式与验证命令

## 全局验收标准

全部里程碑完成后，必须同时满足以下条件：

1. `uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q` 返回成功。
2. `docker compose config` 返回成功。
3. 当 Docker 可用时：
   - `docker compose up -d --build migrate`
   - `docker compose up -d api frontend`
   - `docker compose ps` 中 `api` 为 `healthy`
4. 容器内请求 `http://127.0.0.1:8001/readyz` 返回 `200`。
5. `docker compose logs api` 能直接看到后端日志，不依赖容器内日志文件。

## 风险与控制点

### 风险 1: named volume 首次挂载权限不符合预期

**控制点**

- 镜像中必须预创建 `/app/data`
- 验收时必须实际验证首启可创建 SQLite 文件

### 风险 2: `service_completed_successfully` 在旧版 Compose 上不稳定

**控制点**

- 文档中保留 `docker compose run --rm migrate` 作为兼容启动方式
- 默认方案仍优先采用独立 `migrate` 服务

### 风险 3: 兼容旧调用方对 `/health` 的依赖

**控制点**

- `/health` 不删除
- `/health` 语义与 `/readyz` 对齐，并在文档中说明

## 退出条件

只有在以下条件都满足时，本计划才视为完成：

- 代码、测试、Compose、文档四条线全部更新
- Docker 默认启动链路不再依赖宿主机 `./data` / `./logs` 权限状态
- 健康检查失败时，日志能直接指向迁移失败、依赖缺失或数据库不可用中的具体原因
