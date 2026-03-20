# Open SkillHub 前端构建与设计文档 - Part 4

## 认证与安全

> 本文档为 `frontend-design.md` 的第4部分，聚焦于认证流程、安全机制、审计日志、权限系统。
>
> **关联文档**：
> - [frontend-design-03-api-types.md](./frontend-design-03-api-types.md) - API类型定义
> - [frontend-design-05-business-exception.md](./frontend-design-05-business-exception.md) - 业务逻辑与异常
> - [frontend-design-06-basics-readonly.md](./frontend-design-06-basics-readonly.md) - 技术基础（只读）

---

## 目录

1. [认证流程](#1-认证流程)
2. [Token 自动刷新](#2-token-自动刷新)
3. [路由保护](#3-路由保护)
4. [权限系统](#4-权限系统)
5. [审计日志](#5-审计日志)

---

## 1. 认证流程

### 1.1 邮箱验证码登录

```
┌─────────────────────────────────────────────────────────────────┐
│                        认证流程                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 用户输入邮箱，点击"发送验证码"                                  │
│     POST /api/v1/auth/verification-code { email, purpose }       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. 用户输入验证码，点击"登录"                                      │
│     POST /api/v1/auth/login { email, code }                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 后端返回 Token 对                                              │
│     { access_token, refresh_token }                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. 前端存储 Token 到 localStorage                                 │
│     storeTokens({ access_token, refresh_token })                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. 跳转到控制台首页                                                │
│     router.replace("/dashboard")                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 登录方式支持

| 登录方式 | 环境变量 | 说明 |
|---------|---------|------|
| 邮箱验证码 | `ENABLE_EMAIL_OTP_LOGIN` (默认 true) | 主要登录方式 |
| SSO | `ENABLE_SSO` | 企业单点登录 |
| LDAP | `ENABLE_LDAP` | LDAP 目录认证 |

### 1.3 注册流程

```
用户输入邮箱、用户名 → 发送验证码 → 输入验证码 → 注册成功
```

**注意**：`ENABLE_PUBLIC_SIGNUP=false` 时隐藏注册入口。

---

## 2. Token 自动刷新

### 2.1 Token 存储

```tsx
// src/lib/api.ts
const storageKey = "skillhub.tokens"

export function getStoredTokens(): TokenPair | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return null
  return JSON.parse(raw) as TokenPair
}

export function storeTokens(tokens: TokenPair) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(storageKey, JSON.stringify(tokens))
}

export function clearTokens() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(storageKey)
}
```

### 2.2 自动刷新机制

```tsx
// src/lib/api.ts
async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { response, payload } = await fetchJson(path, options)

  if (response.ok) {
    return payload as T
  }

  // 401 错误时尝试刷新 Token
  if (response.status === 401 && !options.skipRefresh) {
    const tokens = getStoredTokens()
    if (tokens?.refresh_token) {
      try {
        const refreshed = await refreshTokens(tokens.refresh_token)
        storeTokens({ access_token: refreshed.access_token, refresh_token: tokens.refresh_token })
        // 使用新 Token 重试请求
        const retry = await fetchJson(path, { ...options, accessToken: refreshed.access_token })
        if (retry.response.ok) {
          return retry.payload as T
        }
      } catch (error) {
        clearTokens()
        throw error
      }
    }
  }

  throw new Error(getDetail(payload, response.statusText))
}
```

### 2.3 Token 刷新流程

```
API 请求 → 401 Unauthorized → 检查 refresh_token
    │
    ├── 存在 → 调用 refresh API → 存储新 token → 重试原请求
    │
    └── 不存在/失败 → 清除 token → 跳转登录页
```

---

## 3. 路由保护

### 3.1 路由分类

| 路由类型 | 路径 | 保护策略 |
|---------|------|---------|
| 公开路由 | `/login`, `/register` | 无需认证，已登录用户自动跳转到 `/dashboard` |
| 受保护路由 | `/dashboard`, `/skills/*`, `/tokens`, `/profile`, `/security` | 需要有效 Token，否则跳转到 `/login` |
| 首页 | `/` | 显示入口卡片，无自动重定向 |

### 3.2 保护实现

```tsx
// src/components/app/app-shell.tsx
"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { getStoredTokens } from "@/lib/api"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  const isAuthRoute = pathname === "/login" || pathname === "/register"
  const isHomePage = pathname === "/"

  useEffect(() => {
    const tokens = getStoredTokens()

    // 已登录用户访问认证页面 -> 跳转到控制台
    if (isAuthRoute && tokens?.access_token) {
      router.replace("/dashboard")
      return
    }

    // 未登录用户访问受保护页面 -> 跳转到登录
    if (!isAuthRoute && !isHomePage && !tokens?.access_token) {
      router.replace("/login")
      return
    }

    setChecking(false)
  }, [isAuthRoute, isHomePage, router])

  // 认证检查中，显示空白或加载状态
  if (checking && !isAuthRoute && !isHomePage) {
    return null
  }

  // 认证路由：无导航栏
  if (isAuthRoute) {
    return <main className="min-h-screen">{children}</main>
  }

  // 受保护路由：带导航栏
  return (
    <div className="min-h-screen bg-[radial-gradient(...)]">
      <header>
        {/* Logo + 用户菜单 + 导航标签 */}
      </header>
      <main className="container mx-auto max-w-screen-xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}
```

### 3.3 Token 过期处理

当 API 返回 401 且 Token 刷新失败时：
1. 清除本地存储的 Token
2. 跳转到 `/login` 页面
3. 可选：保存当前路径，登录后重定向回原页面

---

## 4. 权限系统

### 4.1 RBAC 权限模型

后端采用 Role-Based Access Control (RBAC) 控制用户权限。

**默认角色权限**：

| 角色 | 权限列表 |
|------|----------|
| `admin` | `*` (所有权限) |
| `member` | `skill.list`, `skill.read`, `skill.create`, `skill.update`, `skill.delete`, `skill.upload`, `skill.execute` |
| `viewer` | `skill.list`, `skill.read` |

**权限检查逻辑**：

```python
# 后端权限检查伪代码
def has_permission(user, permission):
    if not ENABLE_RBAC:
        return True  # 跳过权限检查
    if user.is_superuser:
        return True
    role = user.role or "member"
    permissions = get_role_permissions(role)
    return "*" in permissions or permission in permissions
```

### 4.2 Skill 可见性规则

| 可见性 | 说明 | 可见范围 |
|--------|------|---------|
| `private` | 仅创建者可见 | 创建者本人 |
| `team` | 团队内可见 | 同一 `team_id` 的用户 |
| `enterprise` | 企业内可见 | 同一 `enterprise_id` 的用户 |

**前端条件渲染**：

```tsx
{user.role === "admin" && (
  <Button onClick={handleDelete}>删除 Skill</Button>
)}

{skill.visible !== "private" && (
  <Badge>团队可见</Badge>
)}
```

### 4.3 前端权限适配

```tsx
// 检查用户权限
const canEditSkill = user.role === "admin" || skill.created_by === user.id
const canDeleteSkill = user.role === "admin"
const canManageTokens = user.role === "admin" || user.role === "member"
```

---

## 5. 审计日志

### 5.1 功能说明

审计日志用于记录用户在系统中的关键操作行为，支持查询和导出。

**前置条件**：`ENABLE_AUDIT_LOG=true` 且用户具有 `audit.read` 权限。

### 5.2 API 接口

| 接口 | 路径 | 权限 | 说明 |
|------|------|------|------|
| 审计日志列表 | `GET /api/v1/audit/logs` | `audit.read` | 支持按 actor_id、action、start、end 过滤 |
| 审计日志导出 | `POST /api/v1/audit/logs/export` | `audit.export` | 支持 JSON/CSV 格式，最多导出 1000 条 |

### 5.3 审计日志类型

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

### 5.4 API 客户端扩展

```tsx
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
```

### 5.5 条件渲染

```tsx
// 仅在启用审计日志且用户有权限时显示入口
{featureFlags.enableAuditLog && (
  <Link href="/audit-logs">审计日志</Link>
)}
```
