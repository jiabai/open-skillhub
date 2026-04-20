# Tech Debt Tracker

Last updated: 2026-04-20

## High Priority

| Topic | Why it matters | Source |
|------|----------------|--------|
| Refresh token hardening | Current rotation behavior is weaker than strict single-use invalidation and reuse detection | `docs/design-docs/2026-04-12-code-review-findings.md` |
| Large backend workflow files | Oversized modules increase coordination cost and make boundary drift more likely | `docs/exec-plans/active/2026-04-10-backend-consolidation-refactor-plan.md`, `docs/exec-plans/active/error-architecture-refactor-plan.md` |
| Skills API boundary clarity | Mixed JWT and API-token semantics raise maintenance and client-integration risk | `docs/exec-plans/active/skills-api-boundary.md` |

## Medium Priority

| Topic | Why it matters | Source | Removal Condition |
|------|----------------|--------|-------------------|
| `users.delete_me()` 错误响应格式不一致 | 该端点仍使用原始字符串 detail，其他端点已统一为结构化 `{"detail": ..., "code": ...}` 格式，前端需为此端点编写特殊错误解析逻辑 | `backend/api/v1/users.py`，Milestone 1 刻意保留 | 前端同步更新错误处理逻辑 |
| `user_state.py` 向后兼容 shim | 9 个测试文件依赖旧导入路径，shim 可能永久存在 | `backend/core/security/user_state.py` | 所有测试迁移到 `backend.domain.user_status` 后可移除 |
| `_list_cloned_source_ids_legacy_fallback()` | 旧数据缺少 `cloned_from_skill_id` 新字段 | `backend/repositories/skill.py:L133` | 数据迁移完成，所有旧记录已填充新字段 |
| `_handle_legacy_skill_value_error()` | 兼容旧 service 方法抛出的原始 ValueError，缺乏监控 | `backend/api/v1/skills_support/error_mapper.py:L42` | Service 层统一使用 `SkillError` 异常，且日志触发计数归零 |
| Shared enum consolidation | User status now uses build-time synced catalogs, but other enums such as role, visibility, and skill kind still duplicate literals across layers | `docs/exec-plans/active/enum-catalog-consolidation-plan.md` | — |
| Documentation freshness automation | The new docs structure exists, but it still relies on manual gardening | repository process follow-up | — |

## Debt Handling Rules

- Add debt here when it spans more than one file or more than one task.
- Remove or downgrade debt when a merged change clearly addresses it.
- Link back to the plan or design doc that best explains the issue.
