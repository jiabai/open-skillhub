# 全局 Toast 通知系统实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建全局 Toast 通知系统，提供统一的反馈机制

**Architecture:**
- 使用 shadcn/ui + sonner 作为基础
- 在根布局中集成 ToastProvider
- 提供 useToast hook 供各页面调用
- 支持成功/警告/错误/信息四种类型
- 位置固定在右下角

**Tech Stack:** Next.js 14 + React + TypeScript + Tailwind CSS + shadcn/ui + sonner

---

## 前置条件

- 项目已使用 shadcn/ui
- 设计系统规范已制定

---

## Task 1: 安装 sonner 依赖

**Step 1: 安装依赖**

```bash
cd frontend && npm install sonner
```

**Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): add sonner for toast notifications"
```

---

## Task 2: 创建 Toast 组件和 Provider

**Files:**
- Create: `frontend/src/components/ui/sonner.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Step 1: 创建 Sonner Toast 组件**

```tsx
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
```

**Step 2: 更新根布局添加 Toaster**

在 `frontend/src/app/layout.tsx` 中添加：

```tsx
import { Toaster } from "@/components/ui/sonner"
```

在 body 中添加 Toaster 组件：

```tsx
<body className="min-h-screen bg-background text-foreground antialiased">
  <ThemeProvider>
    <AppShell>{children}</AppShell>
    <Toaster position="bottom-right" />
  </ThemeProvider>
</body>
```

**Step 3: Commit**

```bash
git add frontend/src/components/ui/sonner.tsx frontend/src/app/layout.tsx
git commit -m "feat(frontend): add sonner toast component and provider"
```

---

## Task 3: 创建 useToast Hook 封装

**Files:**
- Create: `frontend/src/hooks/use-toast.ts`

**Step 1: 创建 useToast hook**

```tsx
import { toast } from "sonner"

interface ToastOptions {
  description?: string
  duration?: number
}

export function useToast() {
  const success = (title: string, options?: ToastOptions) => {
    toast.success(title, {
      description: options?.description,
      duration: options?.duration ?? 4000,
    })
  }

  const error = (title: string, options?: ToastOptions) => {
    toast.error(title, {
      description: options?.description,
      duration: options?.duration ?? 5000,
    })
  }

  const warning = (title: string, options?: ToastOptions) => {
    toast.warning(title, {
      description: options?.description,
      duration: options?.duration ?? 4000,
    })
  }

  const info = (title: string, options?: ToastOptions) => {
    toast.info(title, {
      description: options?.description,
      duration: options?.duration ?? 4000,
    })
  }

  return {
    success,
    error,
    warning,
    info,
    // 导出原始 toast 函数以备自定义需求
    toast,
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/use-toast.ts
git commit -m "feat(frontend): add useToast hook wrapper"
```

---

## Task 4: 在关键页面应用 Toast

**Files:**
- Modify: `frontend/src/app/skills/page.tsx`
- Modify: `frontend/src/app/skills/[skillUuid]/page.tsx`
- Modify: `frontend/src/app/tokens/page.tsx`

**Step 1: 更新 Skills 列表页**

添加导入：
```tsx
import { useToast } from "@/hooks/use-toast"
```

在组件中使用：
```tsx
export default function SkillsPage() {
  const { success, error } = useToast()
  // ...

  const handleToggleActive = async (skillUuid: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await api.deactivateSkill(skillUuid)
        success("Skill 已停用")
      } else {
        await api.activateSkill(skillUuid)
        success("Skill 已启用")
      }
      await loadSkills(query)
    } catch (err) {
      error("操作失败", { description: err instanceof Error ? err.message : "请稍后重试" })
    }
  }
  // ...
}
```

**Step 2: 更新 Skill 详情页**

添加导入：
```tsx
import { useToast } from "@/hooks/use-toast"
```

在状态栏按钮中使用：
```tsx
const { success, error } = useToast()

// 在 toggle 按钮 onClick 中:
try {
  if (skill.is_active) {
    await api.deactivateSkill(skill.id)
    success("Skill 已停用")
  } else {
    await api.activateSkill(skill.id)
    success("Skill 已启用")
  }
  await fetchData()
} catch (err) {
  error("操作失败", { description: err instanceof Error ? err.message : "请稍后重试" })
}
```

**Step 3: 更新 Tokens 页面**

添加导入：
```tsx
import { useToast } from "@/hooks/use-toast"
```

在创建 Token 和撤销 Token 中使用：
```tsx
const { success, error } = useToast()

// 创建成功:
success("Token 创建成功", { description: "请保存好您的 Token，它只会显示一次" })

// 撤销成功:
success("Token 已撤销")
```

**Step 4: Commit**

```bash
git add frontend/src/app/skills/page.tsx frontend/src/app/skills/\[skillUuid\]/page.tsx frontend/src/app/tokens/page.tsx
git commit -m "feat(frontend): apply toast notifications to skills and tokens pages"
```

---

## Task 5: 运行测试验证

**Step 1: TypeScript 检查**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 无错误

**Step 2: 构建验证**

```bash
cd frontend && npm run build
```
Expected: 构建成功

**Step 3: Commit（如无需修改）**

如果测试通过且无需代码修改，无需额外 commit。

---

## Task 6: 更新文档

**Files:**
- Modify: `docs/frontend-design/04-basics-readonly.md`

**Step 1: 添加 Toast 组件文档**

在组件架构部分（3.X 节）添加：

```markdown
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
```

**Step 2: Commit**

```bash
git add docs/frontend-design/04-basics-readonly.md
git commit -m "docs: add toast notification documentation"
```

---

## 总结

完成以上 6 个 Task 后，全局 Toast 通知系统将具备：

1. ✅ sonner 依赖安装
2. ✅ Toaster 组件和 Provider
3. ✅ useToast Hook 封装
4. ✅ 在 Skills 和 Tokens 页面应用
5. ✅ TypeScript 类型安全
6. ✅ 符合设计系统规范

**使用方法:**
```tsx
const { success, error } = useToast()
success("操作成功")
error("操作失败", { description: "详细信息" })
```

