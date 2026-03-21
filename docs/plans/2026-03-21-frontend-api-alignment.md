# Open SkillHub 前端 API 类型对齐实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 根据 `docs/frontend-design/` 规范对齐前端 API 类型定义，补全缺失字段和接口

**Architecture:** 基于现有 Next.js + shadcn/ui 前端代码，按照设计文档规范更新类型定义和 API 客户端

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui

---

## 当前差异总览

根据 `docs/frontend-design/01-api-types.md` 规范，当前实现与文档的对比：

| 类型 | 当前字段数 | 文档要求字段数 | 缺失字段 |
|------|-----------|---------------|---------|
| `Skill` | 6 | 13 | `user_id`, `visible`, `enterprise_id`, `team_id`, `skill_dir`, `current_version`, `is_active`, `cache_revoked_at` |
| `Token` | 5 | 8 | `user_id`, `is_active`, `last_used_at` (注意：`revoked_at` 应改为 `is_active`) |
| `User` | 4 | 11 | `id`, `is_active`, `enterprise_id`, `team_id`, `role`, `status`, `created_at`, `updated_at` |

---

## Task 1: 更新 Skill 类型定义

**Files:**
- Modify: `frontend/src/lib/api.ts:10-17`

**Step 1: 查看当前 Skill 类型定义**

Run: `cat frontend/src/lib/api.ts | head -20`
Expected: 显示当前 Skill 类型只有 6 个字段

**Step 2: 更新 Skill 类型定义**

```typescript
export type Skill = {
  id: string
  user_id?: string
  name: string
  description: string | null
  tags?: string[]
  visible?: "private" | "team" | "enterprise"
  enterprise_id?: string | null
  team_id?: string | null
  skill_dir?: string
  current_version?: string | null
  is_active?: boolean
  cache_revoked_at?: string | null
  created_at?: string
  updated_at?: string
}
```

**Step 3: 添加 SkillVisible 类型**

在 Skill 类型上方添加：

```typescript
export type SkillVisible = "private" | "team" | "enterprise"
```

**Step 4: 验证类型定义**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: 无类型错误

**Step 5: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): 更新 Skill 类型定义，对齐后端契约"
```

---

## Task 2: 更新 Token 类型定义

**Files:**
- Modify: `frontend/src/lib/api.ts:19-26`

**Step 1: 查看当前 Token 类型定义**

Run: `cat frontend/src/lib/api.ts | sed -n '19,26p'`
Expected: 显示当前 Token 类型包含 `revoked_at` 字段

**Step 2: 更新 Token 类型定义**

```typescript
export type Token = {
  id: string
  user_id?: string
  name: string
  token?: string | null
  is_active: boolean
  expires_at?: string | null
  last_used_at?: string | null
  created_at: string
}
```

**Step 3: 更新 Token 卡片组件显示逻辑**

Files:
- Modify: `frontend/src/app/tokens/page.tsx:141-148`

当前代码使用 `expires_at` 判断过期状态，需要更新为使用 `is_active` 字段：

```typescript
// 原代码
{token.expires_at ? <Badge variant="outline">到期: {token.expires_at.slice(0, 10)}</Badge> : null}

// 更新后，需要同时考虑 is_active 和 expires_at
const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false
const isRevoked = !token.is_active
```

**Step 4: 验证类型定义**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: 无类型错误

**Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/app/tokens/page.tsx
git commit -m "feat(frontend): 更新 Token 类型定义，使用 is_active 替代 revoked_at"
```

---

## Task 3: 更新 User 类型定义

**Files:**
- Modify: `frontend/src/lib/api.ts:28-33`

**Step 1: 查看当前 User 类型定义**

Run: `cat frontend/src/lib/api.ts | sed -n '28,33p'`
Expected: 显示当前 User 类型只有 4 个字段

**Step 2: 更新 User 类型定义**

```typescript
export type User = {
  id: string
  email: string
  username: string
  is_active: boolean
  is_superuser: boolean
  enterprise_id?: string | null
  team_id?: string | null
  role: string
  status: string
  created_at: string
  updated_at: string
}
```

**Step 3: 添加 UserIdentityUpdate 类型**

在 User 类型下方添加：

```typescript
export type UserIdentityUpdate = {
  role?: string
  status?: string
}
```

**Step 4: 更新 Profile 页面以使用新的 User 类型**

Files:
- Modify: `frontend/src/app/profile/page.tsx`

检查是否有类型不兼容的使用方式，确保 `user.id`、`user.created_at` 等字段访问正确。

**Step 5: 验证类型定义**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: 无类型错误

**Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/app/profile/page.tsx
git commit -m "feat(frontend): 更新 User 类型定义，补全 11 个字段"
```

---

## Task 4: 添加缺失的响应类型

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: 添加 Skill 版本相关类型**

在 DashboardOverview 之后添加：

```typescript
export type SkillVersion = {
  version: string
  description: string
  dependencies: string[]
  dependency_spec?: Record<string, any>
  dependency_spec_version?: string
  metadata: Record<string, any>
  created_at: string
}

export type SkillVersionDiff = {
  from_version: string
  to_version: string
  added: string[]
  removed: string[]
  modified: Array<{ path: string; diff: string }>
}

export type SkillInstallInstructions = {
  strategy: string
  dependencies: string[]
  requirements_text: string
  commands: string[]
  ecosystem?: string
  manifests?: Record<string, any>
  dependency_spec?: Record<string, any>
}

export type SkillDownloadResponse = {
  skill_uuid: string
  version: string
  encrypted_code: string
  checksum: string
  expires_at: string
  cache_ttl_seconds?: number
}

export type SkillCachePolicyResponse = {
  default_ttl_seconds: number
  max_ttl_seconds: number
  cache_enabled: boolean
}
```

**Step 2: 添加审计日志类型**

```typescript
export type AuditLogItem = {
  id: string
  actor_id: string
  action: string
  target: string
  result: string
  timestamp: string
  ip: string
  user_agent: string
  details: Record<string, any>
}

export type AuditLogExportRequest = {
  format: "json" | "csv"
  filters?: {
    actor_id?: string
    action?: string
    start?: string
    end?: string
  }
}

export type AuditLogExportResponse = {
  format: string
  content: string
}
```

**Step 3: 添加错误码类型**

```typescript
export type ErrorCode =
  | "CODE_EXPIRED"
  | "CODE_INVALID"
  | "CODE_MISMATCH"
  | "TOO_MANY_ATTEMPTS"
  | "RESEND_TOO_FREQUENT"
  | "EMAIL_ALREADY_EXISTS"
  | "USERNAME_ALREADY_EXISTS"
  | "REGISTRATION_DISABLED"
  | "LOGIN_DISABLED"
  | "ACCOUNT_DELETED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "PERMISSION_DENIED"
  | "RESOURCE_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "INTERNAL_SERVER_ERROR"

export type ApiErrorResponse = {
  detail: string
  code?: ErrorCode
}
```

**Step 4: 验证类型定义**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: 无类型错误

**Step 5: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): 添加 Skill 版本、审计日志和错误码类型定义"
```

---

## Task 5: 更新 API 客户端方法

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: 添加缺失的 API 方法**

在 api 对象中添加以下方法（根据文档中接口契约映射表）：

```typescript
export const api = {
  // 现有方法保持不变...

  // Skill 版本管理
  listSkillVersions: (skillUuid: string) =>
    apiFetch<{ items: SkillVersion[] }>(`/api/v1/skills/${skillUuid}/versions`),

  getSkillVersion: (skillUuid: string, version: string) =>
    apiFetch<SkillVersion>(`/api/v1/skills/${skillUuid}/versions/${version}`),

  diffSkillVersions: (skillUuid: string, fromVersion: string, toVersion: string) =>
    apiFetch<SkillVersionDiff>(`/api/v1/skills/${skillUuid}/versions/diff?from=${encodeURIComponent(fromVersion)}&to=${encodeURIComponent(toVersion)}`),

  getInstallInstructions: (skillUuid: string, version: string) =>
    apiFetch<SkillInstallInstructions>(`/api/v1/skills/${skillUuid}/versions/${version}/install-instructions`),

  rollbackSkillVersion: (skillUuid: string, version: string) =>
    apiFetch<SkillVersion>(`/api/v1/skills/${skillUuid}/versions/${version}/rollback`, { method: "POST" }),

  downloadSkill: (payload: { skill_uuid: string; version?: string }) =>
    apiFetch<SkillDownloadResponse>("/api/v1/skills/download", { method: "POST", body: JSON.stringify(payload) }),

  getSkillCachePolicy: () =>
    apiFetch<SkillCachePolicyResponse>("/api/v1/skills/cache-policy"),

  // Skill 激活/停用
  activateSkill: (skillUuid: string) =>
    apiFetch<Skill>(`/api/v1/skills/${skillUuid}/activate`, { method: "POST" }),

  deactivateSkill: (skillUuid: string) =>
    apiFetch<Skill>(`/api/v1/skills/${skillUuid}/deactivate`, { method: "POST" }),

  // 审计日志
  listAuditLogs: (params?: {
    actor_id?: string
    action?: string
    start?: string
    end?: string
    skip?: number
    limit?: number
  }) => apiFetch<{ items: AuditLogItem[] }>(
    `/api/v1/audit/logs?${new URLSearchParams(params as any)}`
  ),

  exportAuditLogs: (payload: AuditLogExportRequest) =>
    apiFetch<AuditLogExportResponse>("/api/v1/audit/logs/export", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  // 账户删除
  requestDeleteAccount: () =>
    apiFetch<void>("/api/v1/users/me/delete-request", { method: "POST" }),

  deleteAccount: (payload: { code: string }) =>
    apiFetch<void>("/api/v1/users/me", { method: "DELETE", body: JSON.stringify(payload) }),

  // 邮箱绑定
  bindEmail: (payload: { email: string; code: string }) =>
    apiFetch<{ bound: boolean }>("/api/v1/users/bind-email", { method: "POST", body: JSON.stringify(payload) }),
}
```

**Step 2: 验证 API 客户端**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): 添加缺失的 API 客户端方法"
```

---

## Task 6: 更新 Skills 页面以显示新字段

**Files:**
- Modify: `frontend/src/app/skills/page.tsx`

**Step 1: 更新 Skill 卡片显示**

在技能列表项中显示更多信息：

```typescript
// 在 Badge 区域添加可见性显示
<div className="flex flex-wrap gap-2">
  <Badge variant="muted">{skill.visible === "private" ? "私有" : skill.visible === "team" ? "团队" : "企业"}</Badge>
  <Badge variant="outline">id: {skill.id.slice(0, 8)}</Badge>
  {skill.current_version && <Badge variant="accent">v{skill.current_version}</Badge>}
  {skill.is_active === false && <Badge variant="destructive">已停用</Badge>}
</div>
```

**Step 2: 添加创建时间显示**

```typescript
// 在 CardDescription 下方添加
{skill.created_at && (
  <p className="text-xs text-muted-foreground">
    创建于 {new Date(skill.created_at).toLocaleDateString()}
  </p>
)}
```

**Step 3: 验证页面**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add frontend/src/app/skills/page.tsx
git commit -m "feat(frontend): 更新 Skills 页面，显示可见性和版本信息"
```

---

## Task 7: 更新 Token 页面以使用新字段

**Files:**
- Modify: `frontend/src/app/tokens/page.tsx`

**Step 1: 更新 Token 卡片状态显示**

```typescript
// 计算 Token 状态
const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false
const isRevoked = !token.is_active
const isActive = token.is_active && !isExpired

// 显示状态
<Badge variant={isActive ? "accent" : isExpired ? "outline" : "destructive"}>
  {isActive ? "活跃" : isExpired ? "已过期" : "已撤销"}
</Badge>
```

**Step 2: 添加最后使用时间显示**

```typescript
// 在 Token 信息中显示
{token.last_used_at && (
  <span>最近使用: {new Date(token.last_used_at).toLocaleString()}</span>
)}
```

**Step 3: 验证页面**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add frontend/src/app/tokens/page.tsx
git commit -m "feat(frontend): 更新 Tokens 页面，使用 is_active 和 last_used_at 字段"
```

---

## Task 8: 更新 Profile 页面以显示完整用户信息

**Files:**
- Modify: `frontend/src/app/profile/page.tsx`

**Step 1: 查看当前 Profile 页面**

Run: `cat frontend/src/app/profile/page.tsx`
Expected: 显示当前页面结构和使用的字段

**Step 2: 添加更多用户信息显示**

在 Profile 页面显示：
- 角色 (role)
- 状态 (status)
- 企业/团队 ID（如果有）
- 注册时间

**Step 3: 验证页面**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add frontend/src/app/profile/page.tsx
git commit -m "feat(frontend): 更新 Profile 页面，显示完整用户信息"
```

---

## Task 9: 添加错误处理工具函数

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: 添加错误码映射**

```typescript
const errorMessages: Record<string, string> = {
  "CODE_EXPIRED": "验证码已过期，请重新获取",
  "CODE_INVALID": "验证码错误，请检查后重试",
  "CODE_MISMATCH": "验证码不匹配，请重新输入",
  "TOO_MANY_ATTEMPTS": "操作过于频繁，请稍后再试",
  "RESEND_TOO_FREQUENT": "验证码发送过于频繁，请稍候再试",
  "EMAIL_ALREADY_EXISTS": "该邮箱已注册，请直接登录或找回密码",
  "USERNAME_ALREADY_EXISTS": "该用户名已被占用，请选择其他用户名",
  "REGISTRATION_DISABLED": "当前关闭注册，请联系管理员",
  "LOGIN_DISABLED": "登录已被禁用，请联系管理员",
  "ACCOUNT_DELETED": "账户已注销，无法登录",
  "TOKEN_EXPIRED": "登录已过期，请重新登录",
  "TOKEN_INVALID": "无效的认证凭证，请重新登录",
  "PERMISSION_DENIED": "您没有权限执行此操作",
  "RESOURCE_NOT_FOUND": "请求的资源不存在",
  "VALIDATION_ERROR": "提交信息有误，请检查后重试",
  "INTERNAL_SERVER_ERROR": "服务器错误，请稍后再试",
}

export function getUserFriendlyErrorMessage(detail: string): string {
  return errorMessages[detail] || detail || "操作失败，请稍后再试"
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const detail = (error as any).detail
    if (typeof detail === "string") {
      return getUserFriendlyErrorMessage(detail)
    }
    return error.message
  }
  return "操作失败，请稍后再试"
}
```

**Step 2: 验证**

Run: `cd frontend && npm run build 2>&1 | head -30`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): 添加错误处理工具函数和用户友好的错误提示"
```

---

## Task 10: 运行测试验证

**Files:**
- All frontend files

**Step 1: 运行类型检查**

Run: `cd frontend && npm run build`
Expected: 构建成功，无类型错误

**Step 2: 运行单元测试**

Run: `cd frontend && npm test`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add frontend/
git commit -m "test(frontend): 验证 API 类型对齐后的构建和测试"
```

---

## 实施检查清单

### 类型定义检查

- [ ] Skill 类型包含 13 个字段
- [ ] Token 类型使用 `is_active` 替代 `revoked_at`
- [ ] User 类型包含 11 个字段
- [ ] SkillVersion 类型定义正确
- [ ] SkillVersionDiff 类型定义正确
- [ ] SkillInstallInstructions 类型定义正确
- [ ] SkillDownloadResponse 类型定义正确
- [ ] AuditLogItem 类型定义正确
- [ ] ErrorCode 类型定义完整

### API 客户端检查

- [ ] listSkillVersions 方法存在
- [ ] getSkillVersion 方法存在
- [ ] diffSkillVersions 方法存在
- [ ] getInstallInstructions 方法存在
- [ ] rollbackSkillVersion 方法存在
- [ ] downloadSkill 方法存在
- [ ] activateSkill 方法存在
- [ ] deactivateSkill 方法存在
- [ ] listAuditLogs 方法存在
- [ ] exportAuditLogs 方法存在
- [ ] requestDeleteAccount 方法存在
- [ ] deleteAccount 方法存在
- [ ] bindEmail 方法存在

### 页面更新检查

- [ ] Skills 页面显示可见性徽章
- [ ] Skills 页面显示版本信息
- [ ] Tokens 页面使用 is_active 字段
- [ ] Tokens 页面显示 last_used_at
- [ ] Profile 页面显示完整用户信息

### 测试检查

- [ ] TypeScript 编译无错误
- [ ] 单元测试全部通过
- [ ] 构建成功

---

## 文档参考

- [前端设计文档索引](../frontend-design/index.md)
- [API 类型定义](../frontend-design/01-api-types.md)
- [认证与安全](../frontend-design/02-auth-security.md)
- [业务逻辑与异常](../frontend-design/03-business-exception.md)
- [技术基础](../frontend-design/04-basics-readonly.md)
