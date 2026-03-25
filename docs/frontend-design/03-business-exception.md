# Open SkillHub 前端构建与设计文档 - Part 3

## 业务逻辑与异常

> 本文档为 `index.md` 的第3部分，聚焦于功能开关、异常场景处理、业务逻辑。
>
> **关联文档**：
> - [01-api-types.md](./01-api-types.md) - API类型定义
> - [02-auth-security.md](./02-auth-security.md) - 认证与安全
> - [04-basics-readonly.md](./04-basics-readonly.md) - 技术基础（只读）

---

## 目录

1. [功能开关与条件渲染](#1-功能开关与条件渲染)
2. [异常场景处理](#2-异常场景处理)
3. [状态管理](#3-状态管理)
4. [当前差异与修复优先级](#4-当前差异与修复优先级)

---

## 1. 功能开关与条件渲染

### 1.1 核心开关配置

后端通过 Feature Flags 控制功能可用性，前端应根据这些开关条件渲染 UI。

| 后端环境变量 | 前端环境变量 | 类型 | 说明 |
|-------------|-------------|------|------|
| `ENABLE_PUBLIC_SIGNUP` | `NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP` | boolean | 是否开放注册（`false` 时隐藏注册入口） |
| `ENABLE_EMAIL_OTP_LOGIN` | `NEXT_PUBLIC_ENABLE_EMAIL_OTP_LOGIN` | boolean | 是否启用邮箱验证码登录 |
| `ENABLE_SSO` | `NEXT_PUBLIC_ENABLE_SSO` | boolean | 是否启用 SSO 登录（`true` 时显示 SSO 登录入口） |
| `ENABLE_LDAP` | `NEXT_PUBLIC_ENABLE_LDAP` | boolean | 是否启用 LDAP 登录（`true` 时显示 LDAP 登录入口） |
| `ENABLE_ORG_MODEL` | `NEXT_PUBLIC_ENABLE_ORG_MODEL` | boolean | 是否启用组织模型（影响 enterprise_id/team_id 字段） |
| `ENABLE_RBAC` | `NEXT_PUBLIC_ENABLE_RBAC` | boolean | 是否启用 RBAC 权限控制 |
| `ENABLE_SKILL_VISIBILITY` | `NEXT_PUBLIC_ENABLE_SKILL_VISIBILITY` | boolean | 是否启用 Skill 可见性控制 |
| `ENABLE_AUDIT_LOG` | `NEXT_PUBLIC_ENABLE_AUDIT_LOG` | boolean | 是否启用审计日志功能 |
| `ENABLE_AUDIT_EXPORT` | `NEXT_PUBLIC_ENABLE_AUDIT_EXPORT` | boolean | 是否允许导出审计日志 |

> **注意**：前端只能访问 `NEXT_PUBLIC_` 前缀的环境变量。后端环境变量（无 `NEXT_PUBLIC_` 前缀）仅供后端服务使用。

### 1.2 前端适配实现

```tsx
// src/lib/feature-flags.ts
export const featureFlags = {
  enablePublicSignup: process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP === "true",
  enableEmailOtpLogin: process.env.NEXT_PUBLIC_ENABLE_EMAIL_OTP_LOGIN !== "false",
  enableSSO: process.env.NEXT_PUBLIC_ENABLE_SSO === "true",
  enableLDAP: process.env.NEXT_PUBLIC_ENABLE_LDAP === "true",
  enableOrgModel: process.env.NEXT_PUBLIC_ENABLE_ORG_MODEL === "true",
  enableRBAC: process.env.NEXT_PUBLIC_ENABLE_RBAC !== "false",
  enableSkillVisibility: process.env.NEXT_PUBLIC_ENABLE_SKILL_VISIBILITY === "true",
  enableAuditLog: process.env.NEXT_PUBLIC_ENABLE_AUDIT_LOG === "true",
  enableAuditExport: process.env.NEXT_PUBLIC_ENABLE_AUDIT_EXPORT === "true",
}
```

### 1.3 条件渲染示例

```tsx
// 登录页条件渲染
{featureFlags.enableSSO && (
  <Button variant="outline" onClick={() => handleSSOLogin()}>
    SSO 登录
  </Button>
)}

{featureFlags.enableLDAP && (
  <Button variant="outline" onClick={() => handleLDAPLogin()}>
    LDAP 登录
  </Button>
)}

// 注册入口（仅在启用注册时显示）
{featureFlags.enablePublicSignup && (
  <Link href="/register">创建账号</Link>
)}

// 审计日志入口
{featureFlags.enableAuditLog && (
  <Link href="/audit-logs">审计日志</Link>
)}
```

---

## 2. 异常场景处理

### 2.1 完整错误码列表

后端返回的错误码共 17 个，前端已实现完整的用户友好提示映射：

| 错误码 | HTTP 状态码 | 说明 | 用户提示文案 |
|--------|------------|------|-------------|
| `CODE_EXPIRED` | 400 | 验证码已过期 | "验证码已过期，请重新获取" |
| `CODE_INVALID` | 400 | 验证码错误 | "验证码错误，请检查后重试" |
| `CODE_MISMATCH` | 400 | 验证码不匹配 | "验证码不匹配，请重新输入" |
| `TOO_MANY_ATTEMPTS` | 429 | 尝试次数过多 | "操作过于频繁，请稍后再试" |
| `RESEND_TOO_FREQUENT` | 429 | 重发过于频繁 | "验证码发送过于频繁，请稍候再试" |
| `EMAIL_ALREADY_EXISTS` | 409 | 邮箱已注册 | "该邮箱已注册，请直接登录或找回密码" |
| `USERNAME_ALREADY_EXISTS` | 409 | 用户名已占用 | "该用户名已被占用，请选择其他用户名" |
| `REGISTRATION_DISABLED` | 403 | 注册已关闭 | "当前关闭注册，请联系管理员" |
| `LOGIN_DISABLED` | 403 | 登录已禁用 | "登录已被禁用，请联系管理员" |
| `ACCOUNT_DELETED` | 410 | 账户已注销 | "账户已注销，无法登录" |
| `TOKEN_EXPIRED` | 401 | Token 过期 | "登录已过期，请重新登录" |
| `TOKEN_INVALID` | 401 | Token 无效 | "无效的认证凭证，请重新登录" |
| `PERMISSION_DENIED` | 403 | 权限不足 | "您没有权限执行此操作" |
| `RESOURCE_NOT_FOUND` | 404 | 资源不存在 | "请求的资源不存在" |
| `VALIDATION_ERROR` | 422 | 验证错误 | "提交信息有误，请检查后重试" |
| `INTERNAL_SERVER_ERROR` | 500 | 服务器错误 | "服务器错误，请稍后再试" |
| `SKILL_DEACTIVATED` | 403 | Skill 已停用 | "该技能已停用，无法使用" |

### 2.2 错误处理实现

```tsx
// src/lib/api.ts - 错误码映射表
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

// 根据错误码获取用户友好的错误提示
export function getUserFriendlyErrorMessage(code: string): string {
  return errorMessages[code] || code || "操作失败，请稍后再试"
}

// 从错误对象中提取用户友好的错误消息
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const detail = (error as any).detail
    if (typeof detail === "string") {
      if (detail in errorMessages) {
        return errorMessages[detail]
      }
      return detail
    }
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

### 2.3 使用示例

```tsx
// 页面中使用错误处理
import { getErrorMessage, getUserFriendlyErrorMessage } from "@/lib/api"

// 方式一：直接使用错误码
const message = getUserFriendlyErrorMessage("CODE_EXPIRED")
// 输出: "验证码已过期，请重新获取"

// 方式二：从捕获的错误中提取
try {
  await api.login({ email, code })
} catch (err) {
  const message = getErrorMessage(err)
  toast({ title: "登录失败", description: message, variant: "error" })
}
```

### 2.4 网络异常处理

```tsx
// 网络异常检测
const handleNetworkError = (error: unknown) => {
  if (navigator.onLine === false) {
    return "网络已断开，请检查网络连接"
  }
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return "服务器不可用，请稍后再试"
  }
  if (error instanceof Error && error.message.includes("timeout")) {
    return "请求超时，请重试"
  }
  return "操作失败，请稍后再试"
}

// 使用
try {
  await api.getData()
} catch (error) {
  setError(handleNetworkError(error))
}
```

### 2.5 注册异常

| 错误码 | 说明 | 建议提示 |
|--------|------|---------|
| `EMAIL_ALREADY_EXISTS` | 邮箱已注册 | "该邮箱已注册，请直接登录或找回密码" |
| `USERNAME_ALREADY_EXISTS` | 用户名已占用 | "该用户名已被占用，请选择其他用户名" |
| `REGISTRATION_DISABLED` | 注册已关闭 | "当前关闭注册，请联系管理员" |

### 2.6 验证码发送限制

```tsx
// 倒计时实现
const [countdown, setCountdown] = useState(0)

const handleSendCode = async () => {
  if (countdown > 0) return

  try {
    await api.sendVerificationCode({ email, purpose: "login" })
    setCountdown(60) // 60秒倒计时
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  } catch (error) {
    setError(handleError(error))
  }
}

// 按钮文案
{countdown > 0 ? `${countdown}秒后可重新发送` : "发送验证码"}
```

### 2.7 并发操作冲突

```tsx
// 乐观更新与回滚
const [skills, setSkills] = useState<Skill[]>([])

const handleDeleteSkill = async (skillId: string) => {
  const previousSkills = [...skills]

  // 乐观更新：立即移除
  setSkills(skills.filter((s) => s.id !== skillId))

  try {
    await api.deleteSkill(skillId)
  } catch (error) {
    // 回滚
    setSkills(previousSkills)
    setError("删除失败，请稍后再试")
  }
}
```

---

## 3. 状态管理

### 3.1 本地状态模式

页面级状态使用 React `useState`：

```tsx
const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
const [error, setError] = useState<string | null>(null)
const [skills, setSkills] = useState<Skill[]>([])
```

### 3.2 数据获取模式

```tsx
// 标准数据加载模式
const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

useEffect(() => {
  const loadData = async () => {
    setStatus("loading")
    try {
      const data = await api.getData()
      setData(data)
      setStatus("ready")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "加载失败")
    }
  }
  loadData()
}, [])
```

### 3.3 表单验证规范

**验证时机**：
- 邮箱：失焦时验证格式
- 验证码：实时验证长度（6位）
- 必填字段：提交时验证

**验证规则**：

| 字段 | 规则 | 错误提示 | 验证时机 |
|------|------|---------|---------|
| 邮箱 | 正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | "请输入有效的邮箱地址" | 失焦 |
| 验证码 | 长度 === 6，仅数字 `^\d{6}$` | "验证码为 6 位数字" | 实时 |
| 用户名 | 非空，长度 3-50 字符，字母数字下划线 `^[a-zA-Z0-9_]{3,50}$` | "用户名至少 3 个字符" / "用户名最多 50 个字符" / "用户名只能包含字母、数字和下划线" | 失焦 |
| Skill 名称 | 非空，长度 1-100 字符 | "名称不能为空" / "名称最长 100 字符" | 提交时 |
| Skill 描述 | 可选，最长 500 字符 | "描述最长 500 字符" | 失焦 |
| Skill 标签 | 可选，数组，每项最长 30 字符，最多 10 个 | "单个标签最长 30 字符" / "最多添加 10 个标签" | 失焦 |
| Token 名称 | 非空，长度 1-100 字符 | "Token 名称不能为空" / "Token 名称最长 100 字符" | 提交时 |
| Token 有效期 | 可选，必须是将来的日期 | "有效期必须是将来的日期" | 失焦 |
| 密码（未来扩展） | 长度 8-128 字符，至少包含大小写字母和数字 | "密码至少 8 个字符" / "密码必须包含大小写字母和数字" | 失焦 |

**表单验证 Hook 实现**：

> **已实现**：`frontend/src/hooks/use-form-validation.ts`
> 导出：`useField`, `createEmailRules`, `createVerificationCodeRules`, `createUsernameRules`, `createSkillNameRules`, `createSkillDescriptionRules`, `createTokenNameRules`。

```tsx
// src/hooks/use-form-validation.ts
interface ValidationRule<T> {
  validate: (value: T) => boolean
  message: string
}

interface FieldState<T> {
  value: T
  setValue: (value: T) => void
  error: string | null
  isValid: boolean
  handleBlur: () => void
  validate: () => void
  reset: () => void
}

export function useField<T>(
  initialValue: T,
  rules: ValidationRule<T>[]
): FieldState<T> {
  const [value, setValue] = useState<T>(initialValue)
  const [touched, setTouched] = useState(false)

  // 使用 ref 存储 rules 避免内联数组导致的 memoization 问题
  const rulesRef = useRef(rules)
  if (
    rules.length !== rulesRef.current.length ||
    rules.some((r, i) => r !== rulesRef.current[i])
  ) {
    rulesRef.current = rules
  }
  const stableRules = rulesRef.current

  const error = useMemo(() => {
    if (!touched) return null
    for (const rule of stableRules) {
      if (!rule.validate(value)) {
        return rule.message
      }
    }
    return null
  }, [value, touched, stableRules])

  const handleBlur = useCallback(() => setTouched(true), [])
  const validate = useCallback(() => setTouched(true), [])
  const reset = useCallback(() => {
    setValue(initialValue)
    setTouched(false)
  }, [initialValue])

  return {
    value,
    setValue,
    error,
    isValid: error === null,
    handleBlur,
    validate,
    reset,
  }
}

// 预定义验证规则配置
export const validationRules = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "请输入有效的邮箱地址",
  },
  verificationCode: {
    pattern: /^\d{6}$/,
    message: "验证码为 6 位数字",
  },
  username: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_]+$/,
    messages: {
      minLength: "用户名至少 3 个字符",
      maxLength: "用户名最多 50 个字符",
      pattern: "用户名只能包含字母、数字和下划线",
    },
  },
  skillName: {
    minLength: 1,
    maxLength: 100,
    messages: {
      minLength: "名称不能为空",
      maxLength: "名称最长 100 字符",
    },
  },
  skillDescription: {
    maxLength: 500,
    message: "描述最长 500 字符",
  },
  tokenName: {
    minLength: 1,
    maxLength: 100,
    messages: {
      minLength: "Token 名称不能为空",
      maxLength: "Token 名称最长 100 字符",
    },
  },
}

// 工厂函数 - 创建验证规则数组，用于 useField
export function createEmailRules(): ValidationRule<string>[] {
  return [
    { validate: (v) => validationRules.email.pattern.test(v), message: validationRules.email.message },
  ]
}

export function createVerificationCodeRules(): ValidationRule<string>[] {
  return [
    { validate: (v) => validationRules.verificationCode.pattern.test(v), message: validationRules.verificationCode.message },
  ]
}

export function createUsernameRules(): ValidationRule<string>[] {
  const { minLength, maxLength, pattern, messages } = validationRules.username
  return [
    { validate: (v) => v.length >= minLength, message: messages.minLength },
    { validate: (v) => v.length <= maxLength, message: messages.maxLength },
    { validate: (v) => pattern.test(v), message: messages.pattern },
  ]
}

export function createSkillNameRules(): ValidationRule<string>[] {
  const { minLength, maxLength, messages } = validationRules.skillName
  return [
    { validate: (v) => v.length >= minLength, message: messages.minLength },
    { validate: (v) => v.length <= maxLength, message: messages.maxLength },
  ]
}

export function createSkillDescriptionRules(): ValidationRule<string>[] {
  return [
    { validate: (v) => !v || v.length <= validationRules.skillDescription.maxLength, message: validationRules.skillDescription.message },
  ]
}

export function createTokenNameRules(): ValidationRule<string>[] {
  const { minLength, maxLength, messages } = validationRules.tokenName
  return [
    { validate: (v) => v.length >= minLength, message: messages.minLength },
    { validate: (v) => v.length <= maxLength, message: messages.maxLength },
  ]
}
```

**使用示例**：

```tsx
// 在表单组件中使用
const email = useField("", createEmailRules())
const username = useField("", createUsernameRules())

// 手动触发验证（如提交时）
const handleSubmit = () => {
  email.validate()
  username.validate()
  if (email.isValid && username.isValid) {
    // 提交表单
  }
}

// 重置表单
const handleReset = () => {
  email.reset()
  username.reset()
}

// JSX
<Input
  value={email.value}
  onChange={(e) => email.setValue(e.target.value)}
  onBlur={email.handleBlur}
  error={email.error}
/>
```

### 3.4 加载状态规范

| 状态 | 使用场景 | 实现方式 |
|------|---------|---------|
| `loading` | 初始数据加载 | Skeleton 骨架屏 |
| `submitting` | 表单提交中 | 按钮禁用 + 文案变化 |
| `refreshing` | 后台刷新 | 保持当前内容，静默更新 |

**骨架屏实现**：

```tsx
import { Skeleton } from "@/components/ui/skeleton"

// 卡片骨架屏
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-32" />
  </CardHeader>
  <CardContent className="flex flex-col gap-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </CardContent>
</Card>
```

**按钮加载状态**：

```tsx
<Button disabled={isSubmitting}>
  {isSubmitting ? "处理中..." : "提交"}
</Button>
```

### 3.5 交互细节规范

#### 动画时长

| 交互场景 | 时长 | CSS 类 |
|---------|------|-------|
| 按钮点击反馈 | 100ms | `active:scale-[0.98]` |
| 模态框打开 | 200ms | Radix 默认 |
| 模态框关闭 | 150ms | Radix 默认 |
| Tab 切换 | 150ms | `transition-none` |
| Toast 滑入 | 300ms | `animate-in slide-in-from-right` |
| Toast 消失 | 200ms | `animate-out fade-out` |
| 下拉菜单展开 | 150ms | Radix 默认 |
| 主题切换 | 0ms | `disableTransitionOnChange: true` |
| 骨架屏脉冲 | 1.5s 循环 | `animate-pulse` |

#### Toast 通知规范

```tsx
interface ToastProps {
  title: string
  description?: string
  variant?: "default" | "success" | "error" | "warning"
  duration?: number // 默认 5000ms
  action?: {
    label: string
    onClick: () => void
  }
}
```

| 类型 | 颜色 | 使用场景 |
|------|------|---------|
| `default` | 主色调 | 一般信息提示 |
| `success` | 绿色 | 操作成功反馈 |
| `error` | 红色 | 操作失败反馈 |
| `warning` | 橙色 | 警告信息 |

```tsx
// Toast 使用示例
toast({
  title: "操作成功",
  description: "Token 已创建",
  variant: "success",
  duration: 5000,
})

toast({
  title: "操作失败",
  description: getErrorMessage(error),
  variant: "error",
  duration: 8000, // 错误信息展示时间稍长
})
```

#### 模态框动画

```tsx
// 模态框打开/关闭动画配置
<Dialog>
  <DialogContent className="animate-in fade-in-0 zoom-in-95 duration-200">
    {/* 内容 */}
  </DialogContent>
</Dialog>

<AlertDialog>
  <AlertDialogContent className="animate-in fade-in-0 zoom-in-95 duration-200">
    {/* 内容 */}
  </AlertDialogContent>
</AlertDialog>
```

#### 按钮交互状态

```tsx
// 按钮状态优先级
// 1. disabled（最优先）
// 2. loading（次优先）
// 3. 可交互状态

<Button
  disabled={isSubmitting || isLoading}
  className={isSubmitting ? "cursor-wait" : ""}
>
  {isSubmitting ? "处理中..." : "提交"}
</Button>
```

#### 表单提交流程

```
用户点击提交
    │
    ├── 禁用按钮 + 显示加载状态
    │
    ├── 调用 API
    │   ├── 成功 → 显示成功 Toast → 重置表单 / 跳转
    │   └── 失败 → 显示错误 Toast → 保持表单数据 + 按钮恢复
    │
    └── 无论成功失败，按钮最终都应恢复可点击状态
```

#### 乐观更新与回滚

```tsx
// 乐观更新示例（删除 Skill）
const [skills, setSkills] = useState<Skill[]>([])
const [isDeleting, setIsDeleting] = useState<string | null>(null)

const handleDeleteSkill = async (skillId: string) => {
  const previousSkills = [...skills]
  setSkills(skills.filter((s) => s.id !== skillId))
  setIsDeleting(skillId)

  try {
    await api.deleteSkill(skillId)
    toast({ title: "删除成功", variant: "success" })
  } catch (error) {
    setSkills(previousSkills) // 回滚
    setIsDeleting(null)
    toast({
      title: "删除失败",
      description: getErrorMessage(error),
      variant: "error",
    })
  }
}

// 列表项删除按钮
<Button
  variant="ghost"
  size="sm"
  disabled={isDeleting === skill.id}
  onClick={() => handleDeleteSkill(skill.id)}
>
  {isDeleting === skill.id ? "删除中..." : "删除"}
</Button>
```

#### 防抖与节流

```tsx
// 防抖：搜索输入（延迟执行）
import { useDebouncedCallback } from "use-debounce"

const [query, setQuery] = useState("")
const debouncedSearch = useDebouncedCallback((value) => {
  setSearchQuery(value)
}, 300)

// 立即更新输入框，防抖执行搜索
<Input
  value={query}
  onChange={(e) => {
    setQuery(e.target.value)
    debouncedSearch(e.target.value)
  }}
/>
```

```tsx
// 节流：滚动加载（限制执行频率）
import { useThrottledCallback } from "use-debounce"

const throttledLoadMore = useThrottledCallback(() => {
  loadNextPage()
}, 1000)

<div onScroll={(e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
  if (scrollHeight - scrollTop - clientHeight < 100) {
    throttledLoadMore()
  }
}}>
```

#### 空状态展示

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

// 使用示例
<EmptyState
  icon={<PackageIcon className="h-12 w-12" />}
  title="暂无 Skills"
  description="创建一个 Skill 来开始使用"
  action={{ label: "创建 Skill", onClick: () => router.push("/skills/new") }}
/>
```

---

## 4. 当前差异与修复优先级

### 4.1 P0（已修复）

> ✅ 以下问题已在 `01-api-types.md` 中修复

1. ~~**安全页账户删除流程重构**~~
   - ~~当前前端：`DELETE /api/v1/users/me` 发送 `{ password }`~~
   - ~~后端契约：需先调用 `POST /api/v1/users/me/delete-request` 获取验证码，再调用 `DELETE /api/v1/users/me` 发送 `{ code }`~~
   - ✅ **已修复**：API 客户端已更新为两步流程

2. ~~**安全页修改密码功能无后端接口**~~
   - ~~当前前端调用 `/api/v1/users/me/password`~~
   - ~~后端无此路由~~
   - ✅ **已修复**：已从契约映射表中移除

3. ~~**验证码发送 purpose 不完整**~~
   - ~~当前仅支持 `login`, `register`, `bind_email`~~
   - ~~后端还支持 `delete_account`~~
   - ✅ **已修复**：`sendVerificationCode` 已支持 `purpose: "delete_account"`

### 4.2 P1（部分已修复）

> ✅ 以下问题已在 `01-api-types.md` 中修复

1. **注册成功后的 Token 使用策略**
   - 当前前端仅提示成功并跳转登录
   - 建议：自动登录存 Token 或明确文档说明需手动登录

2. ~~**Skill 类型字段缺失**~~
   - ~~当前前端 `Skill` 类型仅有 6 个字段~~
   - ✅ **已修复**：类型已补齐 13 个字段

3. ~~**Skill 创建/更新缺少 visible 参数**~~
   - ~~前端 `createSkill` 和 `updateSkill` 未暴露该参数~~
   - ✅ **已修复**：API 客户端已支持 `visible` 参数

4. ~~**Skill 列表缺少 include_inactive 参数**~~
   - ~~前端 `listSkills` 未暴露该参数~~
   - ✅ **已修复**：API 客户端已支持 `includeInactive` 参数

5. ~~**Skill 版本能力未接入**~~
   - 后端已支持版本接口
   - ✅ **已修复**：API 客户端已实现 `listSkillVersions`、`diffSkillVersions`、`getInstallInstructions`、`rollbackSkillVersion`、`downloadSkill`

6. ~~**Skill 激活/停用功能未接入**~~
   - 后端已支持 `/activate` 和 `/deactivate`
   - ✅ **已修复**：API 客户端已实现 `activateSkill` 和 `deactivateSkill`

7. ~~**邮箱绑定功能未接入**~~
   - 后端已支持 `POST /api/v1/users/bind-email`
   - ✅ **已修复**：API 客户端已实现 `bindEmail`

8. ~~**Token 类型字段缺失**~~
   - ~~前端 `Token` 类型缺少 `is_active` 和 `last_used_at` 字段~~
   - ✅ **已修复**：类型已补齐 `is_active` 和 `last_used_at`

9. ~~**User 类型字段严重缺失**~~
   - ~~前端 `User` 类型仅有 4 个字段~~
   - ✅ **已修复**：类型已补齐 11 个字段

10. ~~**审计日志功能完全未实现**~~
    - ~~后端已有完整接口，前端完全没有实现~~
    - ✅ **已修复**：API 客户端已实现 `listAuditLogs` 和 `exportAuditLogs`

### 4.3 P2（规范收敛）

1. ~~**shadcn 间距规范收敛**~~
   - ✅ **已完成**：所有 `space-y-*` 已替换为 `flex flex-col gap-*`

2. ~~**SSO/LDAP 登录支持**~~
   - ✅ **已完成**：登录页已根据 `ENABLE_SSO` 和 `ENABLE_LDAP` 环境变量动态显示入口
