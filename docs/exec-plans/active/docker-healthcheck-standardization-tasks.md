# Docker 健康检查规范化改造任务清单

**状态说明**

- 本任务清单已按 2026-04-21 的仓库现状回写。
- 已完成项直接勾选，未完成项保留为后续执行入口。
- 当前 Python 级验证已完成；Docker 级验证仍待在具备 Docker 的环境执行。

## 执行规则

- 任何 Milestone 只有在“本阶段验收标准”全部满足后，才允许进入下一阶段。
- 如果某一步会改变运行时契约、Compose 行为或运维端点，测试和文档必须在同一阶段内同步更新。
- 所有验证命令都以“退出码为 0”作为最低通过门槛；如有额外状态码要求，以步骤中的完成标准为准。
- 如果当前执行环境没有 Docker，本地至少完成代码级与测试级验收；Compose 级验收保留到具备 Docker 的环境执行。

## Milestone 1: 修正运行时依赖并建立启动 smoke test

**目标**

- 让后端应用在最小运行时依赖下可导入、可创建 app。

**涉及文件**

- `pyproject.toml`
- `uv.lock`
- `tests/test_app_startup.py`

- [x] 在 `pyproject.toml` 的 runtime dependencies 中增加 `email-validator`
  完成证据：`email-validator` 已存在于 `project.dependencies`。

- [x] 刷新 `uv.lock`
  完成证据：锁文件已包含 `email-validator` 及其解析依赖。

- [x] 新增 `tests/test_app_startup.py`
  完成证据：测试已覆盖 `create_application()` 和运维路由注册。

- [x] 运行启动 smoke test
  完成证据：`uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q` 于 2026-04-21 通过。

**本阶段验收标准**

- `pyproject.toml` 与 `uv.lock` 一致。
- `tests/test_app_startup.py` 已通过。
- 后端应用导入失败这一类问题可以在测试阶段暴露。

## Milestone 2: 重构 backend image 运行职责

**目标**

- 让镜像默认只运行 API 进程，迁移不再混入容器启动命令。

**涉及文件**

- `backend/Dockerfile`

- [x] 在 `backend/Dockerfile` 中创建专用低权限用户
  完成证据：Dockerfile 已创建 `skillhub` 用户并设置 `USER skillhub`。

- [x] 在镜像中预创建运行时目录
  完成证据：Dockerfile 已创建 `/app/data`、`/tmp/uv-cache`、`/tmp/.cache` 并赋权。

- [x] 将默认 `CMD` 改为只运行 `uvicorn`
  完成证据：默认 `CMD` 不再包含 `alembic` 或串联命令。

- [x] 检查镜像启动职责是否单一
  完成证据：镜像启动即 API 服务启动；迁移已留在独立 Compose service。

**本阶段验收标准**

- `backend/Dockerfile` 默认命令只有 API 进程。
- 镜像层已具备非 root 运行用户。
- Compose 层剩余的 `user: "1000:1000"` 覆盖转入 Milestone 3 处理。

## Milestone 3: 重构 Compose 拓扑与持久化策略

**目标**

- 让默认 Compose 部署不依赖宿主机目录权限，迁移与 API 启动解耦。

**涉及文件**

- `docker-compose.yml`

- [x] 新增 `migrate` one-shot service
  完成证据：`docker-compose.yml` 中已存在独立 `migrate` service，命令仅执行 Alembic migration。

- [x] 让 `api` 服务不再运行 migration
  完成证据：`api` service 未单独声明 migration 命令，镜像默认行为仅启动 Uvicorn。

- [x] 为 `api` 定义 migration 完成后的启动门控
  完成证据：`api.depends_on.migrate.condition=service_completed_successfully` 已存在。

- [x] 移除 `user: "1000:1000"`（生产环境）
  完成证据：`docker-compose.yml` 已移除 `user` 覆盖，由 Dockerfile `USER skillhub` 生效。
  说明：`docker-compose.dev.yml` 保留 `user: "1000:1000"` 用于预发环境 bind mount 权限兼容。

- [x] 将 SQLite 存储改为 named volume（生产环境）
  完成标准：
  1. `docker-compose.yml` 定义 `skillhub-data:` 顶级 volume。
  2. `api` 和 `migrate` 都挂载该 named volume 到 `/app/data`。
  3. 默认配置中不再出现 `./data:/app/data`。
  说明：`docker-compose.dev.yml` 保留 `./data:/app/data` bind mount 用于预发环境调试。

- [x] 删除默认文件日志挂载（生产环境）
  完成标准：
  1. `docker-compose.yml` 中 `api` service 不再挂载 `./logs:/app/logs`
  2. `docker-compose.yml` 中 `api` service 不再注入 `LOG_FILE=/app/logs/...`
  说明：`docker-compose.dev.yml` 保留日志 bind mount 用于预发环境调试。

- [x] 将 `DATABASE_URL` 固定为容器内绝对路径
  完成证据：Compose 中已使用 `/app/data/skillhub.db`。

- [ ] 校验 Compose 配置可解析
  建议命令：`docker compose config`
  当前状态：本工作区无 `docker` 命令，待在具备 Docker 的环境执行。

**本阶段验收标准**

- `docker-compose.yml`（生产）不再依赖宿主机 `./data` / `./logs` 目录，使用 named volume。
- `docker-compose.dev.yml`（预发）保留 bind mount 用于调试，配合 `user: "1000:1000"` 保证权限一致。
- 迁移与 API 启动职责已经拆开。
- `docker compose config` 通过。

## Milestone 4: 标准化健康检查端点与状态语义

**目标**

- 把存活探测和就绪探测分离，并保留 `/health` 的兼容入口。

**涉及文件**

- `backend/api_app.py`
- `backend/api/_endpoints.py`
- `docker-compose.yml`
- `tests/test_api_auth.py`

- [x] 在后端新增 `/livez`
  完成证据：端点已实现，测试覆盖返回 `200`。

- [x] 在后端新增 `/readyz`
  完成证据：端点已实现，数据库故障时测试覆盖返回 `503`。

- [x] 保留 `/health` 并对齐 readiness 语义
  完成证据：`/health` 已保留，数据库故障时返回 `503`。

- [x] 更新现有测试
  完成证据：`tests/test_api_auth.py` 已覆盖 `/livez`、`/readyz`、`/health` 的正常与故障场景。

- [x] 更新 Compose healthcheck
  完成证据：`api.healthcheck.test` 已请求 `http://127.0.0.1:8001/readyz`。

- [x] 运行后端健康检查相关测试
  完成证据：`uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q` 于 2026-04-21 通过。

**本阶段验收标准**

- liveness / readiness / compatibility 三个语义明确分离。
- Compose 健康检查命中 readiness 而不是兼容端点。

## Milestone 5: 日志默认行为与配置收口

**目标**

- 让默认运行模式遵循容器日志最佳实践。

**涉及文件**

- `backend/config/settings.py`
- `backend/.env.example`
- `docker-compose.yml`

- [x] 将 `LOG_FILE` 默认值改为空字符串
  完成证据：`backend/config/settings.py` 中 `LOG_FILE` 默认值已为空。

- [x] 校正 `.env.example` 注释
  完成证据：`.env.example` 已说明空值表示输出到 stdout/stderr。

- [ ] 检查仓库默认启动路径是否仍依赖容器内日志文件目录
  完成标准：默认 Compose 不再要求 `/app/logs` 存在，且不再把文件日志写成默认路径。

**本阶段验收标准**

- 默认运行模式下，无需创建日志目录即可启动应用。
- 文件日志成为显式选择，而不是默认行为。

## Milestone 6: 文档与部署流程收口

**目标**

- 让 README 和部署文档与目标架构保持一致。

**涉及文件**

- `README.md`
- `README-zh.md`
- `docs/deployment.md`

- [ ] 更新 README 英文 quickstart
  完成标准：不再把 `./data` / `./logs` bind mount 和文件日志写成默认方案，并保留 migration-first 启动方式。

- [ ] 更新 README 中文 quickstart
  完成标准：与英文 README 保持一致，并使用实际服务名 `webui`。

- [ ] 更新部署文档中的验证命令
  完成标准：文档中明确包含：
  1. migration 执行方式
  2. `docker compose config`
  3. `docker compose ps`
  4. 容器内请求 `readyz` 的验证方式
  5. 查看 `docker compose logs api` 的日志方式

- [ ] 更新部署文档中的持久化说明
  完成标准：默认 SQLite 存储说明改为 named volume，而不是仓库根目录 bind mount。

**本阶段验收标准**

- 新用户只看文档即可按正确顺序启动。
- 文档描述与实际 Compose 行为一致。

## Milestone 7: 端到端回归验收

**目标**

- 用统一命令验证代码、Compose 和容器运行状态。

**涉及文件**

- 无新增文件；执行验证命令并记录结果

- [x] 运行后端最小回归测试
  完成证据：`uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q` 于 2026-04-21 返回成功。

- [ ] 校验 Compose 配置
  建议命令：`docker compose config`
  当前状态：当前执行环境无 Docker CLI。

- [ ] 当 Docker 可用时执行 migration
  建议命令：`docker compose up -d --build migrate`
  完成标准：`migrate` 成功退出，不进入重启循环。

- [ ] 当 Docker 可用时启动 `api` 和 `webui`
  建议命令：`docker compose up -d api webui`
  完成标准：`docker compose ps` 中 `api` 状态为 `healthy`。

- [ ] 当 Docker 可用时验证 readiness
  建议命令：`docker compose exec api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/readyz', timeout=5).read().decode())"`
  完成标准：命令成功返回，HTTP 状态为 `200`。

- [ ] 当 Docker 可用时验证日志出口
  建议命令：`docker compose logs api --tail 50`
  完成标准：日志可直接从 Docker 读取，不需要进入容器读取文件。

**本阶段验收标准**

- 代码级、Compose 级、容器级三条验证链路全部通过。
- Docker 健康检查成功的前提条件和失败原因都可直接定位。

## 最终完成定义

只有当以下条件全部满足时，本任务才算完成：

- `email-validator` 依赖缺失问题已保持修复状态。
- API 容器默认只运行 Uvicorn。
- 数据迁移是独立 one-shot 流程。
- 默认 Compose 使用 named volume，而不是 `./data` / `./logs` bind mount。
- `/livez`、`/readyz`、`/health` 语义明确且有测试覆盖。
- 默认日志出口为 stdout/stderr。
- 文档、测试、Compose 行为一致。
