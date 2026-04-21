# Docker Runtime Validation Follow-up Plan

**Status:** Active, narrowed to final Docker runtime validation  
**Last reviewed:** 2026-04-21

**Goal:** Close the remaining Docker healthcheck standardization work by validating the production Compose stack in an environment that has Docker CLI access.

**Architecture baseline:** The production baseline is already aligned with the intended contract: the backend image runs as the dedicated `skillhub` user, migration remains a one-shot `migrate` service, production Compose uses the `skillhub-data` named volume, default logs go to stdout/stderr, and container health checks target `/readyz` while `/health` remains a compatibility endpoint.

**Tech Stack:** FastAPI, Uvicorn, Alembic, Docker, Docker Compose, SQLite, uv, pytest

---

## 当前状态

这项工作已经从“标准化改造”进入“最终验收尾项”阶段：

- 运行时依赖、启动 smoke test、非 root 镜像启动方式都已完成。
- `/livez`、`/readyz`、`/health` 的语义和测试覆盖都已完成。
- 生产 `docker-compose.yml` 已切换到 `skillhub-data:/app/data` named volume。
- 生产 `docker-compose.yml` 已移除后端服务的 `user` 覆盖，并保持日志默认走 stdout/stderr。
- `README.md`、`README-zh.md`、`docs/deployment.md` 已与生产 Compose 基线对齐，使用 `webui` 服务名，并把 bind mount + 文件日志明确为 dev overlay 行为。

当前唯一未关闭的范围是：在具备 Docker CLI 的环境中完成 Compose 解析、容器启动、健康检查和日志出口的最终运行时验收。

## 本轮目标

- 保留现有实现与文档结论，不再重复跟踪已完成的标准化改造项。
- 把 active 计划范围收敛到 Docker CLI 环境下的最终验证。
- 为后续执行者保留明确的命令、通过标准和关闭条件。

## 非目标

- 本轮不再改动生产 Compose 拓扑、日志策略或健康检查语义。
- 本轮不再重写 README、中文 README 或部署文档，除非 Docker 验收暴露出新的事实偏差。
- 本轮不引入新的数据库、编排层或 API 行为变更。

## 已完成基线

### 1. Runtime and Image Baseline

- `email-validator` 已进入 runtime dependencies。
- `tests/test_app_startup.py` 已能在测试阶段暴露应用导入失败。
- `backend/Dockerfile` 已改为 `skillhub` 非 root 用户，默认 `CMD` 只运行 Uvicorn。

### 2. Health and Logging Contract

- `/livez`、`/readyz`、`/health` 已实现，且 `/health` 与 readiness 语义对齐。
- `docker-compose.yml` 的 healthcheck 已指向 `http://127.0.0.1:8001/readyz`。
- `LOG_FILE` 默认值为空，默认部署日志出口为 stdout/stderr。

### 3. Production Compose and Documentation Baseline

- 生产 `docker-compose.yml` 已使用 `skillhub-data:/app/data` named volume。
- 生产 `docker-compose.yml` 已移除默认 `./logs` 挂载和 `LOG_FILE=/app/logs/...` 注入。
- `README.md`、`README-zh.md`、`docs/deployment.md` 已把 named volume 作为默认生产方案。
- `docker-compose.dev.yml` 仍保留 bind mount、`LOG_FILE=/app/logs/api.log` 和 UID/GID 覆盖，用于预发/调试场景；这不再属于生产默认问题。

## 剩余验证范围

### 验证 A: Compose Config

- 在具备 Docker CLI 的环境执行 `docker compose config`。
- 验证生产 Compose 配置可被成功解析。

### 验证 B: Migration and Service Bring-up

- 执行 `docker compose up -d --build migrate`，确认 `migrate` 成功退出且不重启。
- 执行 `docker compose up -d api webui`，确认 `api` 启动后进入 `healthy` 状态。

### 验证 C: Runtime Health and Logs

- 在容器内请求 `http://127.0.0.1:8001/readyz`，确认返回 `200`。
- 执行 `docker compose logs api --tail 50`，确认后端日志可直接从 Docker 读取，无需进入容器读取文件。

## 里程碑状态

### Milestone 1: 标准化改造实现

**状态：已完成**

- 后端镜像、Compose 拓扑、健康检查端点、日志默认值和文档基线均已落地。

### Milestone 2: 本地代码级验证

**状态：已完成**

- `uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q` 已于 2026-04-21 通过。

### Milestone 3: Docker 运行时最终验收

**状态：待执行**

- 当前执行环境没有 Docker CLI，尚无法关闭 `docker compose config`、容器启动、`readyz` 和日志出口验证。

## 全局验收标准

本 follow-up 关闭前，必须同时满足以下条件：

1. `uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q` 保持成功。
2. `docker compose config` 返回成功。
3. `docker compose up -d --build migrate` 成功完成，`migrate` 不进入重启循环。
4. `docker compose up -d api webui` 后，`docker compose ps` 中 `api` 为 `healthy`。
5. 容器内请求 `http://127.0.0.1:8001/readyz` 返回 `200`。
6. `docker compose logs api` 可直接读取后端日志，无需依赖容器内日志文件。

## 风险与控制点

### 风险 1: 运行时环境与文档基线不一致

**控制点**

- 如果 Docker 验收结果与当前文档不一致，先修正文档或实现，再关闭本计划。

### 风险 2: Compose 版本差异影响 `service_completed_successfully`

**控制点**

- 若目标环境对 `depends_on.condition=service_completed_successfully` 兼容性不足，保留 `docker compose run --rm migrate` 作为兼容启动路径并记录到文档。

## 退出条件

只有在 Docker CLI 环境下完成 Compose 解析、migration、服务健康和日志出口验证后，本计划才视为完成；完成后应将计划与任务文件移入 `docs/exec-plans/completed/`，并更新对应索引。
