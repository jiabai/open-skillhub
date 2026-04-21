# Docker 运行时最终验收任务清单

**状态说明**

- 本清单已按 2026-04-21 的仓库现状收敛为 follow-up 验收任务。
- 标准化改造本身已经完成；当前只保留 Docker CLI 环境下的最终运行时验证。
- 当前执行环境没有 `docker` 命令，因此未完成项必须留待具备 Docker 的环境执行。

## 已完成基线

- [x] 运行时依赖与启动 smoke test 已完成并通过
- [x] 后端镜像已切换为 `skillhub` 非 root 用户且默认只运行 Uvicorn
- [x] 生产 `docker-compose.yml` 已使用 `skillhub-data` named volume
- [x] 生产 `docker-compose.yml` 已移除默认 `user` 覆盖、文件日志挂载与 `LOG_FILE=/app/logs/...` 注入
- [x] `/livez`、`/readyz`、`/health` 语义与测试覆盖已完成
- [x] `README.md`、`README-zh.md`、`docs/deployment.md` 已与生产 Compose 基线对齐
- [x] `uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q` 于 2026-04-21 返回成功

## 剩余任务

### 1. Compose 配置解析

- [ ] 在具备 Docker CLI 的环境执行 `docker compose config`
  完成标准：命令退出码为 `0`，且生产 Compose 配置可成功解析。

### 2. Migration 验证

- [ ] 在具备 Docker CLI 的环境执行 `docker compose up -d --build migrate`
  完成标准：`migrate` 成功退出，不进入重启循环。

### 3. API 与 WebUI 启动验证

- [ ] 在具备 Docker CLI 的环境执行 `docker compose up -d api webui`
  完成标准：`docker compose ps` 中 `api` 状态为 `healthy`。

### 4. Readiness 验证

- [ ] 在具备 Docker CLI 的环境执行  
  `docker compose exec api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/readyz', timeout=5).read().decode())"`
  完成标准：命令成功返回，HTTP 状态为 `200`。

### 5. 日志出口验证

- [ ] 在具备 Docker CLI 的环境执行 `docker compose logs api --tail 50`
  完成标准：日志可直接从 Docker 读取，不需要进入容器读取文件。

## 完成定义

只有当以下条件全部满足时，本 follow-up 才算完成：

- 代码级验证保持通过。
- Compose 配置可解析。
- `migrate` 能独立成功完成。
- `api` 启动后进入 `healthy`。
- `readyz` 返回 `200`。
- 后端日志可直接通过 `docker compose logs api` 获取。

完成后，将本任务清单与配套计划一起移入 `docs/exec-plans/completed/`，并更新 active/completed 索引。
