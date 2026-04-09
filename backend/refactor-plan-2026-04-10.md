# Backend 收口型重构计划

## Summary

目标是在 **不改变对外行为、不调整接口语义、不引入新能力** 的前提下，只针对 `backend` 目录做一次“收口型”重构：减少重复实现、压缩兼容残留、收窄边界职责、拆分过大的聚合文件。

本轮重构按风险顺序推进，优先处理已经影响维护成本和回归风险的热点：`backend/api_app.py`、`backend/api/v1/skills_support.py`、`backend/services/skill.py`，以及 `repositories` / `auth/users` 中的兼容分支和重复错误映射。

## Key Changes

### 1. 统一错误响应与边界异常映射

- 抽出 backend 内统一的错误载荷构造器，收拢当前分散在 `api_app.py`、`api/mcp/__init__.py`、`core/utils/skill_storage.py`、`api/v1/auth.py`、`api/v1/users.py` 的时间戳/`detail`/`code` 拼装逻辑。
- 将“HTTP API 响应错误”和“tool/MCP 输出错误”分成两个薄适配层，共享同一套底层错误元数据，避免同义逻辑复制。
- 将验证码错误映射从 `auth.py` / `users.py` 去重为单点定义，保持现有错误码和文案不变。
- 将 `skills_support.handle_skill_value_error()` 里基于字符串判断的兼容分支收口到单独 mapper，标记为仅兼容旧 service 异常，不再向路由层扩散。

### 2. 缩减 skills 领域的“边界杂物间”

- 将 `api/v1/skills_support.py` 拆成职责清晰的辅助模块：
- skill service factory / query helpers
- skill serializer
- upload/download request helpers
- audit helper
- optional auth helper
- skill error mapper
- 路由层只保留请求解析、依赖声明、调用 service、返回 schema；不再直接承担限流状态、临时文件流转、审计拼装等混合职责。
- 保持现有路由路径、状态码、响应 schema、审计动作名不变。

### 3. 拆分 `SkillService`，但不改变 public behavior

- 以行为边界拆出内部协作组件，至少分为：
- skill lifecycle / visibility
- file read-write / storage access
- version resolution / reference handling
- upload / archive / dependency parsing
- `SkillService` 保留为外部门面，继续提供现有公开方法签名，内部委托给更小的协作对象。
- 现有 `SkillCloneService`、`SkillDownloadService` 继续保留，避免一次性跨太多模块重排。
- 对 reference skill、clone skill、public skill 的判定语义保持不变，兼容逻辑仅内聚，不扩散。

### 4. 清理兼容残留与 repo 层 legacy 查询

- 处理 `repositories/skill.py` 中 `list_cloned_source_ids()` 的 `legacy_result` 兼容分支：将其明确隔离为“旧元数据回退路径”，并限制影响范围，避免与新字段主路径混杂。
- 梳理 `api/mcp/__init__.py` 中 fallback app、鉴权失败响应、初始化失败兜底的重复错误构造逻辑，统一到共享 helper。
- 仅删除“已无调用点”或“已被新字段完全覆盖”的兼容辅助；仍有线上意义的兼容逻辑保留，但集中放在显式 `legacy`/`compat` 模块或函数中。

### 5. 收紧 API 组装层

- `api_app.py` 拆成更薄的 app composition 层：
- middleware registration
- exception handler registration
- operational endpoints registration
- request-size guard
- lifespan/startup hooks
- 保持应用启动入口和挂载路径不变，`/health`、`/metrics`、`/mcp`、`/sse` 语义不变。
- 避免继续在 app 入口文件中堆叠内联闭包和重复 payload 构造。

### 6. 任务执行顺序

- 第一批：错误映射与共享 helper 收口。
- 第二批：`skills_support` 拆分并让 `skills.py` 路由变薄。
- 第三批：`SkillService` 内部解耦为门面 + 协作组件。
- 第四批：清理 repo/API/MCP 的 legacy/fallback 残留。
- 第五批：`api_app.py` 组装层收口与命名整理。
- 每一批都要求“独立可回归、可单独提交”。

## Public Interfaces / Types

- 保持所有 FastAPI 路由路径、HTTP 方法、状态码、响应模型字段不变。
- 保持 `SkillService` 现有对外方法名与参数不变；本轮只改内部组织方式。
- 保持 `SkillErrorCode`、审计 action 名称、验证码错误 code、不透明 token/JWT 行为不变。
- 若新增内部 helper/module，默认视为私有实现细节，不对外暴露新契约。

## Test Plan

- API 回归：
- `skills` 列表、详情、创建、更新、删除、upload/download、reference/clone/pin/unpin 全链路行为不变。
- `auth`、`users` 中验证码错误码与状态码不变。
- `/health`、`/metrics`、`/mcp`、`/sse` 错误响应结构不变。
- 兼容回归：
- reference skill / clone skill / public skill 的 resolved version、kind 判定不变。
- repo 层 legacy clone source fallback 在旧数据场景下仍可返回原有结果。
- 安全回归：
- `require_permission`、`require_management_access`、`require_skill_download_access` 行为不变。
- MCP/JWT/API token 鉴权失败时返回的状态码和错误 code 不变。
- 非功能检查：
- 关键热点文件体积下降，边界辅助函数移动后导入依赖不形成循环引用。
- 无新增 dead code、无重复 helper 再次出现。

## Assumptions

- 本轮不查看、不依赖 `docs` 目录内容，只以 `backend` 当前代码为准。
- 目标是“结构收口”，不是 feature 重写；任何需要改 schema、改接口、改权限语义的事项都不纳入本次。
- `tasks.md` 采用里程碑级颗粒度，每个任务应能独立提交和回归。
- 对仍可能承载旧数据的兼容逻辑，不直接删除，而是集中、显式命名、缩小作用域。
- 若执行中发现某段兼容逻辑已无引用且无测试覆盖，需要先补回归测试，再移除。
