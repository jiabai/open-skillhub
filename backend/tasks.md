# Backend 收口型重构任务

## Milestone 1: 错误与响应收口

- [ ] 盘点并统一 backend 内所有错误 payload 构造入口。
- [ ] 提取共享错误元数据 helper，分别提供 HTTP/tool/MCP 薄适配。
- [ ] 去重 `auth.py` / `users.py` 的验证码错误映射。
- [ ] 回归 HTTP 状态码、`detail`、`code`、`timestamp` 格式。

## Milestone 2: skills API 边界收口

- [ ] 拆分 `api/v1/skills_support.py` 为多个单职责 helper 模块。
- [ ] 将 `skills.py` 中序列化、审计、上传/下载辅助迁出路由层。
- [ ] 保持所有 `skills` 路由行为、schema、审计动作名不变。
- [ ] 回归 upload/download/public/reference/clone/pin 相关接口。

## Milestone 3: SkillService 解耦

- [ ] 将 `services/skill.py` 内部按 lifecycle / storage / version / archive 责任拆分。
- [ ] 保留 `SkillService` 作为外部门面，不改公开方法签名。
- [ ] 将字符串兼容错误判断尽量下沉到专用 mapper/adapter。
- [ ] 回归 reference/public/clone/version 解析路径。

## Milestone 4: legacy / fallback 残留集中化

- [ ] 收拢 `repositories/skill.py` 中旧 metadata fallback 逻辑。
- [ ] 清理并集中 `api/mcp/__init__.py` 的 fallback app 与错误响应重复代码。
- [ ] 为仍保留的兼容路径增加清晰命名或独立 helper，避免主流程混杂。
- [ ] 回归旧数据兼容和鉴权失败场景。

## Milestone 5: app 组装层精简

- [ ] 拆分 `api_app.py` 的 middleware、exception handlers、operational endpoints、lifespan 组装逻辑。
- [ ] 保持 app 创建入口和挂载路径不变。
- [ ] 回归 `/health`、`/metrics`、`/mcp`、`/sse` 与全局异常处理。
- [ ] 检查导入关系，避免新增循环依赖。

## Milestone 6: 收尾校验

- [ ] 搜索 `legacy` / `fallback` / 重复错误构造是否仍散落在主流程。
- [ ] 搜索未再使用的 helper、mapper、compat 分支并删除死代码。
- [ ] 运行 backend 相关测试并补最小缺口。
- [ ] 输出“未动行为清单”和“仍保留的兼容点清单”，作为重构完成标准。
