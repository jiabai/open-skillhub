# Open SkillHub 前端构建与设计文档 - Part 4

## 技术基础（只读）

> 本文档为 `index.md` 的第4部分，聚焦于技术栈、设计系统、组件架构、页面结构。
>
> **注意**：本部分内容与后端代码对照无关，仅作为前端实现参考。
>
> **关联文档**：
> - [01-api-types.md](./01-api-types.md) - API类型定义
> - [02-auth-security.md](./02-auth-security.md) - 认证与安全
> - [03-business-exception.md](./03-business-exception.md) - 业务逻辑与异常

---

## 目录

1. [技术栈概览](#1-技术栈概览)
2. [设计系统](#2-设计系统)
3. [组件架构](#3-组件架构)
4. [页面结构](#4-页面结构)
5. [开发规范](#5-开发规范)
6. [部署配置](#6-部署配置)

---

## 1. 技术栈概览

### 1.1 核心框架

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 14.2.15 | React 全栈框架（App Router） |
| React | 18.3.1 | UI 组件库 |
| TypeScript | 5.6.3 | 类型安全 |

### 1.2 样式系统

| 技术 | 版本 | 用途 |
|------|------|------|
| Tailwind CSS | 3.4.14 | 原子化 CSS 框架 |
| shadcn/ui | - | 基于 Radix UI 的组件库 |
| class-variance-authority | 0.7.0 | 组件变体管理 |
| clsx + tailwind-merge | - | 类名合并工具 |

### 1.3 UI 原语与工具

| 技术 | 版本 | 用途 |
|------|------|------|
| @radix-ui/react-* | ^1.0.x | 无障碍 UI 原语 |
| lucide-react | 0.452.0 | 图标库 |
| next-themes | 0.3.0 | 主题切换 |

### 1.4 测试工具

| 技术 | 版本 | 用途 |
|------|------|------|
| Vitest | 2.1.3 | 测试运行器 |
| @testing-library/react | 16.0.1 | React 测试工具 |
| jsdom | 25.0.1 | DOM 模拟环境 |

---

## 2. 设计系统

### 2.1 字体系统

项目采用双字体系统，通过 Next.js 字体优化自动加载：

```typescript
// src/app/layout.tsx
import { Fraunces, IBM_Plex_Sans } from "next/font/google"

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
})

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body"
})
```

| 字体角色 | 字体名称 | CSS 变量 | 用途 |
|---------|---------|---------|------|
| Display | Fraunces | `--font-display` | 标题、品牌文字 |
| Body | IBM Plex Sans | `--font-body` | 正文、UI 元素 |

### 2.2 色彩系统

采用语义化 CSS 变量，支持亮色/暗色双主题：

```css
/* src/app/globals.css */

:root {
  --background: 36 33% 98%;
  --foreground: 222 22% 12%;
  --card: 36 33% 99%;
  --card-foreground: 222 22% 12%;
  --popover: 36 33% 98%;
  --popover-foreground: 222 22% 12%;
  --primary: 222 70% 34%;
  --primary-foreground: 0 0% 100%;
  --secondary: 32 45% 92%;
  --secondary-foreground: 222 22% 16%;
  --muted: 30 30% 94%;
  --muted-foreground: 215 14% 42%;
  --accent: 188 65% 45%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 70% 50%;
  --destructive-foreground: 0 0% 100%;
  --border: 28 20% 88%;
  --input: 28 20% 86%;
  --ring: 222 70% 34%;
  --radius: 0.75rem;
}

.dark {
  --background: 222 22% 10%;
  --foreground: 36 30% 94%;
  --card: 222 22% 12%;
  --card-foreground: 36 30% 94%;
  --popover: 222 22% 12%;
  --popover-foreground: 36 30% 94%;
  --primary: 36 75% 65%;
  --primary-foreground: 222 22% 12%;
  --secondary: 222 18% 18%;
  --secondary-foreground: 36 30% 94%;
  --muted: 222 16% 20%;
  --muted-foreground: 30 12% 70%;
  --accent: 188 65% 52%;
  --accent-foreground: 222 22% 12%;
  --destructive: 0 62% 45%;
  --destructive-foreground: 0 0% 98%;
  --border: 222 16% 22%;
  --input: 222 16% 26%;
  --ring: 36 75% 65%;
}
```

**色彩语义**：

| 语义 Token | 用途 | 亮色值 | 暗色值 |
|-----------|------|--------|--------|
| `background` | 页面背景 | 暖白色 | 深蓝灰 |
| `foreground` | 主文字 | 深蓝灰 | 暖白色 |
| `primary` | 主要操作 | 深蓝色 | 金黄色 |
| `secondary` | 次要元素 | 暖米色 | 深蓝灰 |
| `muted` | 弱化元素 | 浅米色 | 中灰 |
| `accent` | 强调元素 | 青绿色 | 青绿色 |
| `destructive` | 危险操作 | 红色 | 红色 |

### 2.3 间距与圆角

```typescript
// tailwind.config.ts
theme: {
  container: {
    center: true,
    padding: "2rem",
    screens: {
      "2xl": "1400px"
    }
  },
  extend: {
    borderRadius: {
      lg: "var(--radius)",      // 0.75rem
      md: "calc(var(--radius) - 2px)",
      sm: "calc(var(--radius) - 4px)"
    }
  }
}
```

### 2.4 视觉层次

项目采用层次化背景设计：

```tsx
// src/components/app/app-shell.tsx
<div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--secondary)),_transparent_60%),_linear-gradient(to_bottom,_hsl(var(--muted)_/_0.8),_transparent)]">
```

---

## 3. 组件架构

### 3.X Toast 通知组件

**依赖:** sonner

**文件位置:**
- `frontend/src/components/ui/sonner.tsx` - 组件封装
- `frontend/src/hooks/use-toast.ts` - Hook 封装

**使用方法:**

```tsx
import { useToast } from "@/hooks/use-toast"

function MyComponent() {
  const { success, error, warning, info } = useToast()

  const handleAction = async () => {
    try {
      await api.doSomething()
      success("操作成功")
    } catch (err) {
      error("操作失败", { description: err.message })
    }
  }
}
```

**Toast 类型:**
- `success(title, options?)` - 成功提示（绿色，4秒）
- `error(title, options?)` - 错误提示（红色，5秒）
- `warning(title, options?)` - 警告提示（黄色，4秒）
- `info(title, options?)` - 信息提示（蓝色，4秒）

**位置:** 右下角 (`position="bottom-right"`)

---

### 3.1 组件分类

```
src/components/
├── app/                    # 应用级组件
│   ├── app-shell.tsx       # 应用外壳（布局容器）
│   └── theme-toggle.tsx    # 主题切换
├── ui/                     # 基础 UI 组件
│   ├── alert-dialog.tsx    # 确认对话框
│   ├── badge.tsx           # 标签徽章
│   ├── button.tsx          # 按钮
│   ├── card.tsx            # 卡片容器
│   ├── dropdown-menu.tsx   # 下拉菜单
│   ├── input.tsx           # 输入框
│   ├── label.tsx           # 表单标签
│   ├── separator.tsx       # 分隔线
│   ├── tabs.tsx            # 标签页
│   └── textarea.tsx        # 文本域
└── theme-provider.tsx      # 主题上下文
```

### 3.2 Button 组件

```tsx
// src/components/ui/button.tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-border bg-background hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-6",
        icon: "h-10 w-10"
      }
    }
  }
)
```

| 变体 | 用途 | 视觉特征 |
|------|------|---------|
| `default` | 主要操作 | 实心填充，主题色 |
| `secondary` | 次要操作 | 浅色填充 |
| `outline` | 边框按钮 | 透明背景，边框 |
| `ghost` | 幽灵按钮 | 无边框，hover 效果 |
| `destructive` | 危险操作 | 红色填充 |

### 3.3 Card 组件

```tsx
// src/components/ui/card.tsx
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
)
```

### 3.4 Badge 组件

```tsx
// src/components/ui/badge.tsx
const badgeVariants = cva(
  "inline-flex items-center rounded-lg border border-border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        secondary: "bg-secondary/80 text-secondary-foreground",
        outline: "bg-background text-foreground",
        accent: "bg-accent text-accent-foreground",
        muted: "bg-muted text-muted-foreground",
        destructive: "bg-destructive text-destructive-foreground"
      }
    }
  }
)
```

### 3.5 组件 Props 接口定义

#### Button Props

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}
```

#### Card Props

```tsx
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
```

#### Badge Props

```tsx
interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "accent" | "muted"
}
```

#### Input Props

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
```

#### Label Props

```tsx
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}
```

#### Dialog Props

```tsx
interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
```

#### Tabs Props

```tsx
interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
}

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}
```

#### Select Props

```tsx
interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
  disabled?: boolean
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

interface SelectLabelProps extends React.HTMLAttributes<HTMLDivElement> {}
```

#### AlertDialog Props

```tsx
interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

interface AlertDialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

interface AlertDialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

interface AlertDialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

interface AlertDialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

interface AlertDialogCancelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

### 3.9 AppShell 应用外壳组件

```tsx
// src/components/app/app-shell.tsx
"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { getStoredTokens, clearTokens } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "./theme-toggle"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState<{ username: string; email: string } | null>(null)

  const isAuthRoute = pathname === "/login" || pathname === "/register"
  const isHomePage = pathname === "/"

  useEffect(() => {
    const tokens = getStoredTokens()

    if (isAuthRoute && tokens?.access_token) {
      router.replace("/dashboard")
      return
    }

    if (!isAuthRoute && !isHomePage && !tokens?.access_token) {
      router.replace("/login")
      return
    }

    if (tokens?.access_token) {
      fetchUser(tokens.access_token).then(setUser).catch(() => {
        clearTokens()
        router.replace("/login")
      })
    }

    setChecking(false)
  }, [isAuthRoute, isHomePage, router])

  async function fetchUser(accessToken: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) throw new Error("Failed to fetch user")
    return response.json()
  }

  const handleLogout = () => {
    clearTokens()
    router.replace("/login")
  }

  if (checking && !isAuthRoute && !isHomePage) {
    return null
  }

  if (isAuthRoute) {
    return <main className="min-h-screen">{children}</main>
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--secondary)),_transparent_60%),_linear-gradient(to_bottom,_hsl(var(--muted)_/_0.8),_transparent)]">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto max-w-screen-xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-lg">
              Open SkillHub
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/dashboard" className={`text-sm ${pathname === "/dashboard" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                控制台
              </Link>
              <Link href="/skills" className={`text-sm ${pathname.startsWith("/skills") ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                Skills
              </Link>
              <Link href="/tokens" className={`text-sm ${pathname === "/tokens" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                Tokens
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {user?.username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="hidden sm:inline">{user?.username || "User"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.username}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">个人信息</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/security">安全设置</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="container mx-auto max-w-screen-xl px-6 py-8">
        {children}
      </main>
    </div>
  )
}
```

### 3.10 ThemeToggle 主题切换组件

```tsx
// src/components/app/theme-toggle.tsx
"use client"

import { useTheme } from "next-themes"
import { Sun, MoonStar } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(theme === "dark")
  }, [theme])

  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </Button>
  )
}
```

### 3.11 Toast 通知组件

```tsx
// src/components/ui/toast.tsx
"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToastProps {
  id: string
  title: string
  description?: string
  variant?: "default" | "success" | "error" | "warning"
  duration?: number
  onClose: (id: string) => void
}

const variantStyles = {
  default: "bg-background border-border",
  success: "bg-green-50 border-green-500 text-green-900 dark:bg-green-950 dark:text-green-100",
  error: "bg-destructive/10 border-destructive text-destructive",
  warning: "bg-yellow-50 border-yellow-500 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100",
}

export function Toast({ id, title, description, variant = "default", duration = 5000, onClose }: ToastProps) {
  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration)
      return () => clearTimeout(timer)
    }
  }, [duration, id, onClose])

  return (
    <div className={cn(
      "pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right",
      variantStyles[variant]
    )}>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <button onClick={() => onClose(id)} className="shrink-0 rounded-sm opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// Toast Hook
export function useToast() {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const toast = React.useCallback(({ title, description, variant, duration }: Omit<ToastProps, "id" | "onClose">) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { id, title, description, variant, duration }])
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toast, dismiss, toasts }
}

// Toast Container
export function ToastContainer({ toasts, onDismiss }: { toasts: ToastProps[], onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={onDismiss} />
      ))}
    </div>
  )
}
```

### 3.12 Skeleton 骨架屏组件

```tsx
// src/components/ui/skeleton.tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// 使用示例
const CardSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-32" />
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </CardContent>
  </Card>
)

const ListSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-16 w-full" />
    ))}
  </div>
)
```

---

## 4. 页面结构

### 4.1 路由架构

```
src/app/
├── layout.tsx              # 根布局
├── page.tsx                # 首页（入口卡片，不自动重定向）
├── globals.css             # 全局样式
├── login/
│   └── page.tsx            # 登录页
├── register/
│   └── page.tsx            # 注册页
├── dashboard/
│   └── page.tsx            # 控制台概览
├── skills/
│   ├── page.tsx            # Skills 列表
│   ├── new/
│   │   └── page.tsx        # 创建 Skill
│   └── [skillUuid]/
│       └── page.tsx        # Skill 详情
├── tokens/
│   └── page.tsx            # API Token 管理
├── audit/
│   └── page.tsx            # 审计日志
├── profile/
│   └── page.tsx            # 个人信息
└── security/
    └── page.tsx            # 安全设置
```

### 4.2 根布局

```tsx
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${displayFont.variable} ${bodyFont.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### 4.3 页面设计模式

#### 登录页（双栏布局）

```tsx
<div className="mx-auto grid min-h-screen max-w-screen-xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
  <div className="space-y-6">
    {/* 品牌区域 */}
  </div>
  <Card className="border-border/80 shadow-lg">
    {/* 登录表单 */}
  </Card>
</div>
```

#### 控制台概览（统计卡片网格）

```tsx
<div className="grid gap-4 lg:grid-cols-3">
  {[
    { title: "活跃 Skills", value: "3", tag: "启用中" },
    { title: "可用 Tokens", value: "2", tag: "未过期" },
    { title: "工具调用成功率", value: "92.3%", tag: "过去 24h" }
  ].map((item) => (
    <Card key={item.title}>
      <CardHeader>
        <CardDescription>{item.title}</CardDescription>
        <CardTitle className="text-3xl">{item.value}</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant="accent">{item.tag}</Badge>
      </CardContent>
    </Card>
  ))}
</div>
```

#### Skills 列表页（搜索 + 列表 + 状态管理）

```tsx
<Card>
  <CardHeader>
    <CardTitle>搜索与筛选</CardTitle>
  </CardHeader>
  <CardContent>
    <form className="flex flex-wrap gap-3">
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input className="border-0 px-0 focus-visible:ring-0" placeholder="搜索 Skill" />
      </div>
      <Button type="submit" variant="secondary">搜索</Button>
    </form>
  </CardContent>
</Card>

{/* Skill 卡片列表 */}
{skills.map((skill) => (
  <Card key={skill.id}>
    <CardHeader className="flex flex-row items-start justify-between gap-4">
      <div className="space-y-2">
        <CardTitle>{skill.name}</CardTitle>
        <CardDescription>{skill.description}</CardDescription>
        <div className="flex flex-wrap gap-2">
          {/* 状态徽章 */}
          <Badge variant={skill.is_active ? "accent" : "muted"}>
            {skill.is_active ? "已启用" : "已停用"}
          </Badge>
          <Badge variant="muted">私有目录</Badge>
          <Badge variant="outline">id: {skill.id.slice(0, 8)}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" asChild>
          <Link href={`/skills/${skill.id}`}>查看</Link>
        </Button>
        {/* 启用/停用按钮 */}
        <Button
          variant={skill.is_active ? "secondary" : "outline"}
          size="sm"
          onClick={() => handleToggleActive(skill.id, skill.is_active)}
        >
          {skill.is_active ? "停用" : "启用"}
        </Button>
        {/* 删除按钮 */}
        <AlertDialog>
          ...
        </AlertDialog>
      </div>
    </CardHeader>
  </Card>
))}
```

**功能说明：**
- 搜索栏支持按名称/描述查找
- 每个 Skill 卡片显示：名称、描述、状态徽章、ID
- 操作按钮：查看、启用/停用、删除
- 状态徽章根据 `is_active` 显示不同颜色和文本

#### Skill 详情页（Tabs 组织 + 状态栏）

```tsx
{/* 状态栏 */}
<Card className={skill.is_active ? "border-accent/50 bg-accent/5" : "border-muted"}>
  <CardContent className="flex items-center justify-between py-4">
    <div className="flex items-center gap-4">
      <div className={`h-3 w-3 rounded-full ${skill.is_active ? "bg-accent" : "bg-muted-foreground"}`} />
      <div>
        <p className="font-medium">{skill.is_active ? "已启用" : "已停用"}</p>
        <p className="text-sm text-muted-foreground">
          {skill.is_active ? "Skill 当前处于活跃状态" : "Skill 当前处于停用状态"}
        </p>
      </div>
    </div>
    <Button variant={skill.is_active ? "outline" : "default"}>
      {skill.is_active ? "停用 Skill" : "启用 Skill"}
    </Button>
  </CardContent>
</Card>

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">概览</TabsTrigger>
    <TabsTrigger value="files">文件</TabsTrigger>
    <TabsTrigger value="versions">版本</TabsTrigger>
    <TabsTrigger value="settings">设置</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">{/* 概览内容 */}</TabsContent>
  <TabsContent value="files">{/* 文件列表 */}</TabsContent>
  <TabsContent value="versions"><VersionsTab skillUuid={params.skillUuid} /></TabsContent>
  <TabsContent value="settings">{/* 设置表单 */}</TabsContent>
</Tabs>
```

**状态栏功能：**
- 显示当前激活状态（已启用/已停用）
- 提供启用/停用切换按钮
- 卡片边框和背景根据状态变化

**页面结构：**
1. 页面标题 + 返回按钮
2. **状态栏**（新增）
3. Tabs（概览/文件/版本/设置）

**版本 Tab (VersionsTab)：**

```tsx
// src/app/skills/[skillUuid]/_components/versions-tab.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { GitCompare, Loader2, RotateCcw, Package } from "lucide-react"

import { api } from "@/lib/api"
import type { SkillVersion, SkillVersionDiff } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"

interface VersionsTabProps {
  skillUuid: string
}

export function VersionsTab({ skillUuid }: VersionsTabProps) {
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [diffResult, setDiffResult] = useState<SkillVersionDiff | null>(null)
  const [loading, setLoading] = useState(false)

  // 加载版本列表
  const fetchVersions = useCallback(async () => {
    setLoading(true)
    const response = await api.listSkillVersions(skillUuid)
    setVersions(response.items)
    setLoading(false)
  }, [skillUuid])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  // 处理版本选择（最多2个）
  const handleVersionSelect = useCallback((version: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version)
      }
      if (prev.length >= 2) {
        return [prev[1], version]
      }
      return [...prev, version]
    })
  }, [])

  // 双选时自动获取差异
  useEffect(() => {
    if (selectedVersions.length === 2) {
      api.diffSkillVersions(skillUuid, selectedVersions[0], selectedVersions[1])
        .then(setDiffResult)
    } else {
      setDiffResult(null)
    }
  }, [selectedVersions, skillUuid])

  // 回滚到指定版本
  const handleRollback = async (version: string) => {
    await api.rollbackSkillVersion(skillUuid, version)
    await fetchVersions()
    setSelectedVersions([])
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* 左侧：版本列表 */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">版本列表</h3>
        {/* 版本列表项 */}
      </div>
      {/* 右侧：详情/对比 */}
      <div>
        {/* 单选：版本详情 / 双选：版本对比 */}
      </div>
    </div>
  )
}
```

**功能说明：**

| 功能 | 说明 |
|------|------|
| 版本列表 | 显示版本号、描述、创建时间（相对时间） |
| 版本选择 | 复选框选择，最多选2个版本 |
| 单选模式 | 显示版本详情：描述、依赖列表、元数据、回滚按钮 |
| 双选模式 | 显示版本对比：依赖变更（新增/移除）、文件差异 |
| 回滚功能 | 创建新版本（复制目标版本内容） |

**布局：** 左右分栏（左侧 320px 版本列表 + 右侧自适应详情面板）

### 4.4 Token 管理页面

#### 页面结构

```
/tokens
├── 页面标题 + 创建按钮
├── Token 列表（卡片形式）
│   ├── Token 名称
│   ├── Token 值（脱敏显示：前4位 + *** + 后4位）
│   ├── 状态标签（active/expired）
│   ├── 有效期
│   ├── 最近使用时间
│   └── 操作（复制/撤销）
└── 创建 Token 模态框
```

#### 完整代码

```tsx
interface TokenCardProps {
  token: Token
  onRevoke: (tokenId: string) => void
  onCopy: (tokenId: string) => void
}

function TokenCard({ token, onRevoke, onCopy }: TokenCardProps) {
  const maskedToken = token.token
    ? `${token.token.slice(0, 4)}...${token.token.slice(-4)}`
    : "已撤销"

  const isExpired = token.expires_at
    ? new Date(token.expires_at) < new Date()
    : false

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{token.name}</CardTitle>
          <Badge variant={token.is_active && !isExpired ? "accent" : "muted"}>
            {token.is_active && !isExpired ? "活跃" : isExpired ? "已过期" : "已撤销"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-muted px-2 py-1 text-sm font-mono">
            {maskedToken}
          </code>
          {token.is_active && !isExpired && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCopy(token.id)}
              aria-label="复制 Token"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {token.expires_at && (
            <span>有效期至：{new Date(token.expires_at).toLocaleDateString()}</span>
          )}
          {token.last_used_at && (
            <span>最近使用：{new Date(token.last_used_at).toLocaleDateString()}</span>
          )}
        </div>
      </CardContent>
      {token.is_active && !isExpired && (
        <CardFooter className="border-t bg-muted/50 px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => onRevoke(token.id)}
          >
            <Trash className="mr-2 h-4 w-4" />
            撤销
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

interface CreateTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; expires_at?: string }) => Promise<void>
}

function CreateTokenDialog({ open, onOpenChange, onSubmit }: CreateTokenDialogProps) {
  const [name, setName] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSubmit({
        name,
        expires_at: expiresAt || undefined
      })
      setName("")
      setExpiresAt("")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建 API Token</DialogTitle>
          <DialogDescription>
            创建一个新的 API Token，用于程序化访问 API。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-name">Token 名称 *</Label>
            <Input
              id="token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：生产环境密钥"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token-expires">有效期（可选）</Label>
            <Input
              id="token-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### 4.5 个人信息页面

#### 页面结构

```
/profile
├── 页面标题
├── 基本信息卡片
│   ├── 用户名（可编辑）
│   ├── 邮箱（可编辑，显示验证状态）
│   └── 注册时间（只读）
└── 组织信息卡片（条件显示，当 ENABLE_ORG_MODEL=true）
    ├── 企业 ID
    └── 团队 ID
```

#### 完整代码

```tsx
interface ProfilePageProps {
  user: User
  onUpdate: (data: { username?: string; email?: string }) => Promise<void>
  featureFlags: {
    enableOrgModel: boolean
  }
}

function ProfilePage({ user, onUpdate, featureFlags }: ProfilePageProps) {
  const [username, setUsername] = useState(user.username)
  const [email, setEmail] = useState(user.email)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (username === user.username && email === user.email) return

    setIsSubmitting(true)
    try {
      await onUpdate({ username, email })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败")
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasChanges = username !== user.username || email !== user.email

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">个人信息</h1>
        <p className="text-muted-foreground">管理您的账户信息</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入邮箱"
              />
              {!user.email && (
                <p className="text-sm text-muted-foreground">
                  请绑定邮箱以便接收通知
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>注册时间</Label>
              <Input
                value={new Date(user.created_at).toLocaleDateString()}
                disabled
                className="bg-muted"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <p className="text-sm text-green-600">更新成功</p>
            )}

            <Button type="submit" disabled={isSubmitting || !hasChanges}>
              {isSubmitting ? "保存中..." : "保存更改"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {featureFlags.enableOrgModel && (user.enterprise_id || user.team_id) && (
        <Card>
          <CardHeader>
            <CardTitle>组织信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {user.enterprise_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">企业 ID</span>
                <span className="font-mono">{user.enterprise_id}</span>
              </div>
            )}
            {user.team_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">团队 ID</span>
                <span className="font-mono">{user.team_id}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### 4.6 安全设置页面

#### 页面结构

```
/security
├── 页面标题
├── 账户安全卡片
│   ├── 绑定邮箱
│   │   ├── 当前邮箱状态
│   │   └── 绑定/更新邮箱按钮
│   └── 删除账户
│       ├── 危险操作警告
│       └── 删除账户按钮
└── 活跃设备卡片（未来扩展）
```

#### 完整代码

```tsx
interface SecurityPageProps {
  user: User
  featureFlags: {
    enableEmailOtpLogin: boolean
  }
  onBindEmail: (data: { email: string; code: string }) => Promise<void>
  onRequestDeleteAccount: () => Promise<void>
  onDeleteAccount: (code: string) => Promise<void>
}

function SecurityPage({
  user,
  featureFlags,
  onBindEmail,
  onRequestDeleteAccount,
  onDeleteAccount
}: SecurityPageProps) {
  const [showBindEmail, setShowBindEmail] = useState(false)
  const [bindEmail, setBindEmail] = useState("")
  const [bindCode, setBindCode] = useState("")
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isBinding, setIsBinding] = useState(false)
  const [bindError, setBindError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteCode, setDeleteCode] = useState("")
  const [isRequestingDelete, setIsRequestingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleSendBindCode = async () => {
    if (!bindEmail) return
    setIsSendingCode(true)
    setBindError(null)
    try {
      await api.sendVerificationCode({ email: bindEmail, purpose: "bind_email" })
    } catch (err) {
      setBindError(err instanceof Error ? err.message : "发送失败")
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleBindEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsBinding(true)
    setBindError(null)
    try {
      await onBindEmail({ email: bindEmail, code: bindCode })
      setShowBindEmail(false)
      setBindEmail("")
      setBindCode("")
    } catch (err) {
      setBindError(err instanceof Error ? err.message : "绑定失败")
    } finally {
      setIsBinding(false)
    }
  }

  const handleRequestDelete = async () => {
    setIsRequestingDelete(true)
    setDeleteError(null)
    try {
      await onRequestDeleteAccount()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "请求失败")
    } finally {
      setIsRequestingDelete(false)
    }
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await onDeleteAccount(deleteCode)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "删除失败")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">安全设置</h1>
        <p className="text-muted-foreground">管理您的账户安全</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>绑定邮箱</CardTitle>
          <CardDescription>
            绑定邮箱后可用于接收通知和找回密码
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.email ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user.email}</p>
                <p className="text-sm text-green-600">已验证</p>
              </div>
              <Button variant="outline" onClick={() => setShowBindEmail(true)}>
                更新邮箱
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {showBindEmail ? (
                <form onSubmit={handleBindEmail} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bind-email">新邮箱</Label>
                    <Input
                      id="bind-email"
                      type="email"
                      value={bindEmail}
                      onChange={(e) => setBindEmail(e.target.value)}
                      placeholder="输入邮箱地址"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={bindCode}
                      onChange={(e) => setBindCode(e.target.value)}
                      placeholder="验证码"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendBindCode}
                      disabled={isSendingCode || !bindEmail}
                    >
                      {isSendingCode ? "发送中..." : "发送验证码"}
                    </Button>
                  </div>
                  {bindError && <p className="text-sm text-destructive">{bindError}</p>}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowBindEmail(false)}>
                      取消
                    </Button>
                    <Button type="submit" disabled={isBinding || !bindCode}>
                      {isBinding ? "绑定中..." : "确认绑定"}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button onClick={() => setShowBindEmail(true)}>
                  绑定邮箱
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">危险区域</CardTitle>
          <CardDescription>删除账户是不可逆的操作</CardDescription>
        </CardHeader>
        <CardContent>
          {showDeleteConfirm ? (
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">
                  此操作将永久删除您的账户及相关所有数据。删除后无法恢复。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-code">验证码</Label>
                <Input
                  id="delete-code"
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value)}
                  placeholder="输入验证码"
                />
                <p className="text-sm text-muted-foreground">
                  点击"发送验证码"获取删除账户的验证码
                </p>
              </div>
              {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  取消
                </Button>
                <Button type="submit" variant="destructive" disabled={isDeleting || !deleteCode}>
                  {isDeleting ? "删除中..." : "确认删除账户"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                如果您确定要删除账户，请点击下方按钮获取验证码。
              </p>
              <Button
                variant="destructive"
                onClick={handleRequestDelete}
                disabled={isRequestingDelete}
              >
                {isRequestingDelete ? "请求中..." : "删除账户"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

### 4.7 审计日志页面

#### 页面结构

```
/audit
├── 页面标题
├── 左右分栏布局 (lg:grid-cols-[320px_1fr])
│   ├── 左侧筛选面板 (320px)
│   │   ├── 时间范围选择（开始/结束日期）
│   │   ├── 操作类型下拉选择
│   │   ├── 操作者 ID 输入框
│   │   ├── [应用筛选] 按钮
│   │   └── 导出按钮（JSON/CSV）
│   └── 右侧日志列表
│       ├── 日志数量统计
│       └── 日志卡片列表
│           ├── 时间戳、结果状态（成功/失败）
│           ├── 操作者 → 操作类型 → 目标
│           └── [展开] 查看详情（IP、User Agent、JSON）
```

#### 核心功能

| 功能 | 说明 |
|------|------|
| 筛选 | 时间范围、操作类型、操作者 ID |
| 导出 | JSON/CSV 格式下载 |
| 展开详情 | 显示 IP、User Agent、详细参数 |
| 实时加载 | 初始加载最近 7 天日志 |

#### 文件位置

- `frontend/src/app/audit/page.tsx`

### 4.8 响应式设计断点

| 断点 | 最小宽度 | 使用场景 |
|------|---------|---------|
| `sm` | 640px | 大手机横屏 |
| `md` | 768px | 平板竖屏 |
| `lg` | 1024px | 平板横屏 / 小笔记本 |
| `xl` | 1280px | 桌面显示器 |
| `2xl` | 1536px | 大显示器 |

### 4.8 无障碍规范

#### ARIA 属性使用

| 场景 | ARIA 属性 | 示例 |
|------|----------|------|
| 图标按钮（无文字） | `aria-label` | `<Button aria-label="复制"><Copy /></Button>` |
| 徽章/标签 | `aria-label` | `<Badge aria-label="状态: 活跃">活跃</Badge>` |
| 加载状态 | `aria-busy` | `<div aria-busy={isLoading}>...</div>` |
| 禁用状态 | `aria-disabled` | `<Button aria-disabled={true}>...</Button>` |
| 表单错误 | `aria-invalid` + `aria-describedby` | `<Input aria-invalid={!!error} aria-describedby="error-msg" />` |
| 折叠/展开 | `aria-expanded` | `<Button aria-expanded={isOpen}>菜单</Button>` |
| 对话框 | `role="dialog"` + `aria-modal` | `<Dialog role="dialog" aria-modal="true">` |
| 模态框标题 | `aria-labelledby` | `<DialogTitle id="dialog-title">` |
| 模态框描述 | `aria-describedby` | `<DialogDescription id="dialog-desc">` |
| 列表导航 | `role="list"` | `<ul role="list">` |
| 跳转链接 | `aria-current="page"` | `<Link aria-current={isActive ? "page" : undefined}>` |

#### 焦点管理

```tsx
// 模态框打开时聚焦到标题
<Dialog onOpenChange={(open) => {
  if (open) {
    setTimeout(() => {
      document.getElementById("dialog-title")?.focus()
    }, 0)
  }
}}>

// 模态框关闭后聚焦回触发按钮
function DialogCloseButton({ onClose, triggerRef }) {
  const handleClose = () => {
    onClose()
    triggerRef?.current?.focus()
  }
  return <Button onClick={handleClose}>关闭</Button>
}
```

#### 键盘导航规范

| 组件 | Tab | Enter/Space | Escape | Arrow Keys |
|------|-----|-------------|--------|------------|
| 按钮 | - | 触发点击 | - | - |
| 链接 | 聚焦 | 跳转 | - | - |
| 输入框 | 聚焦 | - | 关闭建议/清除 | 移动光标 |
| Dialog | 聚焦标题 | - | 关闭对话框 | 焦点困在框内 |
| Dropdown | 聚焦触发器 | 打开菜单 | 关闭菜单 | 导航选项 |
| Tabs | 聚焦当前 Tab | 激活 Tab | - | 水平切换 |
| Select | 聚焦触发器 | 打开选项 | 关闭选项 | 导航选项 |

#### 屏幕阅读器支持

```tsx
// 视觉隐藏但屏幕阅读器可读的内容
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

// 使用示例：图标按钮的替代文本
<Button variant="ghost" size="icon" aria-label="复制到剪贴板">
  <Copy className="h-4 w-4" />
</Button>

// 表格的屏幕阅读器描述
<table aria-describedby="table-desc">
  <caption id="table-desc" className="sr-only">
    用户列表，显示用户名、邮箱和角色
  </caption>
</table>
```

#### 表单无障碍

```tsx
// 完整的表单无障碍示例
<form onSubmit={handleSubmit}>
  <div>
    <Label htmlFor="email">邮箱地址</Label>
    <Input
      id="email"
      type="email"
      aria-invalid={!!errors.email}
      aria-describedby={errors.email ? "email-error" : undefined}
      onChange={(e) => setEmail(e.target.value)}
    />
    {errors.email && (
      <p id="email-error" role="alert" className="text-sm text-destructive">
        {errors.email}
      </p>
    )}
  </div>

  <Button type="submit">
    提交
  </Button>
</form>
```

#### 错误提示无障碍

```tsx
// 错误信息使用 role="alert" 自动朗读
{error && (
  <p role="alert" className="text-sm text-destructive">
    {error}
  </p>
)}

// 或者使用 aria-live 区域
<div aria-live="polite" className="sr-only">
  {statusMessage}
</div>
```

#### 颜色对比度

| 元素 | 最小对比度 | WCAG 级别 |
|------|-----------|----------|
| 正常文本 | 4.5:1 | AA |
| 大文本（>18px） | 3:1 | AA |
| UI 组件和图形对象 | 3:1 | AA |
| 对比度增强（重要信息） | 7:1 | AAA |

```tsx
// 确保按钮文字与背景对比度足够
// 浅色主题：--primary 是深蓝色，与白色文字对比度 > 4.5:1
// 深色主题：--primary 是金黄色，与深色背景对比度 > 4.5:1
<Button className="bg-primary text-primary-foreground">
  提交
</Button>
```

#### 运动敏感性

```tsx
// 尊重用户减少动画偏好
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

// 在代码中检查用户偏好
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
```

---

## 5. 开发规范

### 5.1 组件结构规范

```tsx
import { Card } from "@/components/ui/card"

export default function ComponentName() {
  // 1. 状态声明
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  // 2. 副作用
  useEffect(() => {
    loadData()
  }, [])

  // 3. 事件处理
  const handleClick = async () => {
    // ...
  }

  // 4. 渲染
  return (
    <div className="flex flex-col gap-6">
      {/* ... */}
    </div>
  )
}
```

### 5.2 样式规范

**优先使用语义化类名**：

```tsx
// ✅ 推荐
<div className="bg-background text-foreground border-border">
<div className="bg-primary text-primary-foreground">

// ❌ 避免
<div className="bg-white text-gray-900 border-gray-200">
```

**间距使用 gap**：

```tsx
// ✅ 推荐
<div className="flex flex-col gap-4">
<div className="flex items-center gap-2">

// ❌ 避免
<div className="space-y-4">
```

---

## 6. 部署配置

### 6.1 环境变量

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 6.2 构建命令

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### 6.3 启动流程

```bash
# 开发环境
cd frontend
npm install
npm run dev

# 生产环境
npm run build
npm start
```

### 6.4 与后端联调

```bash
# 后端服务
uvicorn skillhub.api_app:app --host 0.0.0.0 --port 8000

# 前端服务
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```
