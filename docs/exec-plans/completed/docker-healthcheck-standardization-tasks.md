# Docker 运行时最终验收任务清单

**状态说明**

- 本清单已于 2026-04-21 完成归档。
- 标准化改造与 Docker CLI 环境下的最终运行时验证均已完成。

## 已完成事项

- [x] 运行时依赖与启动 smoke test 已完成并通过
- [x] 后端镜像已切换为 `skillhub` 非 root 用户且默认只运行 Uvicorn
- [x] 生产 `docker-compose.yml` 已使用 `skillhub-data` named volume
- [x] 生产 `docker-compose.yml` 已移除默认 `user` 覆盖、文件日志挂载与 `LOG_FILE=/app/logs/...` 注入
- [x] `/livez`、`/readyz`、`/health` 语义与测试覆盖已完成
- [x] `README.md`、`README-zh.md`、`docs/deployment.md` 已与生产 Compose 基线对齐
- [x] `uv run pytest tests/test_app_startup.py tests/test_api_auth.py -q` 于 2026-04-21 返回成功
- [x] `docker compose config` 于 2026-04-21 返回成功
- [x] `docker compose up -d --build migrate` 于 2026-04-21 验证通过，`migrate` 退出码为 `0`
- [x] `docker compose up -d --build api webui` 于 2026-04-21 验证通过，`api` 状态为 `healthy`
- [x] 容器内 `GET /readyz` 于 2026-04-21 返回 `200`
- [x] `docker compose logs api --tail 50` 于 2026-04-21 验证通过，可直接读取后端日志

## 完成定义

本 follow-up 已满足全部关闭条件：

- 代码级验证通过。
- Compose 配置可解析。
- `migrate` 能独立成功完成。
- `api` 启动后进入 `healthy`。
- `readyz` 返回 `200`。
- 后端日志可直接通过 `docker compose logs api` 获取。

## 归档说明

- 本任务清单与配套计划已从 `docs/exec-plans/active/` 移至 `docs/exec-plans/completed/`。
- 如果未来重新打开同类问题，应创建新的 active plan，而不是改写本归档记录。
