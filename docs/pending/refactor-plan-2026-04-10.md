# Backend 收口型重构计划（v2）

> 修订日期：2026-04-12

## Summary

目标是在 **不改变对外行为、不调整接口语义、不引入新能力** 的前提下，针对 `backend` 做一次"收口型"重构：减少重复实现、压缩兼容残留、收窄边界职责、拆分过大的聚合文件。

## Key Changes

### 1. 统一错误响应与边界异常映射

当前代码中有三类独立的错误构造逻辑，各自职责不同，但存在去重空间：

| 位置 | 函数 | 用途 | 返回类型 |
|------|------|------|----------|
| `api_app.py` | `_error_payload()` / `_error_payload_from_exception()` | HTTP API 全局异常处理器 | `dict` |
| `core/utils/skill_storage.py` | `tool_error_payload()` | MCP/tool 输出错误 | `str`（JSON） |
| `api/v1/auth.py` + `api/v1/users.py` | `_verification_error_messages` + `_verification_error_payload()` | 验证码错误码→中文消息映射 | `dict` |

**需要做的事：**

- 提取 `core/errors.py` 作为共享错误元数据 helper，包含时间戳生成、状态码→code 映射等基础构造能力。
- `api_app.py` 和 `skill_storage.py` 各自保留为薄适配层（一个返回 dict，一个返回 JSON 字符串），但底层共享 `core/errors.py` 的时间戳和 code 映射逻辑，避免同义逻辑复制。
- 将 `auth.py` / `users.py` 中**完全重复**的 `_verification_error_messages` 字典和 `_verification_error_payload()` 函数去重为单点定义（可放在 `core/errors.py` 或独立模块），保持现有错误码和中文文案不变。
- 将 `skills_support.handle_skill_value_error()` 中基于字符串内容的 5 个兼容判断分支（`"Filename contains invalid characters"`、`"File too large"`、`"Skill already exists"`、`"Version not found"`、`"File not found"`/`"Version files not found"`）收口到专用 mapper 函数，标记为仅兼容旧 service 异常，不再向路由层扩散。

### 2. 缩减 skills 领域的"边界杂物间"

`api/v1/skills_support.py` 当前 290 行，混合了 7+ 种职责：错误映射、服务工厂、序列化、认证辅助、上传辅助、下载限流、审计辅助、下载请求处理。

**需要做的事：**

将其拆为职责清晰的辅助模块（放在 `api/v1/skills/` 子目录下）：

- `service_factory.py` — `build_skill_service()` 服务工厂
- `serializer.py` — `serialize_skill()` / `serialize_public_skill()` 序列化
- `upload.py` — `stream_upload_to_temp_file()` 上传辅助
- `download.py` — `enforce_download_rate_limit()` / `handle_skill_download_request()` 下载限流与请求处理
- `audit.py` — `create_audit_event()` 审计辅助
- `auth.py` — `get_optional_current_user()` 可选认证辅助
- `error_mapper.py` — `handle_skill_value_error()` / `_SKILL_ERROR_RESPONSES` / `_build_http_exception()` 错误映射

路由层 `skills.py` 只保留请求解析、依赖声明、调用 service、返回 schema；不再直接承担限流状态、临时文件流转、审计拼装等混合职责。保持现有路由路径、状态码、响应 schema、审计动作名不变。

### 3. 拆分 `SkillService` 主体

`services/skill.py` 当前 1020 行 / 45.75KB，仍是一个巨大的文件。

**需要做的事：**

以行为边界继续拆出内部协作组件：

- `skill_lifecycle.py` — create / update / deactivate / activate / delete / visibility / kind 判定
- `skill_storage.py` — `read_skill_file` / `upload_file` / `upload_file_from_path` / `list_skill_files` 等文件读写与存储访问
- `skill_version.py` — `_resolve_version_and_record` / `resolve_version_dir` / `pin_reference_version` / `unpin_reference_version` / `list_versions` / `get_version` / `rollback_version` / `diff_versions` 等版本解析与 reference 处理
- `skill_upload.py` — `upload_zip` / `upload_zip_create_skill` 及其内部归档/依赖解析逻辑

`SkillService` 保留为外部门面，继续提供现有公开方法签名，内部委托给更小的协作对象。

额外清理：删除 `SkillService` 中对 `skill_support.py` 的冗余静态代理方法（`_parse_frontmatter`、`_validate_version`、`_normalize_dependencies`、`_parse_requirements_text` 等），让协作组件直接使用 `skill_support.py` 的函数。

### 4. 清理兼容残留与 repo 层 legacy 查询

- `repositories/skill.py` `list_cloned_source_ids()` 中的 `legacy_result` 兼容分支与主路径混杂，未隔离：将其隔离为显式命名的私有方法（如 `_list_cloned_source_ids_legacy_fallback()`），主流程只调用新字段路径，fallback 逻辑不再与主路径混杂。
- 仅删除"已无调用点"或"已被新字段完全覆盖"的兼容辅助；仍有线上意义的兼容逻辑保留，但集中放在显式 `legacy`/`compat` 命名的函数或模块中。

### 5. 收紧 API 组装层

`api_app.py` 当前 204 行，为单一文件，包含：错误载荷构造、DB 健康检查、中间件注册、路由注册、运维端点、请求大小限制中间件（含内联闭包）、全局异常处理器、lifespan、应用工厂。

**需要做的事：**

拆成更薄的 app composition 层：

- `api/_middleware.py` — 中间件注册
- `api/_exceptions.py` — 异常处理器注册（使用 `core/errors.py` 的共享 helper）
- `api/_endpoints.py` — `/health`、`/metrics` 运维端点
- `api/_size_guard.py` — 请求大小限制中间件

`api_app.py` 只保留 `create_application()` 工厂和 `lifespan`，从子模块导入各注册函数。保持应用启动入口和挂载路径不变，`/health`、`/metrics` 语义不变。

### 6. 任务执行顺序

- 第一批：错误映射与共享 helper 收口（新建 `core/errors.py`，去重验证码映射，收口字符串兼容判断）。
- 第二批：`skills_support` 拆分为 `api/v1/skills/` 子目录，让 `skills.py` 路由变薄。
- 第三批：`SkillService` 主体继续拆分（lifecycle / storage / version / upload），删除冗余代理方法。
- 第四批：清理 repo 层 legacy fallback。
- 第五批：`api_app.py` 组装层拆分与命名整理。

每一批都要求"独立可回归、可单独提交"。

## Public Interfaces / Types

- 保持所有 FastAPI 路由路径、HTTP 方法、状态码、响应模型字段不变。
- 保持 `SkillService` 现有对外方法名与参数不变；本轮只改内部组织方式。
- 保持 `SkillErrorCode`、审计 action 名称、验证码错误 code、不透明 token/JWT 行为不变。
- 若新增内部 helper/module，默认视为私有实现细节，不对外暴露新契约。

## Test Plan

- API 回归：
  - `skills` 列表、详情、创建、更新、删除、upload/download、reference/clone/pin/unpin 全链路行为不变。
  - `auth`、`users` 中验证码错误码与状态码不变。
  - `/health`、`/metrics` 错误响应结构不变。
- 兼容回归：
  - reference skill / clone skill / public skill 的 resolved version、kind 判定不变。
  - repo 层 legacy clone source fallback 在旧数据场景下仍可返回原有结果。
- 安全回归：
  - `require_permission`、`require_management_access`、`require_skill_download_access` 行为不变。
  - JWT/API token 鉴权失败时返回的状态码和错误 code 不变。
- 非功能检查：
  - 关键热点文件体积下降（`skill.py` 从 1020 行降至 <300 行，`skills_support.py` 消解为子模块，`api_app.py` 降至 <80 行）。
  - 边界辅助函数移动后导入依赖不形成循环引用。
  - 无新增 dead code、无重复 helper 再次出现。

## Assumptions

- 目标是"结构收口"，不是 feature 重写；任何需要改 schema、改接口、改权限语义的事项都不纳入本次。
- `tasks.md` 采用里程碑级颗粒度，每个任务应能独立提交和回归。
- 对仍可能承载旧数据的兼容逻辑，不直接删除，而是集中、显式命名、缩小作用域。
- 若执行中发现某段兼容逻辑已无引用且无测试覆盖，需要先补回归测试，再移除。
