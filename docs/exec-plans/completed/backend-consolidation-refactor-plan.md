# Backend 收口型重构计划（v3）

> 修订日期：2026-04-20
> 状态：active

## Summary

目标是在 **不改变对外行为、不调整接口语义、不引入新能力** 的前提下，针对 `backend` 做一次“收口型”重构：减少重复实现、压缩兼容残留、收窄边界职责、拆分过大的聚合文件。

这份计划是对 v2 的刷新版，重点修正三类问题：

- 基线信息过时：文件行数、模块体量、现有测试入口都需要以当前仓库快照为准。
- 结构命名不安全：原计划里的 `api/v1/skills/` 会与现有 `api/v1/skills.py` 冲突。
- 验收不够落地：需要把“行为不变”的说法落到现有测试文件和明确的非目标上。

## Current Snapshot

以下基线以 2026-04-20 当前仓库内容为准：

| 位置 | 当前体量 / 状态 | 观察 |
|------|------------------|------|
| `backend/api_app.py` | 178 行 | 同时承担错误载荷、健康检查、中间件注册、运维端点、请求大小保护、异常处理器、lifespan、应用工厂 |
| `backend/api/v1/skills_support.py` | 259 行 | 混合了服务工厂、序列化、上传辅助、下载限流、审计、可选认证、错误映射、下载请求处理 |
| `backend/services/skill.py` | 944 行 | 仍是 backend 中最显著的聚合服务文件之一 |
| `backend/repositories/skill.py` | `list_cloned_source_ids()` 内含 legacy fallback | 新路径与旧 metadata fallback 仍混在同一主流程 |
| `backend/api/v1/auth.py` + `backend/api/v1/users.py` | 验证码错误映射重复 | `_verification_error_messages` 与 `_verification_error_payload()` 基本重复 |

当前已经存在可直接复用的测试入口，包括但不限于：

- `tests/test_api_auth.py`
- `tests/test_api_auth_extended.py`
- `tests/test_users_api.py`
- `tests/test_api_skills.py`
- `tests/test_skills_api_extended.py`
- `tests/test_api_skill_download.py`
- `tests/test_skill_service.py`
- `tests/test_skill_service_file_ops.py`
- `tests/test_skill_support.py`

## Scope

本次只做“结构收口”，不做产品语义调整。

纳入范围：

- 共享错误构造辅助的去重与边界适配层收口
- `skills` API 辅助层拆分
- `SkillService` 内部协作对象拆分
- repo 层兼容 fallback 的集中化
- app composition 层瘦身

不纳入范围：

- FastAPI 路由路径、HTTP 方法、响应 schema 字段调整
- 权限语义、鉴权策略、JWT/API token 行为调整
- 新 feature、新配置项、新 runtime contract
- 借重构顺手统一原本不一致但已对外可观察的错误形态

特别说明：

- `users.delete_me()` 当前仍返回原始字符串错误 detail；本次不顺手将其改成验证码结构化错误，除非后续有单独 spec 或明确批准。
- `/livez`、`/readyz`、`/health`、`/metrics` 都属于现有运维入口；app composition 拆分时必须一起保留并回归，不只关注 `/health` 和 `/metrics`。

## Key Changes

### 1. 统一错误响应与边界异常映射

当前代码中有三类独立的错误构造逻辑，各自职责不同，但存在去重空间：

| 位置 | 函数 | 用途 | 返回类型 |
|------|------|------|----------|
| `backend/api_app.py` | `_error_payload()` / `_error_payload_from_exception()` | HTTP API 全局异常处理器 | `dict` |
| `backend/core/utils/skill_storage.py` | `tool_error_payload()` | MCP/tool 输出错误 | `str`（JSON） |
| `backend/api/v1/auth.py` + `backend/api/v1/users.py` | `_verification_error_messages` + `_verification_error_payload()` | 验证码错误码到中文消息的映射 | `dict` |

需要做的事：

- 提取 `backend/core/errors.py` 作为共享错误元数据 helper，封装时间戳生成、状态码到默认 code 的映射、以及基础 payload 构造。
- `api_app.py` 和 `skill_storage.py` 仍各自保留为 transport adapter；前者输出 `dict`，后者输出 JSON 字符串，但共用底层 helper。
- 将 `auth.py` / `users.py` 中完全重复的验证码消息映射提取到单点定义；保持现有错误码和中文文案不变。
- 将 `skills_support.handle_skill_value_error()` 中基于字符串内容的兼容判断收口到专用 mapper，明确标记为“兼容旧 service 异常”的过渡层，而不是继续散落在路由辅助代码里。

### 2. 缩减 skills 领域的“边界杂物间”

`backend/api/v1/skills_support.py` 当前 259 行，混合了 7 类以上职责：错误映射、服务工厂、序列化、认证辅助、上传辅助、下载限流、审计辅助、下载请求处理。

需要做的事：

- 不再使用 v2 中提议的 `api/v1/skills/` 路径，因为它会与现有 `backend/api/v1/skills.py` 冲突。
- 将 `skills_support.py` 演进为 package：`backend/api/v1/skills_support/`，通过 `__init__.py` 统一 re-export，尽量降低 `skills.py` 改动面。
- 建议的子模块边界如下：
  - `service_factory.py` - `build_skill_service()`
  - `serializer.py` - `serialize_skill()` / `serialize_public_skill()`
  - `upload.py` - `stream_upload_to_temp_file()`
  - `download.py` - `enforce_download_rate_limit()` / `handle_skill_download_request()`
  - `audit.py` - `create_audit_event()`
  - `auth.py` - `get_optional_current_user()`
  - `error_mapper.py` - `handle_skill_value_error()` / `_SKILL_ERROR_RESPONSES` / `_build_http_exception()`
- `backend/api/v1/skills.py` 仍只承担请求解析、依赖声明、调用 service、返回 schema；不再直接承担临时文件流转、限流状态、审计拼装等混合职责。

### 3. 拆分 `SkillService` 主体

`backend/services/skill.py` 当前 944 行，仍是一个过大的聚合服务。

需要做的事：

- 以行为边界继续拆出内部协作组件：
  - `skill_lifecycle.py` - create / update / activate / deactivate / delete / visibility / kind 判定
  - `skill_storage.py` - `list_skill_files` / `read_skill_file` / `upload_file` / `upload_file_from_path`
  - `skill_version.py` - `_resolve_version_and_record` / `resolve_version_dir` / `list_versions` / `get_version` / `pin_reference_version` / `unpin_reference_version` / `rollback_version` / `diff_versions`
  - `skill_upload.py` - `upload_zip` / `upload_zip_create_skill` 及其归档、版本目录准备、依赖解析
- `SkillService` 保留为外部门面，继续提供现有公开方法签名，内部委托给更小的协作对象。
- 删除 `SkillService` 中仅用于转发 `skill_support.py` 函数的冗余静态代理方法，例如 `_parse_frontmatter`、`_validate_version`、`_normalize_dependencies`、`_parse_requirements_text`。
- 允许保留少量真正有聚合作用的共享私有方法，例如加密、checksum、需要跨协作对象复用的极小型 helper；本轮目标是压缩职责，不是为了文件行数机械拆碎。

### 4. 清理兼容残留与 repo 层 legacy 查询

当前 `backend/repositories/skill.py` 的 `list_cloned_source_ids()` 在主路径为空时直接内联旧 metadata fallback。

需要做的事：

- 将 legacy fallback 隔离为显式命名的私有方法，如 `_list_cloned_source_ids_legacy_fallback()`。
- 主流程优先走 `cloned_from_skill_id` 新字段路径，仅在需要时调用 legacy fallback。
- 只删除“已无调用点”或“已被新字段完全覆盖”的兼容辅助；仍有线上意义的兼容逻辑保留，但集中放在显式 `legacy` / `compat` 命名的函数或模块中。

### 5. 收紧 API 组装层

`backend/api_app.py` 当前 178 行，为单一文件，包含错误载荷构造、DB 健康检查、中间件注册、路由注册、`/livez`、`/readyz`、`/health`、`/metrics`、请求大小限制中间件、全局异常处理器、lifespan、应用工厂。

需要做的事：

- 拆成更薄的 app composition 层：
  - `backend/api/_middleware.py` - 中间件注册
  - `backend/api/_exceptions.py` - 异常处理器注册
  - `backend/api/_endpoints.py` - `/livez` / `/readyz` / `/health` / `/metrics`
  - `backend/api/_size_guard.py` - 请求大小限制中间件
- `api_app.py` 只保留 `create_application()`、`lifespan` 与最少量的装配代码。
- 保持应用启动入口和挂载路径不变。

## Sequencing

建议按以下批次执行，每一批都要求“独立可回归、可单独提交”：

1. 错误映射与共享 helper 收口：新建 `core/errors.py`，去重验证码映射，收口字符串兼容判断。
2. `skills_support` 模块边界重组：将单文件演进为 package，让 `skills.py` 路由变薄。
3. `SkillService` 主体拆分：引入内部协作对象，删除纯转发型静态代理方法。
4. repo 层 legacy fallback 集中化。
5. `api_app.py` 组装层拆分与命名整理。
6. 收尾清理：删除死代码、输出“未动行为清单”和“仍保留兼容点清单”。

## Public Interfaces / Invariants

- 保持所有 FastAPI 路由路径、HTTP 方法、状态码、响应模型字段不变。
- 保持 `SkillService` 现有对外方法名与参数不变；本轮只改内部组织方式。
- 保持 `SkillErrorCode`、审计 action 名称、验证码错误 code、不透明 token/JWT 行为不变。
- 保持 `/livez`、`/readyz`、`/health`、`/metrics` 的存在性与当前语义不变。
- 若新增内部 helper/module，默认视为私有实现细节，不对外暴露新契约。

## Validation Plan

每个里程碑先跑最小相关回归，再决定是否补更广范围验证。

建议的最小测试映射：

- Milestone 1:
  - `uv run pytest tests/test_api_auth.py tests/test_api_auth_extended.py tests/test_users_api.py tests/test_skill_support.py tests/test_api_skill_download.py`
- Milestone 2:
  - `uv run pytest tests/test_api_skills.py tests/test_skills_api_extended.py tests/test_api_skill_download.py tests/test_skill_support.py`
- Milestone 3:
  - `uv run pytest tests/test_skill_service.py tests/test_skill_service_file_ops.py tests/test_skill_service_more.py tests/test_skill_service_advanced.py tests/test_skill_service_integration.py`
- Milestone 4:
  - `uv run pytest tests/test_skill_repository.py tests/test_api_skills.py tests/test_skills_api_extended.py tests/test_skill_service_integration.py`
- Milestone 5:
  - `uv run pytest tests/test_api_auth.py tests/test_api_auth_extended.py tests/test_app_startup.py tests/test_request_metrics.py tests/test_metrics_cleanup_api.py tests/test_metrics_reset_24h_api.py tests/test_api_skill_download.py`

收尾时的建议验证：

- `uv run pytest tests/test_api_auth.py tests/test_api_auth_extended.py tests/test_users_api.py tests/test_api_skills.py tests/test_skills_api_extended.py tests/test_api_skill_download.py tests/test_skill_service.py tests/test_skill_service_file_ops.py tests/test_skill_service_more.py tests/test_skill_service_advanced.py tests/test_skill_service_integration.py tests/test_app_startup.py tests/test_request_metrics.py tests/test_metrics_cleanup_api.py tests/test_metrics_reset_24h_api.py`
- `uv run ruff check backend tests`

需要人工复核的非功能项：

- 导入关系不形成新的循环依赖。
- `skills.py`、`api_app.py`、`skill.py` 的职责明显变薄。
- 没有新增 dead code，也没有把兼容逻辑重新散落回主流程。

## Completion Criteria

本计划完成时，应满足以下标准：

- 共享错误构造逻辑已有单点 helper，transport adapter 仍保持现有输出形态。
- `skills_support` 已拆成更清晰的内部边界，且不与 `skills.py` 命名冲突。
- `SkillService` 不再是主要行为和辅助函数的单一堆积点。
- legacy fallback 被显式命名并集中管理。
- app composition 层拆分后，现有运维端点与异常处理语义保持不变。
- 文档中补齐两份输出：
  - 未动行为清单
  - 仍保留的兼容点清单

## 未动行为清单

- 所有 FastAPI 路由路径、HTTP 方法、状态码、响应 schema 字段保持不变；`/api/v1` 挂载路径未改。
- `SkillService` 继续作为对外 facade，现有公开方法名与参数保持不变。
- API 错误响应继续保持 `detail` / `code` / `timestamp` 形态；下载专用 429、全局限流 429、验证码错误码的对外文案与错误码保持现状。
- `/livez`、`/readyz`、`/health`、`/metrics` 继续存在并保持当前语义；`readyz` / `health` 在 DB 不可用时仍返回 `503` + `unhealthy` payload。
- `users.delete_me()` 继续保留原始字符串错误 detail，不借本轮重构统一为验证码结构化错误。
- RBAC、JWT / API token 行为、审计 action 名称、runtime config contract 均未调整。

## 仍保留的兼容点清单

- `backend/repositories/skill.py::_list_cloned_source_ids_legacy_fallback()` 仍保留对历史 clone 记录的兼容，用于识别尚未回填 `cloned_from_skill_id`、但在首个 `SkillVersion.metadata_json` 中仍有来源信息的旧数据。
- `backend/api/v1/skills_support/error_mapper.py::_handle_legacy_skill_value_error()` 仍保留对旧 service raw `ValueError` 字符串的兼容映射，避免旧路径直接暴露不一致的 HTTP 语义。
- `backend/services/skill.py` 仍保留 facade 形态，以及少量向内部协作对象转发的协调入口，用来维持现有调用面稳定，避免在本轮结构收口中同步调整外部依赖。

## Assumptions

- 目标是“结构收口”，不是 feature 重写；任何需要改 schema、改接口、改权限语义的事项都不纳入本次。
- `backend-consolidation-refactor-tasks.md` 采用里程碑级颗粒度，每个任务应能独立提交和回归。
- 若执行中发现某段兼容逻辑已无引用且无测试覆盖，需要先补回归测试，再移除。
