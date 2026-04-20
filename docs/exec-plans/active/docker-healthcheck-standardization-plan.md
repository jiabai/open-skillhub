# Docker Healthcheck Standardization Implementation Plan

**Status:** Active, partially implemented  
**Last reviewed:** 2026-04-21

**Goal:** Finish standardizing the Docker startup and healthcheck flow by aligning Compose, logging, persistence, and deployment docs with the already-landed backend and test changes.

**Architecture target:** The backend image should run only the FastAPI process under the dedicated `skillhub` user. Docker Compose should keep schema migration as a one-shot `migrate` service, remove Compose-level UID/GID patches, switch the default SQLite persistence to a named volume, send logs to stdout/stderr by default, and keep container health checks pointed at `/readyz` while preserving `/health` as a compatibility endpoint.

**Tech Stack:** FastAPI, Uvicorn, Alembic, Docker, Docker Compose, SQLite, uv, pytest

---

## 当前状态

这项改造不是“尚未开始”，而是已经完成了一半：

- 运行时依赖缺失问题已经修复，`email-validator` 已进入 runtime dependencies。
- 启动 smoke test 已存在，能够在测试阶段暴露应用导入失败。
- `backend/Dockerfile` 已改为专用低权限用户，默认 `CMD` 只运行 Uvicorn。
- `/livez`、`/readyz`、`/health` 已经实现，且 `/health` 语义已对齐 readiness。
- `LOG_FILE` 默认值已经为空，`.env.example` 也已说明空值表示 stdout/stderr。

当前剩余问题集中在 Docker Compose 和部署文档层：

1. `docker-compose.yml` 仍使用 `./data` / `./logs` bind mount。
2. `docker-compose.yml` 仍保留 `user: "1000:1000"`，覆盖了镜像内已定义的运行用户。
3. `docker-compose.yml` 仍把 `LOG_FILE` 注入到 `/app/logs/api.log`，使默认部署继续依赖文件日志。
4. `README.md`、`README-zh.md`、`docs/deployment.md` 仍描述 bind mount + 文件日志方案，与本计划目标不一致。
5. 计划与任务文档中仍有旧命名和旧假设，例如把前端服务写成 `frontend`，而当前 Compose 服务名是 `webui`。

## 本轮目标

- 让默认 Compose 部署不再依赖宿主机 `./data` / `./logs` 目录权限。
- 删除 Compose 中对后端服务的固定 UID/GID 覆盖。
- 让默认 Docker 日志出口与应用默认值保持一致，即 stdout/stderr。
- 让 README 与部署文档准确描述 migration-first 启动方式、`webui` 服务名和 readiness 验证方式。
- 为后续在有 Docker 的环境中完成端到端验收保留明确命令和通过标准。

## 非目标

- 本轮不引入 PostgreSQL 作为默认数据库。
- 本轮不重构业务 API、前端路由或运行时能力模型。
- 本轮不引入 Kubernetes 探针或新的编排层。
- 本轮不改动 `backend/Dockerfile` 已经稳定工作的非 root + Uvicorn 启动结构，除非为兼容 Compose 剩余工作所必需。

## 目标架构

### 1. Backend Image

- 保持 `backend/Dockerfile` 为单一运行镜像。
- 保持运行镜像内的 `skillhub` 非 root 用户。
- 保持默认 `CMD` 只运行 `uvicorn backend.api_app:app --host 0.0.0.0 --port 8001 --workers 1`。
- 保持镜像内预创建 `/app/data`，为 named volume 首挂载提供可写目录基线。

### 2. Compose Topology

- 保持独立的 `migrate` one-shot service。
- `migrate` 只运行 Alembic migration，并在成功后退出。
- `api` 依赖迁移完成后启动。
- SQLite 默认持久化改为 Docker named volume，例如 `skillhub-data:/app/data`。
- 默认 Compose 中删除 `./logs:/app/logs` 文件日志挂载。
- 删除 `user: "1000:1000"`，让镜像层定义的运行用户生效。

### 3. Logging Contract

- 应用默认不写容器内文件日志。
- `LOG_FILE` 默认值保持为空字符串。
- 默认 Compose 配置不再覆盖 `LOG_FILE` 为 `/app/logs/...` 文件路径。
- 默认部署通过 `docker compose logs api` 获取后端日志。

### 4. Health Endpoint Contract

- `/livez` 表示应用进程和路由系统可用，不依赖数据库。
- `/readyz` 表示 API 已准备好提供服务，必须校验数据库连通性。
- `/health` 作为兼容入口，语义与 `/readyz` 对齐。
- Compose healthcheck 指向 `http://127.0.0.1:8001/readyz`。

### 5. Verification Contract

- 保持应用启动 smoke test。
- 保持 `/livez`、`/readyz`、`/health` 的显式测试。
- 补齐 Compose 与 Docker 级验证，尤其是 named volume、migration gate 和日志出口。

## 关键设计决策

### 决策 A: 迁移与 API 分离

**状态**

- 已完成，保留为架构约束。

**完成证据**

- `backend/Dockerfile` 默认 `CMD` 不含 `alembic`。
- `docker-compose.yml` 存在单独的 `migrate` service。
- `migrate` 服务命令仅负责 migration。

### 决策 B: 默认持久化改为 named volume

**状态**

- 尚未完成，仍是本计划的主要剩余项。

**当前差距**

- `docker-compose.yml` 仍使用 `./data:/app/data` bind mount。

**完成标准**

- `docker-compose.yml` 定义 `volumes: skillhub-data:`。
- `api` 和 `migrate` 使用 `skillhub-data:/app/data`。
- 默认 Compose 中不再出现 `./data:/app/data`。

### 决策 C: 日志默认走 stdout/stderr

**状态**

- 应用层已完成，Compose 和文档层未完成。

**当前差距**

- `backend/config/settings.py` 已将 `LOG_FILE` 默认值设为空。
- `docker-compose.yml` 仍注入 `/app/logs/api.log` 并挂载 `./logs:/app/logs`。
- README 与部署文档仍把文件日志写成默认行为。

**完成标准**

- `docker-compose.yml` 不再注入 `/app/logs/...`。
- `docker-compose.yml` 不再挂载 `./logs:/app/logs`。
- 默认部署文档改为通过 `docker compose logs api` 查看日志。

### 决策 D: 明确健康检查语义

**状态**

- 已完成，保留为测试和部署契约。

**完成证据**

- `/livez` 在数据库故障时仍返回 `200`。
- `/readyz` 在数据库故障时返回 `503`。
- `/health` 在数据库故障时返回 `503`。
- Compose healthcheck 已指向 `/readyz`。

## 计划文件边界

### 已完成并已落地的主要文件

- `pyproject.toml`
- `uv.lock`
- `backend/Dockerfile`
- `backend/api_app.py`
- `backend/api/_endpoints.py`
- `backend/config/settings.py`
- `backend/.env.example`
- `tests/test_api_auth.py`
- `tests/test_app_startup.py`

### 本轮预计继续修改的文件

- `docker-compose.yml`
- `README.md`
- `README-zh.md`
- `docs/deployment.md`
- `docs/exec-plans/active/docker-healthcheck-standardization-plan.md`
- `docs/exec-plans/active/docker-healthcheck-standardization-tasks.md`

### 明确不改的文件

- `frontend/Dockerfile`
- 业务 API 路由路径
- SQLite 以外的数据库接入策略

## 里程碑状态

### Milestone 1: 修正运行时依赖并建立启动 smoke test

**状态：已完成**

- `email-validator` 已加入 runtime dependencies。
- `tests/test_app_startup.py` 已存在并覆盖应用启动路径。

### Milestone 2: 重构 backend image 运行职责

**状态：已完成**

- `backend/Dockerfile` 已创建 `skillhub` 用户。
- 默认命令仅运行 Uvicorn。

### Milestone 3: 重构 Compose 拓扑与持久化策略

**状态：进行中**

已完成：

- `migrate` service 已存在。
- `api` 已通过 `depends_on.migrate.condition=service_completed_successfully` 等待 migration 完成。
- `DATABASE_URL` 已使用容器内绝对路径 `/app/data/skillhub.db`。

待完成：

- 移除 `user: "1000:1000"`。
- 将 `./data` bind mount 改为 named volume。
- 删除 `./logs` bind mount 和文件日志注入。
- 在有 Docker 的环境中重新执行 Compose 验证。

### Milestone 4: 标准化健康检查端点

**状态：已完成**

- `/livez`、`/readyz`、`/health` 已实现。
- 测试已覆盖正常与数据库故障场景。
- Compose healthcheck 已指向 `/readyz`。

### Milestone 5: 文档与部署收口

**状态：未完成**

- `.env.example` 已与 stdout/stderr 默认值对齐。
- README 与部署文档尚未与目标 Compose 方案收口。

### Milestone 6: 端到端 Docker 验收

**状态：待执行**

- Python 级测试已经可通过。
- 仍需在具备 Docker 的环境中完成 `docker compose config`、migration、容器健康检查和日志出口验证。

## 全局验收标准

全部剩余里程碑完成后，必须同时满足以下条件：

1. `uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q` 返回成功。
2. `docker compose config` 返回成功。
3. 当 Docker 可用时：
   - `docker compose up -d --build migrate`
   - `docker compose up -d api webui`
   - `docker compose ps` 中 `api` 为 `healthy`
4. 容器内请求 `http://127.0.0.1:8001/readyz` 返回 `200`。
5. `docker compose logs api` 能直接看到后端日志，不依赖容器内日志文件。
6. README、中文 README 与部署文档不再把 `./data` / `./logs` bind mount 和文件日志写成默认方案。

## 风险与控制点

### 风险 1: 从 bind mount 切换到 named volume 时影响现有 SQLite 数据位置

**控制点**

- 文档必须明确数据迁移或保留策略。
- 如果保留 bind mount 作为覆盖场景，应在文档中写成显式可选方案，而不是默认方案。

### 风险 2: `service_completed_successfully` 在旧版 Compose 上兼容性不稳定

**控制点**

- 文档中保留 `docker compose run --rm migrate` 作为兼容启动方式。
- 默认方案仍优先采用独立 `migrate` 服务。

### 风险 3: 文档与仓库默认行为继续漂移

**控制点**

- 当 Compose 默认行为改变时，同步更新 `README.md`、`README-zh.md`、`docs/deployment.md`。
- 任务清单必须反映哪些项已经完成，避免后续执行者重复按旧背景判断。

## 退出条件

只有在以下条件都满足时，本计划才视为完成：

- Compose 默认启动链路不再依赖宿主机 `./data` / `./logs` 权限状态。
- Compose 不再覆盖镜像内已定义的后端运行用户。
- 默认日志出口为 stdout/stderr，且文档与实现一致。
- 健康检查失败时，仍可从 migration、数据库连通性或应用导入问题中快速定位原因。
- 完成后的计划和任务文件移入 `docs/exec-plans/completed/`，并更新对应索引。
