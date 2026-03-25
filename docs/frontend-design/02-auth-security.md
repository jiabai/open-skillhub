# Open SkillHub 前端构建与设计文档 - Part 2

## 认证与安全

> 本文档为 `index.md` 的第2部分，聚焦于认证流程、安全机制、审计日志、权限系统。
>
> **关联文档**：
> - [01-api-types.md](./01-api-types.md) - API类型定义
> - [03-business-exception.md](./03-business-exception.md) - 业务逻辑与异常
> - [04-basics-readonly.md](./04-basics-readonly.md) - 技术基础（只读）

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
const storageKey = "backend.tokens"

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
| 管理员路由 | `/admin/users` | 仅管理员（`is_superuser` 或 `role === "admin"`）可见 |
| 首页 | `/` | 显示入口卡片，无自动重定向 |

### 3.2 保护实现

```tsx
// src/components/app/app-shell.tsx
"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { clearTokens, getStoredTokens, api } from "@/lib/api"
import { featureFlags } from "@/lib/feature-flags"
import type { User } from "@/types"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthRoute = pathname === "/login" || pathname === "/register"
  const [isChecking, setIsChecking] = useState(!isAuthRoute)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    // 认证路由：已登录用户自动跳转到控制台
    if (isAuthRoute) {
      const tokens = getStoredTokens()
      if (tokens?.access_token) {
        router.replace("/dashboard")
        return
      }
      setIsChecking(false)
      return
    }

    // 受保护路由：检查 Token
    const tokens = getStoredTokens()
    if (!tokens?.access_token) {
      router.replace("/login")
      return
    }

    // 获取当前用户信息（用于权限判断）
    const fetchUser = async () => {
      try {
        const user = await api.getMe()
        setCurrentUser(user)
      } catch {
        // 忽略错误，用户可能已登出
      }
    }
    fetchUser()
    setIsChecking(false)
  }, [isAuthRoute, router])

  // ... 渲染逻辑
}
```

### 3.3 动态导航菜单

导航菜单根据用户权限和功能开关动态生成：

```tsx
// 根据权限生成导航项
const canManageUsers = currentUser?.is_superuser || currentUser?.role === "admin"

const navItems = [
  { href: "/dashboard", label: "概览", icon: LayoutGrid },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/tokens", label: "Tokens", icon: KeyRound },
  // 审计日志：根据功能开关显示
  ...(featureFlags.enableAuditLog ? [{ href: "/audit", label: "审计日志", icon: ScrollText }] : []),
  // 用户管理：仅管理员可见
  ...(canManageUsers ? [{ href: "/admin/users", label: "用户管理", icon: Users }] : []),
  { href: "/profile", label: "个人信息", icon: User2 },
  { href: "/security", label: "安全", icon: ShieldCheck }
]
```

### 3.4 路由保护流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        路由访问请求                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  是否为认证路由？ │
                    │  /login, /register │
                    └─────────────────┘
                     /            \
                   是              否
                    │              │
                    ▼              ▼
            ┌─────────────┐  ┌─────────────────┐
            │ 检查 Token   │  │ 检查 Token       │
            └─────────────┘  └─────────────────┘
              /      \          /          \
           有Token  无Token   有Token     无Token
            │        │         │           │
            ▼        ▼         ▼           ▼
      跳转/dashboard  渲染页面  获取用户信息  跳转/login
                               │
                               ▼
                      ┌─────────────────┐
                      │ 根据权限生成导航  │
                      └─────────────────┘
```

### 3.5 权限控制点

| 控制点 | 检查条件 | 效果 |
|--------|----------|------|
| 用户管理入口 | `is_superuser \|\| role === "admin"` | 仅管理员可见 |
| 审计日志入口 | `featureFlags.enableAuditLog` | 根据功能开关显示 |
| Skill 编辑 | `role === "admin" \|\| created_by === user.id` | 创建者或管理员可编辑 |
| Skill 删除 | `role === "admin"` | 仅管理员可删除 |

### 3.6 Token 过期处理

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

---

## 6. 用户管理功能

### 6.1 功能概述

用户管理是管理员专属功能，用于管理系统中的用户身份信息。

**访问权限**：仅 `is_superuser` 或 `role === "admin"` 可访问

**路由路径**：`/admin/users`

### 6.2 页面功能

| 功能 | 描述 |
|------|------|
| 用户列表 | 展示所有用户，包括用户名、邮箱、角色、状态、企业/团队 |
| 搜索用户 | 支持按用户名或邮箱模糊搜索（防抖 300ms） |
| 编辑身份 | 修改用户的角色、状态、企业 ID、团队 ID |

### 6.3 用户角色选项

| 角色值 | 显示名称 | 说明 |
|--------|---------|------|
| `admin` | 管理员 | 拥有所有权限 |
| `member` | 成员 | 可创建和管理自己的 Skills |
| `viewer` | 只读 | 仅可查看 Skills |

### 6.4 用户状态选项

| 状态值 | 显示名称 | 说明 |
|--------|---------|------|
| `active` | 正常 | 用户可正常使用系统 |
| `inactive` | 停用 | 用户被禁用 |
| `pending` | 待审核 | 用户等待审核 |

### 6.5 页面实现

```tsx
// src/app/admin/users/page.tsx
"use client"

import { api, getErrorMessage } from "@/lib/api"
import type { User, UserIdentityUpdate } from "@/types"

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<UserIdentityUpdate>({})

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // 获取用户列表
  const fetchUsers = useCallback(async () => {
    const response = await api.listUsers(searchDebounced)
    setUsers(response.items)
  }, [searchDebounced])

  // 编辑用户身份
  const handleEditSubmit = async () => {
    await api.updateUserIdentity(editingUser.id, editForm)
    // 刷新列表
    await fetchUsers()
  }

  // ... 渲染逻辑
}
```

### 6.6 API 接口

| 接口 | 路径 | 权限 | 说明 |
|------|------|------|------|
| 获取用户列表 | `GET /api/v1/users?q=` | superuser | 支持模糊搜索 |
| 更新用户身份 | `PUT /api/v1/users/{user_id}/identity` | superuser | 修改角色、状态、企业/团队 |

### 6.7 导航入口控制

```tsx
// 在 AppShell 中动态生成导航项
const canManageUsers = currentUser?.is_superuser || currentUser?.role === "admin"

const navItems = [
  // ... 其他导航项
  ...(canManageUsers ? [{ href: "/admin/users", label: "用户管理", icon: Users }] : []),
]
```
