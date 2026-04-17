# Backend 收口型重构任务

## Milestone 1: 错误与响应收口

- [ ] 新建 `core/errors.py`，提取共享错误元数据 helper（时间戳生成、状态码→code 映射）。
- [ ] `api_app.py` 的 `_error_payload()` / `_error_payload_from_exception()` 改为使用 `core/errors.py`，保留为 HTTP 适配层。
- [ ] `core/utils/skill_storage.py` 的 `tool_error_payload()` 改为使用 `core/errors.py`，保留为 tool/MCP 适配层。
- [ ] 去重 `auth.py` / `users.py` 中完全重复的 `_verification_error_messages` + `_verification_error_payload()`，提取到共享模块。
- [ ] 将 `skills_support.handle_skill_value_error()` 中 5 个基于字符串内容的兼容判断收口到专用 mapper 函数。
- [ ] 回归 HTTP 状态码、`detail`、`code`、`timestamp` 格式。

## Milestone 2: skills API 边界收口

- [ ] 创建 `api/v1/skills/` 子目录，将 `skills_support.py` 拆为单职责模块：`service_factory.py`、`serializer.py`、`upload.py`、`download.py`、`audit.py`、`auth.py`、`error_mapper.py`。
- [ ] 更新 `skills.py` 的导入路径，从子模块导入。
- [ ] 删除原 `skills_support.py`。
- [ ] 保持所有 `skills` 路由行为、schema、审计动作名不变。
- [ ] 回归 upload/download/public/reference/clone/pin 相关接口。

## Milestone 3: SkillService 主体拆分

- [ ] 拆出 `skill_lifecycle.py` — create / update / deactivate / activate / delete / visibility / kind 判定。
- [ ] 拆出 `skill_storage.py`（service 层） — read_skill_file / upload_file / list_skill_files 等文件读写。
- [ ] 拆出 `skill_version.py` — version 解析 / reference / pin / unpin / rollback / diff。
- [ ] 拆出 `skill_upload.py` — upload_zip / upload_zip_create_skill 及归档/依赖解析。
- [ ] 删除 `SkillService` 中对 `skill_support.py` 的冗余静态代理方法。
- [ ] 保留 `SkillService` 作为外部门面，不改公开方法签名。
- [ ] 回归 reference/public/clone/version 解析路径。

## Milestone 4: legacy / fallback 残留集中化

- [ ] 将 `repositories/skill.py` 中 `list_cloned_source_ids()` 的 legacy fallback 隔离为显式命名的私有方法 `_list_cloned_source_ids_legacy_fallback()`。
- [ ] 为仍保留的兼容路径增加清晰命名或独立 helper，避免主流程混杂。
- [ ] 回归旧数据兼容场景。

## Milestone 5: app 组装层精简

- [ ] 拆出 `api/_middleware.py` — 中间件注册。
- [ ] 拆出 `api/_exceptions.py` — 异常处理器注册。
- [ ] 拆出 `api/_endpoints.py` — `/health`、`/metrics` 运维端点。
- [ ] 拆出 `api/_size_guard.py` — 请求大小限制中间件。
- [ ] `api_app.py` 只保留 `create_application()` 工厂和 `lifespan`。
- [ ] 保持 app 创建入口和挂载路径不变。
- [ ] 回归 `/health`、`/metrics` 与全局异常处理。
- [ ] 检查导入关系，避免新增循环依赖。

## Milestone 6: 收尾校验

- [ ] 搜索 `legacy` / `fallback` / 重复错误构造是否仍散落在主流程。
- [ ] 搜索未再使用的 helper、mapper、compat 分支并删除死代码。
- [ ] 运行 backend 相关测试并补最小缺口。
- [ ] 输出"未动行为清单"和"仍保留的兼容点清单"，作为重构完成标准。
