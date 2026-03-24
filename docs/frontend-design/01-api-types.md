# Open SkillHub 前端构建与设计文档 - Part 1

## API与数据模型

> 本文档为 `index.md` 的第1部分，聚焦于 API 类型定义、客户端结构、契约映射。
>
> **关联文档**：
> - [02-auth-security.md](./02-auth-security.md) - 认证与安全
> - [03-business-exception.md](./03-business-exception.md) - 业务逻辑与异常
> - [04-basics-readonly.md](./04-basics-readonly.md) - 技术基础（只读）

---

## 目录

1. [API 客户端](#1-api-客户端)
2. [类型定义](#2-类型定义)
3. [前后端契约映射](#3-前后端契约映射)

---

## 1. API 客户端

### 1.1 API 工具函数

```tsx
// src/lib/api.ts

// ========== Token 管理 ==========
const storageKey = "skillhub.tokens"

export interface TokenPair {
  access_token: string
  refresh_token: string
}

export function getStoredTokens(): TokenPair | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TokenPair
  } catch {
    return null
  }
}

export function storeTokens(tokens: TokenPair) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(storageKey, JSON.stringify(tokens))
}

export function clearTokens() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(storageKey)
}

// ========== Token 刷新缓存 ==========
let refreshPromise: Promise<TokenPair> | null = null

async function safeRefreshTokens(refreshToken: string): Promise<TokenPair> {
  if (refreshPromise) {
    return refreshPromise
  }
  refreshPromise = refreshTokens(refreshToken).finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!response.ok) {
    clearTokens()
    throw new Error("Token refresh failed")
  }
  return response.json()
}

// ========== API 请求选项 ==========
interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  headers?: Record<string, string>
  body?: string
  accessToken?: string
  skipRefresh?: boolean
}

interface FetchResult<T> {
  response: Response
  payload: T
}

// ========== 核心 API 请求函数 ==========
async function fetchJson<T>(path: string, options: ApiRequestOptions = {}): Promise<FetchResult<T>> {
  const { method = "GET", headers = {}, body, accessToken } = options

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  }

  if (accessToken) {
    requestHeaders["Authorization"] = `Bearer ${accessToken}`
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body,
  })

  let payload: T
  const contentType = response.headers.get("content-type")
  if (contentType?.includes("application/json")) {
    payload = await response.json()
  } else {
    payload = await response.text() as any
  }

  return { response, payload }
}

async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const tokens = options.accessToken ? null : getStoredTokens()
  const accessToken = options.accessToken || tokens?.access_token

  const { response, payload } = await fetchJson<T>(path, { ...options, accessToken })

  if (response.ok) {
    return payload
  }

  // 401 错误时尝试刷新 Token
  if (response.status === 401 && !options.skipRefresh && tokens?.refresh_token) {
    try {
      const refreshed = await safeRefreshTokens(tokens.refresh_token)
      storeTokens({ access_token: refreshed.access_token, refresh_token: tokens.refresh_token })

      const retry = await fetchJson<T>(path, { ...options, accessToken: refreshed.access_token })
      if (retry.response.ok) {
        return retry.payload
      }
    } catch (error) {
      clearTokens()
      throw error
    }
  }

  const detail = (payload as any)?.detail
  throw new Error(typeof detail === "string" ? detail : response.statusText)
}

async function apiFetchText(path: string, options: ApiRequestOptions = {}): Promise<string> {
  const tokens = getStoredTokens()
  const accessToken = options.accessToken || tokens?.access_token

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body,
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    throw new Error(errorPayload.detail || response.statusText)
  }

  return response.text()
}
```

### 1.2 API 客户端结构

```tsx
// src/lib/api.ts
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

export const api = {
  // 认证
  sendVerificationCode: (payload: { email: string; purpose: "login" | "register" | "bind_email" | "delete_account" }) =>
    apiFetch<VerificationCodeResponse>("/api/v1/auth/verification-code", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload: { email: string; username: string; code: string }) =>
    apiFetch<TokenPair>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { email: string; code: string }) =>
    apiFetch<TokenPair>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  refresh: (payload: { refresh_token: string }) =>
    apiFetch<AccessTokenResponse>("/api/v1/auth/refresh", { method: "POST", body: JSON.stringify(payload) }),
  ssoLogin: (payload: { id_token: string }) =>
    apiFetch<TokenPair>("/api/v1/auth/sso/login", { method: "POST", body: JSON.stringify(payload) }),
  ldapLogin: (payload: { username: string; password: string }) =>
    apiFetch<TokenPair>("/api/v1/auth/ldap/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => apiFetch<void>("/api/v1/auth/logout", { method: "POST", skipRefresh: true }),

  // 用户
  getMe: () => apiFetch<User>("/api/v1/users/me"),
  updateMe: (payload: { username?: string; email?: string }) =>
    apiFetch<User>("/api/v1/users/me", { method: "PUT", body: JSON.stringify(payload) }),
  listUsers: (query?: string) => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    const queryString = params.toString()
    return apiFetch<{ items: User[]; total: number }>(`/api/v1/users${queryString ? `?${queryString}` : ""}`)
  },
  updateUserIdentity: (userId: string, payload: UserIdentityUpdate) =>
    apiFetch<User>(`/api/v1/users/${userId}/identity`, { method: "PUT", body: JSON.stringify(payload) }),

  // 用户账户管理
  requestDeleteAccount: () =>
    apiFetch<void>("/api/v1/users/me/delete-request", { method: "POST" }),
  deleteAccount: (payload: { code: string }) =>
    apiFetch<void>("/api/v1/users/me", { method: "DELETE", body: JSON.stringify(payload) }),
  bindEmail: (payload: { email: string; code: string }) =>
    apiFetch<{ bound: boolean }>("/api/v1/users/bind-email", { method: "POST", body: JSON.stringify(payload) }),
  updateUserIdentity: (userId: string, payload: UserIdentityUpdate) =>
    apiFetch<User>(`/api/v1/users/${userId}/identity`, { method: "PUT", body: JSON.stringify(payload) }),

  // Skills
  listSkills: (query?: string, includeInactive?: boolean) =>
    apiFetch<{ items: Skill[]; total: number }>(`/api/v1/skills${query ? `?q=${encodeURIComponent(query)}` : ""}${includeInactive ? (query ? "&" : "?") + "include_inactive=true" : ""}`),
  createSkill: (payload: { name: string; description?: string; tags?: string[]; visible?: "private" | "team" | "enterprise" }) =>
    apiFetch<Skill>("/api/v1/skills", { method: "POST", body: JSON.stringify(payload) }),
  getSkill: (skillUuid: string) => apiFetch<Skill>(`/api/v1/skills/${skillUuid}`),
  updateSkill: (skillUuid: string, payload: { name?: string; description?: string; tags?: string[]; visible?: "private" | "team" | "enterprise" }) =>
    apiFetch<Skill>(`/api/v1/skills/${skillUuid}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSkill: (skillUuid: string) => apiFetch<void>(`/api/v1/skills/${skillUuid}`, { method: "DELETE" }),
  activateSkill: (skillUuid: string) =>
    apiFetch<Skill>(`/api/v1/skills/${skillUuid}/activate`, { method: "POST" }),
  deactivateSkill: (skillUuid: string) =>
    apiFetch<Skill>(`/api/v1/skills/${skillUuid}/deactivate`, { method: "POST" }),
  getSkillCachePolicy: () => apiFetch<SkillCachePolicyResponse>("/api/v1/skills/cache-policy"),

  // Skill 文件管理
  listSkillFiles: (skillUuid: string) => apiFetch<string[]>(`/api/v1/skills/${skillUuid}/files`),
  getSkillFileContent: (skillUuid: string, filePath: string) =>
    apiFetchText(`/api/v1/skills/${skillUuid}/files/${encodeURIComponent(filePath)}`),
  uploadSkillFile: (skillUuid: string, file: File, metadata?: string) => { /* FormData upload */ },

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

  // Tokens
  listTokens: () => apiFetch<{ items: Token[]; total: number }>("/api/v1/tokens"),
  createToken: (payload: { name: string; expires_at?: string }) =>
    apiFetch<Token>("/api/v1/tokens", { method: "POST", body: JSON.stringify(payload) }),
  revokeToken: (tokenId: string) => apiFetch<void>(`/api/v1/tokens/${tokenId}`, { method: "DELETE" }),

  // Dashboard
  getDashboardOverview: () => apiFetch<DashboardOverview>("/api/v1/dashboard/overview"),
  cleanupMetrics: (payload?: { retention_days?: number }) =>
    apiFetch<{ removed: number; retention_days: number; cutoff: string }>("/api/v1/dashboard/metrics/cleanup", { method: "POST", body: JSON.stringify(payload ?? {}) }),
  resetMetrics24h: () =>
    apiFetch<{ removed: number; window_hours: number; window_start: string; window_end: string }>("/api/v1/dashboard/metrics/reset-24h", { method: "POST" }),

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
}
```

### 1.2 文件上传

```tsx
uploadSkillFile: async (skillUuid: string, file: File) => {
  const tokens = getStoredTokens()
  const formData = new FormData()
  formData.append("skill_uuid", skillUuid)
  formData.append("file", file)

  const response = await fetch(`${apiBaseUrl}/api/v1/skills/upload`, {
    method: "POST",
    body: formData,
    headers: tokens?.access_token ? { Authorization: `Bearer ${tokens.access_token}` } : undefined
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    throw new Error(errorPayload.detail || response.statusText)
  }

  return response.json()
}
```

---

## 2. 类型定义

### 2.1 基础类型

```tsx
// src/lib/api.ts
export type TokenPair = {
  access_token: string
  refresh_token: string
}

export type SkillVisible = "private" | "team" | "enterprise"
```

### 2.2 核心数据模型

```tsx
export type Skill = {
  id: string
  user_id?: string
  name: string
  description: string | null
  tags?: string[]
  visible?: SkillVisible
  enterprise_id?: string | null
  team_id?: string | null
  skill_dir?: string
  current_version?: string | null
  is_active?: boolean
  cache_revoked_at?: string | null
  created_at?: string
  updated_at?: string
}

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

export type UserIdentityUpdate = {
  enterprise_id?: string | null
  team_id?: string | null
  role?: string | null
  status?: string | null
}

export type SkillCreateRequest = {
  name: string
  description?: string | null
  tags?: string[]
  visible?: SkillVisible
}

export type SkillUpdateRequest = {
  name?: string
  description?: string | null
  tags?: string[]
  visible?: SkillVisible
}
```

### 2.3 响应类型

```tsx
export type DashboardOverview = {
  active_skills: number
  available_tokens: number
  success_rate: number | null
  success_rate_window_hours: number
  success_rate_total: number
}

export type VerificationCodeResponse = {
  sent: boolean
  expires_in?: number
  resend_interval?: number
  max_attempts?: number
  attempts_left?: number
}

export type AccessTokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: number
}

export type MetricsCleanupResponse = {
  removed: number
  retention_days: number
  cutoff: string
}

export type MetricsReset24hResponse = {
  removed: number
  window_hours: number
  window_start: string
  window_end: string
}
```

### 2.4 Skill 版本相关类型

```tsx
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
  cache_ttl_seconds: number
  encryption_enabled: boolean
  download_encryption_enabled: boolean
}
```

### 2.5 审计日志类型

```tsx
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

### 2.6 错误响应类型

```tsx
export type ApiErrorResponse = {
  detail: string
  code?: ErrorCode
}

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
  | "SKILL_DEACTIVATED"
```

### 2.7 错误码与用户提示映射

| 错误码 | HTTP 状态码 | 用户提示文案 |
|--------|------------|-------------|
| `CODE_EXPIRED` | 400 | 验证码已过期，请重新获取 |
| `CODE_INVALID` | 400 | 验证码错误，请检查后重试 |
| `CODE_MISMATCH` | 400 | 验证码不匹配，请重新输入 |
| `TOO_MANY_ATTEMPTS` | 429 | 操作过于频繁，请稍后再试 |
| `RESEND_TOO_FREQUENT` | 429 | 验证码发送过于频繁，请稍候再试 |
| `EMAIL_ALREADY_EXISTS` | 409 | 该邮箱已注册，请直接登录或找回密码 |
| `USERNAME_ALREADY_EXISTS` | 409 | 该用户名已被占用，请选择其他用户名 |
| `REGISTRATION_DISABLED` | 403 | 当前关闭注册，请联系管理员 |
| `LOGIN_DISABLED` | 403 | 登录已被禁用，请联系管理员 |
| `ACCOUNT_DELETED` | 410 | 账户已注销，无法登录 |
| `TOKEN_EXPIRED` | 401 | 登录已过期，请重新登录 |
| `TOKEN_INVALID` | 401 | 无效的认证凭证，请重新登录 |
| `PERMISSION_DENIED` | 403 | 您没有权限执行此操作 |
| `RESOURCE_NOT_FOUND` | 404 | 请求的资源不存在 |
| `VALIDATION_ERROR` | 422 | 提交信息有误，请检查后重试 |
| `INTERNAL_SERVER_ERROR` | 500 | 服务器错误，请稍后再试 |
| `SKILL_DEACTIVATED` | 403 | 该技能已停用，无法使用 |

### 2.8 错误处理工具函数

```tsx
// 错误码与用户提示映射表（顶层常量，供两个函数共享）
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
  "SKILL_DEACTIVATED": "该技能已停用，无法使用",
}

/**
 * 根据错误码获取用户友好的错误提示
 * @param code 错误码
 * @returns 用户友好的错误提示信息
 */
export function getUserFriendlyErrorMessage(code: string): string {
  return errorMessages[code] || code || "操作失败，请稍后再试"
}

/**
 * 从错误对象中提取用户友好的错误消息
 * @param error 错误对象
 * @returns 用户友好的错误提示信息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // 尝试从 detail 字段获取错误码
    const detail = (error as any).detail
    if (typeof detail === "string") {
      // 检查是否是错误码
      if (detail in errorMessages) {
        return errorMessages[detail]
      }
      return detail
    }
    // 尝试从 message 字段解析
    const message = error.message
    if (message in errorMessages) {
      return errorMessages[message]
    }
    return message
  }
  if (typeof error === "string") {
    return errorMessages[error] || error
  }
  return "操作失败，请稍后再试"
}
```

---

## 3. 前后端契约映射

### 3.1 接口对照表

| 页面/能力 | 前端调用 | 后端接口 | 状态 |
|---|---|---|---|
| 登录验证码发送 | `api.sendVerificationCode({ purpose: "login" })` | `POST /api/v1/auth/verification-code` | ✅ 已实现 |
| 注册验证码发送 | `api.sendVerificationCode({ purpose: "register" })` | `POST /api/v1/auth/verification-code` | ✅ 已实现 |
| 绑定邮箱验证码 | `api.sendVerificationCode({ purpose: "bind_email" })` | `POST /api/v1/auth/verification-code` | ✅ 已实现 |
| 登录 | `api.login` | `POST /api/v1/auth/login` | ✅ 已实现 |
| 注册 | `api.register` | `POST /api/v1/auth/register` | ✅ 已实现 |
| Token 刷新 | `api.refresh` + `apiFetch` 自动重试 | `POST /api/v1/auth/refresh` | ✅ 已实现 |
| 获取当前用户 | `api.getMe` | `GET /api/v1/users/me` | ✅ 已实现 |
| 更新当前用户 | `api.updateMe` | `PUT /api/v1/users/me` | ✅ 已实现 |
| 列出用户 | `api.listUsers` | `GET /api/v1/users?q=` | ✅ 已实现（仅 superuser） |
| 更新用户身份 | `api.updateUserIdentity` | `PUT /api/v1/users/:id/identity` | ✅ 已实现（仅 superuser） |
| 概览统计 | `api.getDashboardOverview` | `GET /api/v1/dashboard/overview` | ✅ 已实现 |
| 指标清理 | `api.cleanupMetrics` | `POST /api/v1/dashboard/metrics/cleanup` | ✅ 已实现（仅 superuser，删除指定天数前的数据） |
| 指标 24h 重置 | `api.resetMetrics24h` | `POST /api/v1/dashboard/metrics/reset-24h` | ✅ 已实现（删除过去 24h 数据） |
| Skill 列表 | `api.listSkills(includeInactive?)` | `GET /api/v1/skills` | ✅ 已实现（支持 `include_inactive` 参数） |
| Skill 创建 | `api.createSkill({ visible? })` | `POST /api/v1/skills` | ✅ 已实现（支持 `visible` 参数） |
| Skill 详情 | `api.getSkill` | `GET /api/v1/skills/{skill_uuid}` | ✅ 已实现 |
| Skill 更新 | `api.updateSkill({ visible? })` | `PUT /api/v1/skills/{skill_uuid}` | ✅ 已实现（支持 `visible` 参数） |
| Skill 删除 | `api.deleteSkill` | `DELETE /api/v1/skills/{skill_uuid}` | ✅ 已实现 |
| Skill 文件列表 | `api.listSkillFiles` | `GET /api/v1/skills/{skill_uuid}/files` | ✅ 已实现 |
| Skill 文件预览 | `api.getSkillFileContent` | `GET /api/v1/skills/{skill_uuid}/files/{file_path}` | ✅ 已实现 |
| Skill 文件上传 | `api.uploadSkillFile` | `POST /api/v1/skills/upload` | ✅ 已实现 |
| Token 列表 | `api.listTokens` | `GET /api/v1/tokens` | ✅ 已实现 |
| Token 创建 | `api.createToken` | `POST /api/v1/tokens` | ✅ 已实现 |
| Token 撤销 | `api.revokeToken` | `DELETE /api/v1/tokens/{token_id}` | ✅ 已实现 |
| SSO 登录 | `api.ssoLogin({ id_token })` | `POST /api/v1/auth/sso/login` | ✅ 已实现（需后端配置 `ENABLE_SSO=true`） |
| LDAP 登录 | `api.ldapLogin({ username, password })` | `POST /api/v1/auth/ldap/login` | ✅ 已实现（需后端配置 `ENABLE_LDAP=true`） |
| 登出 | `api.logout()` | `POST /api/v1/auth/logout` | ✅ 已实现 |
| Skill 缓存策略 | `api.getSkillCachePolicy()` | `GET /api/v1/skills/cache-policy` | ✅ 已实现 |
| 请求删除账户验证码 | `api.requestDeleteAccount` | `POST /api/v1/users/me/delete-request` | ✅ 已实现 |
| 账户删除 | `api.deleteAccount({ code })` | `DELETE /api/v1/users/me` | ✅ 已实现 |
| 邮箱绑定 | `api.bindEmail({ email, code })` | `POST /api/v1/users/bind-email` | ✅ 已实现 |
| 用户身份管理 | `api.updateUserIdentity(userId, payload)` | `PUT /api/v1/users/{user_id}/identity` | ✅ 已实现 |
| Skill 激活 | `api.activateSkill(skillUuid)` | `POST /api/v1/skills/{skill_uuid}/activate` | ✅ 已实现 |
| Skill 停用 | `api.deactivateSkill(skillUuid)` | `POST /api/v1/skills/{skill_uuid}/deactivate` | ✅ 已实现 |
| Skill 版本列表 | `api.listSkillVersions(skillUuid)` | `GET /api/v1/skills/{skill_uuid}/versions` | ✅ 已实现 |
| Skill 版本详情 | `api.getSkillVersion(skillUuid, version)` | `GET /api/v1/skills/{skill_uuid}/versions/{version}` | ✅ 已实现 |
| Skill 版本对比 | `api.diffSkillVersions(skillUuid, from, to)` | `GET /api/v1/skills/{skill_uuid}/versions/diff` | ✅ 已实现 |
| Skill 安装说明 | `api.getInstallInstructions(skillUuid, version)` | `GET /api/v1/skills/{skill_uuid}/versions/{version}/install-instructions` | ✅ 已实现 |
| Skill 版本回滚 | `api.rollbackSkillVersion(skillUuid, version)` | `POST /api/v1/skills/{skill_uuid}/versions/{version}/rollback` | ✅ 已实现 |
| Skill 下载 | `api.downloadSkill({ skill_uuid, version? })` | `POST /api/v1/skills/download` | ✅ 已实现 |

**图例**：✅ 已实现 | ❌ 需修复/移除 | 🔲 待实现

### 3.2 后端 Schema 与前端类型对照

| 后端 Schema | 后端实际字段 | 前端类型字段 | 说明 |
|------------|------------|------------|------|
| `SkillResponse` | `id, user_id, name, description, tags, visible, enterprise_id, team_id, skill_dir, current_version, is_active, cache_revoked_at, created_at, updated_at` | `id, user_id?, name, description, tags?, visible?, enterprise_id?, team_id?, skill_dir?, current_version?, is_active?, cache_revoked_at?, created_at?, updated_at?` | ✅ 已对齐 |
| `TokenResponse` | `id, user_id, name, token?, is_active, expires_at, last_used_at, created_at` | `id, user_id?, name, token?, is_active, expires_at?, last_used_at?, created_at` | ✅ 已对齐 |
| `UserResponse` | `id, email, username, is_active, is_superuser, enterprise_id, team_id, role, status, created_at, updated_at` | `id, email, username, is_active, is_superuser, enterprise_id?, team_id?, role, status, created_at, updated_at` | ✅ 已对齐 |
| `SkillVersionResponse` | `version, description, dependencies, dependency_spec, dependency_spec_version, metadata, created_at` | `version, description, dependencies, dependency_spec?, dependency_spec_version?, metadata, created_at` | 已对齐 |
| `SkillVersionDiffResponse` | `from_version, to_version, added, removed, modified` | `from_version, to_version, added, removed, modified` | 已对齐 |
| `SkillInstallInstructionsResponse` | `strategy, dependencies, requirements_text, commands, ecosystem, manifests, dependency_spec` | `strategy, dependencies, requirements_text, commands, ecosystem?, manifests?, dependency_spec?` | 已对齐 |
| `SkillDownloadResponse` | `skill_uuid, version, encrypted_code, checksum, expires_at, cache_ttl_seconds` | `skill_uuid, version, encrypted_code, checksum, expires_at, cache_ttl_seconds?` | 已对齐 |
| `VerificationCodeResponse` | `sent, expires_in, resend_interval, max_attempts, attempts_left` | `sent, expires_in?, resend_interval?, max_attempts?, attempts_left?` | 已对齐 |
| `VerificationCodeRequest.purpose` | `"login" \| "register" \| "bind_email" \| "delete_account"` | `"login" \| "register" \| "bind_email" \| "delete_account"` | 已对齐 |
| `AuditLogItem` | `id, actor_id, action, target, result, timestamp, ip, user_agent, details` | `id, actor_id, action, target, result, timestamp, ip, user_agent, details` | 已对齐 |
| `AuditLogExportRequest` | `format, filters` | `format, filters?` | 已对齐 |
| `AuditLogExportResponse` | `format, content` | `format, content` | 已对齐 |

### 3.3 审计日志 API

| 接口 | 路径 | 权限 | 说明 |
|------|------|------|------|
| 审计日志列表 | `GET /api/v1/audit/logs` | `audit.read` | 支持按 actor_id、action、start、end 过滤 |
| 审计日志导出 | `POST /api/v1/audit/logs/export` | `audit.export` | 支持 JSON/CSV 格式，最多导出 1000 条 |

### 3.4 前端当前实现差异

| 功能 | 前端实现 | 后端接口 | 差异说明 | 优先级 |
|------|---------|---------|---------|--------|
| 账户删除 | ✅ `requestDeleteAccount` + `deleteAccount({ code })` | 需 `code`（通过 `/me/delete-request` 获取） | 已对齐 | - |
| 修改密码 | ✅ 已从契约中移除 | **后端无此接口** | 已移除 | - |
| 验证码发送 | ✅ 支持 `purpose: "login" \| "register" \| "bind_email" \| "delete_account"` | 支持全部 4 种 purpose | 已对齐 | - |
| Skill 类型 | ✅ 13 个字段完整 | `SkillResponse` 13 个字段 | 已对齐 | - |
| Skill 创建 | ✅ 支持 `visible` 参数 | `SkillCreate` 支持 `visible` | 已对齐 | - |
| Skill 更新 | ✅ 支持 `visible` 参数 | `SkillUpdate` 支持 `visible` | 已对齐 | - |
| Skill 列表 | ✅ 支持 `include_inactive` 参数 | `GET /api/v1/skills` 支持 `include_inactive` | 已对齐 | - |
| User 类型 | ✅ 11 个字段完整 | `UserResponse` 11 个字段 | 已对齐 | - |
| 审计日志 | ✅ 已实现 `listAuditLogs` 和 `exportAuditLogs` | 完整接口已存在 | 已对齐 | - |
