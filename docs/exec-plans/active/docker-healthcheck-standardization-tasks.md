# Docker 健康检查规范化改造任务清单

## 执行规则

- 任何 Milestone 只有在“本阶段验收标准”全部满足后，才允许进入下一阶段。
- 如果某一步会改变运行时契约、Compose 行为或运维端点，测试和文档必须在同一阶段内同步更新。
- 所有验证命令都以“退出码为 0”作为最低通过门槛；如有额外状态码要求，以步骤中的完成标准为准。
- 如果当前执行环境没有 Docker，本地必须至少完成代码级与测试级验收；Compose 级验收保留到具备 Docker 的环境执行。

## Milestone 1: 修正运行时依赖并建立启动 smoke test

**目标**

- 让后端应用在最小运行时依赖下可导入、可创建 app。

**涉及文件**

- 修改 `pyproject.toml`
- 修改 `uv.lock`
- 新增 `tests/test_app_startup.py`

- [ ] 在 `pyproject.toml` 的 runtime dependencies 中增加 `email-validator`
  完成标准：`project.dependencies` 中明确存在 `email-validator`，且不放入 `dev` extras。

- [ ] 刷新 `uv.lock`
  建议命令：`uv lock`
  完成标准：`uv.lock` 中存在 `email-validator`，并包含其解析后的传递依赖。

- [ ] 新增 `tests/test_app_startup.py`
  完成标准：测试至少覆盖以下两个断言：
  1. `from backend.api_app import create_application` 不抛异常。
  2. `create_application()` 返回的 app 中包含 `/health` 路由。

- [ ] 运行启动 smoke test
  建议命令：`uv run pytest tests/test_app_startup.py -q`
  完成标准：测试通过，且不再出现 `email-validator is not installed` 类错误。

**本阶段验收标准**

- `pyproject.toml` 与 `uv.lock` 一致。
- `tests/test_app_startup.py` 通过。
- 后端应用导入失败这一类问题在测试阶段即可暴露。

## Milestone 2: 重构 backend image 运行职责

**目标**

- 让镜像默认只运行 API 进程，迁移不再混入容器启动命令。

**涉及文件**

- 修改 `backend/Dockerfile`

- [ ] 在 `backend/Dockerfile` 中创建专用低权限用户
  完成标准：Dockerfile 中存在显式用户创建步骤和 `USER <non-root-user>` 指令；运行用户不再依赖 Compose 传入的固定 UID/GID。

- [ ] 在镜像中预创建运行时目录
  完成标准：Dockerfile 明确创建 `/app/data`、`/tmp/uv-cache`、`/tmp/.cache` 等运行时目录，并赋予运行用户可写权限。

- [ ] 将默认 `CMD` 改为只运行 `uvicorn`
  完成标准：Dockerfile 默认 `CMD` 不再包含 `alembic`、`&&` 或迁移逻辑。

- [ ] 检查镜像启动职责是否单一
  完成标准：从 Dockerfile 文本上可以明确读出“镜像启动即 API 服务启动”，不存在迁移、副作用脚本或日志目录初始化的额外职责。

**本阶段验收标准**

- `backend/Dockerfile` 默认命令只有 API 进程。
- 运行用户在镜像层定义，而不是 Compose 层补丁。

## Milestone 3: 重构 Compose 拓扑与持久化策略

**目标**

- 让默认 Compose 部署不依赖宿主机目录权限，迁移与 API 启动解耦。

**涉及文件**

- 修改 `docker-compose.yml`

- [ ] 新增 `migrate` one-shot service
  完成标准：`docker-compose.yml` 中存在独立 `migrate` service，命令只执行 Alembic migration，成功后退出。

- [ ] 让 `api` 服务不再运行 migration
  完成标准：`api` service 的 command 或 image 默认行为中不包含 migration。

- [ ] 为 `api` 定义 migration 完成后的启动门控
  完成标准：以下两项至少满足一项，且必须在文档中写明：
  1. `api.depends_on.migrate.condition=service_completed_successfully`
  2. 明确要求先执行 `docker compose run --rm migrate` 或 `docker compose up -d migrate`，再启动 `api`

- [ ] 移除 `user: "1000:1000"`
  完成标准：Compose 文件中不再通过固定 UID/GID 控制后端运行用户。

- [ ] 将 SQLite 存储改为 named volume
  完成标准：
  1. `docker-compose.yml` 定义形如 `skillhub-data:` 的顶级 volume。
  2. `api` 和 `migrate` 都挂载该 named volume 到 `/app/data`。
  3. 默认配置中不再出现 `./data:/app/data`。

- [ ] 删除默认文件日志挂载
  完成标准：
  1. `api` service 不再挂载 `./logs:/app/logs`
  2. `api` service 不再注入 `LOG_FILE=/app/logs/...`

- [ ] 将 `DATABASE_URL` 固定为容器内绝对路径
  完成标准：Compose 中 SQLite URL 使用 `/app/data/skillhub.db`，不依赖 `./data/skillhub.db` 这类相对路径。

- [ ] 校验 Compose 配置可解析
  建议命令：`docker compose config`
  完成标准：命令成功，输出中包含 `migrate` service 和 named volume 定义。

**本阶段验收标准**

- 默认 Compose 启动链路不依赖宿主机 `./data` / `./logs` 目录。
- 迁移与 API 启动职责已经拆开。
- `docker compose config` 通过。

## Milestone 4: 标准化健康检查端点与状态语义

**目标**

- 把存活探测和就绪探测分离，并保留 `/health` 的兼容入口。

**涉及文件**

- 修改 `backend/api_app.py`
- 修改 `docker-compose.yml`
- 修改 `tests/test_api_auth.py`

- [ ] 在后端新增 `/livez`
  完成标准：端点返回 `200`，且不依赖数据库连通性。

- [ ] 在后端新增 `/readyz`
  完成标准：端点在数据库可用时返回 `200`，数据库不可用时返回 `503`。

- [ ] 保留 `/health` 并对齐 readiness 语义
  完成标准：`/health` 不删除，状态码行为与 `/readyz` 一致。

- [ ] 更新现有测试
  完成标准：`tests/test_api_auth.py` 至少覆盖：
  1. `/livez` 正常返回 `200`
  2. `/readyz` 正常返回 `200`
  3. 数据库故障时 `/readyz` 返回 `503`
  4. 数据库故障时 `/health` 返回 `503`

- [ ] 更新 Compose healthcheck
  完成标准：`docker-compose.yml` 的 `api.healthcheck.test` 改为请求 `http://127.0.0.1:8001/readyz`

- [ ] 运行后端健康检查相关测试
  建议命令：`uv run pytest tests/test_api_auth.py -q`
  完成标准：所有 `/livez`、`/readyz`、`/health` 相关用例通过。

**本阶段验收标准**

- liveness / readiness / compatibility 三个语义明确分离。
- Compose 健康检查命中 readiness 而不是兼容端点。

## Milestone 5: 日志默认行为与配置收口

**目标**

- 让默认运行模式遵循容器日志最佳实践。

**涉及文件**

- 修改 `backend/config/settings.py`
- 修改 `backend/.env.example`

- [ ] 将 `LOG_FILE` 默认值改为空字符串
  完成标准：`backend/config/settings.py` 中 `LOG_FILE` 默认值不再是 `/var/log/...` 之类的文件路径。

- [ ] 校正 `.env.example` 注释
  完成标准：`backend/.env.example` 明确说明空值表示输出到 stdout/stderr，Docker 默认即采用该模式。

- [ ] 检查代码是否仍依赖容器内日志文件目录
  完成标准：默认启动路径不再要求 `/app/logs` 存在。

**本阶段验收标准**

- 默认运行模式下，无需创建日志目录即可启动应用。
- 文件日志成为显式选择，而不是默认行为。

## Milestone 6: 文档与部署流程收口

**目标**

- 让 README 和部署文档与新架构保持一致。

**涉及文件**

- 修改 `README.md`
- 修改 `README-zh.md`
- 修改 `docs/deployment.md`

- [ ] 更新 README 英文 quickstart
  完成标准：不再把“`docker compose up -d --build` 直接完成所有工作”写成唯一事实；需明确 migration-first 或 one-shot migrate service 的实际启动方式。

- [ ] 更新 README 中文 quickstart
  完成标准：与英文 README 保持一致，不再暗示 `./logs` / `./data` bind mount 是默认方案。

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

- [ ] 运行后端最小回归测试
  建议命令：`uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q`
  完成标准：退出码为 0。

- [ ] 校验 Compose 配置
  建议命令：`docker compose config`
  完成标准：退出码为 0。

- [ ] 当 Docker 可用时执行 migration
  建议命令：`docker compose up -d --build migrate`
  完成标准：`migrate` 成功退出，不进入重启循环。

- [ ] 当 Docker 可用时启动 `api` 和 `frontend`
  建议命令：`docker compose up -d api frontend`
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

- `email-validator` 依赖缺失问题被正式修复。
- API 容器默认只运行 Uvicorn。
- 数据迁移是独立 one-shot 流程。
- 默认 Compose 使用 named volume，而不是 `./data` / `./logs` bind mount。
- `/livez`、`/readyz`、`/health` 语义明确且有测试覆盖。
- 默认日志出口为 stdout/stderr。
- 文档、测试、Compose 行为一致。
