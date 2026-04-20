# Backend 收口型重构任务（v3）

> 对齐文档：`backend-consolidation-refactor-plan.md`
> 修订日期：2026-04-20

## Milestone 1: 错误与响应收口

- [x] 新建 `backend/core/errors.py`，提取共享错误元数据 helper：UTC 时间戳、状态码到默认 code 的映射、基础 payload 构造。
- [x] 将 `backend/api_app.py` 的 `_error_payload()` / `_error_payload_from_exception()` 改为复用共享 helper，保留为 HTTP adapter。
- [x] 将 `backend/core/utils/skill_storage.py` 的 `tool_error_payload()` 改为复用共享 helper，保留为 tool/MCP adapter。
- [x] 去重 `backend/api/v1/auth.py` 与 `backend/api/v1/users.py` 中重复的 `_verification_error_messages` + `_verification_error_payload()`。
- [x] 将 `backend/api/v1/skills_support.py` 中 5 个基于字符串内容的兼容判断收口到专用 mapper，并明确标注为 compat 逻辑。
- [x] 明确保持 `users.delete_me()` 当前原始字符串错误 detail 语义不变，不借本 milestone 顺手统一。
- [x] 运行最小回归：`uv run pytest tests/test_api_auth.py tests/test_api_auth_extended.py tests/test_users_api.py tests/test_skill_support.py tests/test_api_skill_download.py`

## Milestone 2: skills API 边界收口

- [x] 将 `backend/api/v1/skills_support.py` 从单文件演进为 package：`backend/api/v1/skills_support/`。
- [x] 在 `backend/api/v1/skills_support/__init__.py` 中统一 re-export 当前对外使用的 helper，优先保持 import 路径稳定。
- [x] 按职责拆出子模块：`service_factory.py`、`serializer.py`、`upload.py`、`download.py`、`audit.py`、`auth.py`、`error_mapper.py`。
- [x] 更新 `backend/api/v1/skills.py` 的导入，确保只依赖 package 暴露面，不直接耦合内部子模块实现细节。
- [x] 删除旧的单文件 `backend/api/v1/skills_support.py`。
- [x] 保持 `skills` 路由行为、响应 schema、审计动作名不变。
- [x] 运行最小回归：`uv run pytest tests/test_api_skills.py tests/test_skills_api_extended.py tests/test_api_skill_download.py tests/test_skill_support.py`

## Milestone 3: SkillService 主体拆分

- [x] 为 `backend/services/skill.py` 设计内部协作边界，优先按 lifecycle、storage、version、upload 四类职责拆分。
- [x] 拆出 `skill_lifecycle.py`，承载 create / update / activate / deactivate / delete / visibility / kind 判定。
- [x] 拆出 `skill_storage.py`，承载 `list_skill_files` / `read_skill_file` / `upload_file` / `upload_file_from_path`。
- [x] 拆出 `skill_version.py`，承载 version 解析、reference、pin、unpin、rollback、diff 等逻辑。
- [x] 拆出 `skill_upload.py`，承载 zip 上传、版本目录准备、归档持久化、依赖解析流程。
- [x] 删除 `SkillService` 中纯转发 `skill_support.py` 的静态代理方法，如 `_parse_frontmatter`、`_validate_version`、`_normalize_dependencies`、`_parse_requirements_text`。
- [x] 保留 `SkillService` 作为外部门面，不改公开方法签名。
- [x] 运行最小回归：`uv run pytest tests/test_skill_service.py tests/test_skill_service_file_ops.py tests/test_skill_service_more.py tests/test_skill_service_advanced.py tests/test_skill_service_integration.py`

## Milestone 4: legacy / fallback 残留集中化

- [ ] 将 `backend/repositories/skill.py` 中 `list_cloned_source_ids()` 的 legacy fallback 提取为显式命名的私有方法，例如 `_list_cloned_source_ids_legacy_fallback()`。
- [ ] 保证主流程优先走 `cloned_from_skill_id` 新字段路径，仅在需要时进入 fallback。
- [ ] 为仍需保留的兼容路径增加清晰命名或独立 helper，避免继续混在主流程里。
- [ ] 运行最小回归：`uv run pytest tests/test_api_skills.py tests/test_skills_api_extended.py tests/test_skill_service_integration.py`

## Milestone 5: app 组装层精简

- [ ] 拆出 `backend/api/_middleware.py`，承载中间件注册。
- [ ] 拆出 `backend/api/_exceptions.py`，承载异常处理器注册。
- [ ] 拆出 `backend/api/_endpoints.py`，承载 `/livez`、`/readyz`、`/health`、`/metrics`。
- [ ] 拆出 `backend/api/_size_guard.py`，承载请求大小限制中间件。
- [ ] 将 `backend/api_app.py` 收敛为 `create_application()`、`lifespan` 与最少量装配代码。
- [ ] 保持 app 创建入口、挂载路径、4 个运维端点语义不变。
- [ ] 检查导入关系，避免新增循环依赖。
- [ ] 运行最小回归：`uv run pytest tests/test_api_auth.py tests/test_api_auth_extended.py tests/test_app_startup.py tests/test_request_metrics.py tests/test_metrics_cleanup_api.py tests/test_metrics_reset_24h_api.py tests/test_api_skill_download.py`

## Milestone 6: 收尾校验

- [ ] 搜索 `legacy` / `fallback` / 重复错误构造是否仍散落在主流程。
- [ ] 搜索未再使用的 helper、mapper、compat 分支并删除死代码。
- [ ] 运行收尾回归：`uv run pytest tests/test_api_auth.py tests/test_api_auth_extended.py tests/test_users_api.py tests/test_api_skills.py tests/test_skills_api_extended.py tests/test_api_skill_download.py tests/test_skill_service.py tests/test_skill_service_file_ops.py tests/test_skill_service_more.py tests/test_skill_service_advanced.py tests/test_skill_service_integration.py tests/test_app_startup.py tests/test_request_metrics.py tests/test_metrics_cleanup_api.py tests/test_metrics_reset_24h_api.py`
- [ ] 运行静态检查：`uv run ruff check backend tests`
- [ ] 输出“未动行为清单”，明确哪些外部行为被刻意保持不变。
- [ ] 输出“仍保留的兼容点清单”，明确哪些 legacy / compat 逻辑本轮是有意保留的。
