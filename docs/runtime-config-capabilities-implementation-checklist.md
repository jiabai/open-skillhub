# Runtime Config / Capabilities 实施现状

## 结论

runtime config / capabilities 架构已经落地，前端业务能力判断已从编译期 `NEXT_PUBLIC_*` 迁移到后端下发的运行时能力。

当前状态：

- 后端是业务 capability 的唯一真相源
- 前端通过 runtime-config provider 统一消费 capability
- 前端业务型 env 已从 `.env.example` 和 `Dockerfile` 中移除
- `feature-flags.ts` 与 `app-mode.ts` 已删除
- 前端 UI 不再依赖 `RBAC / No-RBAC` 作为业务判断入口，而是直接依赖 capability

## 已完成范围

### 后端

已新增：

- `backend/schemas/runtime_config.py`
- `backend/services/runtime_config.py`
- `backend/api/v1/runtime_config.py`
- `tests/test_runtime_config_api.py`

已修改：

- `backend/api/router.py`

已完成能力派生：

- `skill_visibility`
- `public_skills`
- `org_model`
- `public_signup`
- `email_otp_login`
- `sso`
- `ldap`
- `audit_log`
- `audit_export`
- `rbac`
- `no_rbac_mode`

### 前端

已新增：

- `frontend/src/lib/runtime-config.ts`
- `frontend/src/components/app/runtime-config-provider.tsx`
- `frontend/src/hooks/use-runtime-config.ts`
- `frontend/src/__tests__/runtime-config.test.tsx`

已完成接入：

- `frontend/src/app/layout.tsx`
- `frontend/src/components/app/app-shell.tsx`
- `frontend/src/app/skills/new/page.tsx`
- `frontend/src/app/skills/[skillUuid]/page.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/register/page.tsx`
- `frontend/src/app/audit/page.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/profile/page.tsx`
- `frontend/src/app/skills/page.tsx`
- `frontend/src/app/public-skills/page.tsx`
- `frontend/src/app/tokens/page.tsx`

已删除旧入口：

- `frontend/src/lib/feature-flags.ts`
- `frontend/src/lib/app-mode.ts`
- `frontend/src/__tests__/app-mode.test.ts`

已完成命名收口：

- `mode-boundary-note.tsx` 已重命名为 `workspace-boundary-note.tsx`
- 用户可见文案已从 `RBAC / No-RBAC` 改成 `Scoped Access / Personal Workspace`

### 配置与构建

已修改：

- `frontend/.env.example`
- `frontend/Dockerfile`

已移除前端业务型 env：

- `NEXT_PUBLIC_ENABLE_SKILL_VISIBILITY`
- `NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP`
- `NEXT_PUBLIC_ENABLE_SSO`
- `NEXT_PUBLIC_ENABLE_LDAP`
- `NEXT_PUBLIC_ENABLE_AUDIT_LOG`
- `NEXT_PUBLIC_ENABLE_AUDIT_EXPORT`
- `NEXT_PUBLIC_ENABLE_ORG_MODEL`
- `NEXT_PUBLIC_ENABLE_EMAIL_OTP_LOGIN`

保留：

- `NEXT_PUBLIC_API_BASE_URL`

## 当前架构边界

### 后端

- `settings` 只作为内部配置来源
- runtime-config service 负责把内部配置派生成稳定 capability contract
- `/api/v1/runtime-config` 是前端系统能力的统一入口

### 前端

- runtime-config provider 是 capability 的统一来源
- 页面和组件通过 `useRuntimeConfig()` 读取 capability
- 系统 capability 与用户 permission 继续分层表达

## 验证状态

已通过的关键验证：

- `uv run pytest tests/test_runtime_config_api.py -q`
- `npm.cmd test -- --run src/__tests__/runtime-config.test.tsx src/__tests__/app-shell-auth.test.tsx src/__tests__/pages.test.tsx`

最近一次前端验证结果：

- 3 个测试文件通过
- 23 个测试通过

## 已完成的验收标准

- 前端不再用 `NEXT_PUBLIC_*` 判断业务能力
- 后端存在统一的 runtime config / capabilities 接口
- `public_skills` 等组合能力只在后端派生
- UI 业务功能展示已依赖 runtime config
- 前端业务型 env 已从示例配置和构建链路中移除

## 仍可继续优化的项

这些不再属于主线迁移阻塞项，而是后续增强项：

- 增加更多 capability 组合的集成测试
- 继续梳理文档中对“mode”的历史表述
- 为 capability / permission 分层补更明确的前端辅助层
- 为运行时 capability contract 增加变更约束文档

## 一句话结论

这条架构线已经从“计划”进入“已实施”状态。当前代码库中，业务能力由后端集中派生，前端统一消费实例真实 capability，不再自行声明业务开关。
