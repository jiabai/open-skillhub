# SkillHub 设计系统规范

> Open SkillHub 多用户控制台的设计系统
> 基于 Tailwind CSS + shadcn/ui 构建

---

## 1. Design Tokens

### 1.1 颜色系统

采用 HSL 色彩空间，支持亮色/暗色双主题。

#### 语义颜色

| Token | 亮色模式 | 暗色模式 | 用途 |
|-------|---------|---------|------|
| `--background` | `36 33% 98%` (暖白) | `222 22% 10%` (深蓝灰) | 页面背景 |
| `--foreground` | `222 22% 12%` (深蓝灰) | `36 30% 94%` (暖白) | 主文字 |
| `--card` | `36 33% 99%` | `222 22% 12%` | 卡片背景 |
| `--card-foreground` | `222 22% 12%` | `36 30% 94%` | 卡片文字 |
| `--primary` | `222 70% 34%` (深蓝) | `36 75% 65%` (金黄) | 主要操作 |
| `--primary-foreground` | `0 0% 100%` (白) | `222 22% 12%` (深灰) | 主按钮文字 |
| `--secondary` | `32 45% 92%` (暖米) | `222 18% 18%` (深灰) | 次要背景 |
| `--secondary-foreground` | `222 22% 16%` | `36 30% 94%` | 次要文字 |
| `--muted` | `30 30% 94%` | `222 16% 20%` | 弱化背景 |
| `--muted-foreground` | `215 14% 42%` | `30 12% 70%` | 弱化文字 |
| `--accent` | `188 65% 45%` (青绿) | `188 65% 52%` | 强调色 |
| `--accent-foreground` | `0 0% 100%` | `222 22% 12%` | 强调文字 |
| `--destructive` | `0 70% 50%` (红) | `0 62% 45%` | 危险操作 |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 98%` | 危险文字 |
| `--border` | `28 20% 88%` | `222 16% 22%` | 边框 |
| `--input` | `28 20% 86%` | `222 16% 26%` | 输入框背景 |
| `--ring` | `222 70% 34%` | `36 75% 65%` | 焦点环 |

#### 状态颜色

| 状态 | 颜色 | 用途 |
|------|------|------|
| Success | `142 76% 36%` | 成功状态 |
| Warning | `38 92% 50%` | 警告状态 |
| Info | `217 91% 60%` | 信息提示 |
| Error | `0 70% 50%` | 错误状态 |

### 1.2 字体系统

#### 字体族

| Token | 字体 | 用途 |
|-------|------|------|
| `--font-display` | Fraunces | 标题、品牌文字 |
| `--font-body` | IBM Plex Sans | 正文、UI 元素 |

#### 字体大小

| Token | 大小 | 行高 | 字重 | 用途 |
|-------|------|------|------|------|
| `--text-xs` | 0.75rem (12px) | 1rem | 400 | 辅助文字 |
| `--text-sm` | 0.875rem (14px) | 1.25rem | 400 | 小文字 |
| `--text-base` | 1rem (16px) | 1.5rem | 400 | 正文 |
| `--text-lg` | 1.125rem (18px) | 1.75rem | 500 | 大正文 |
| `--text-xl` | 1.25rem (20px) | 1.75rem | 500 | 小标题 |
| `--text-2xl` | 1.5rem (24px) | 2rem | 600 | 标题 |
| `--text-3xl` | 1.875rem (30px) | 2.25rem | 600 | 大标题 |
| `--text-4xl` | 2.25rem (36px) | 2.5rem | 700 | 超大标题 |

### 1.3 间距系统

基于 4px 网格（Tailwind 默认）。

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-1` | 0.25rem (4px) | 极小间距 |
| `--space-2` | 0.5rem (8px) | 小间距 |
| `--space-3` | 0.75rem (12px) | 中小间距 |
| `--space-4` | 1rem (16px) | 默认间距 |
| `--space-5` | 1.25rem (20px) | 中间距 |
| `--space-6` | 1.5rem (24px) | 大间距 |
| `--space-8` | 2rem (32px) | 超大间距 |
| `--space-10` | 2.5rem (40px) | 特大间距 |
| `--space-12` | 3rem (48px) | 区域间距 |

### 1.4 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | calc(var(--radius) - 4px) | 小圆角 |
| `--radius-md` | calc(var(--radius) - 2px) | 中圆角 |
| `--radius-lg` | var(--radius) (0.75rem / 12px) | 默认圆角 |
| `--radius-full` | 9999px | 完全圆角 |

### 1.5 阴影系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-sm` | 0 1px 2px 0 rgb(0 0 0 / 0.05) | 轻微阴影 |
| `--shadow-md` | 0 4px 6px -1px rgb(0 0 0 / 0.1) | 默认阴影 |
| `--shadow-lg` | 0 10px 15px -3px rgb(0 0 0 / 0.1) | 悬浮阴影 |
| `--shadow-xl` | 0 20px 25px -5px rgb(0 0 0 / 0.1) | 大阴影 |

### 1.6 过渡动画

| Token | 值 | 用途 |
|-------|-----|------|
| `--transition-fast` | 100ms ease-in-out | 快速反馈 |
| `--transition-base` | 150ms ease-in-out | 默认过渡 |
| `--transition-slow` | 200ms ease-in-out | 慢速过渡 |
| `--transition-colors` | color, background-color 150ms ease-in-out | 颜色过渡 |

---

## 2. 组件规范

### 2.1 Button 按钮

#### 变体

| 变体 | 用途 | 背景 | 文字 | Hover |
|------|------|------|------|-------|
| `default` | 主要操作 | `--primary` | `--primary-foreground` | 90% 透明度 |
| `secondary` | 次要操作 | `--secondary` | `--secondary-foreground` | 80% 透明度 |
| `outline` | 边框按钮 | transparent | `--foreground` | `--muted` |
| `ghost` | 幽灵按钮 | transparent | `--foreground` | `--muted` |
| `destructive` | 危险操作 | `--destructive` | `--destructive-foreground` | 90% 透明度 |

#### 尺寸

| 尺寸 | 高度 | 水平内边距 | 用途 |
|------|------|-----------|------|
| `sm` | 2rem (32px) | 0.75rem | 紧凑布局 |
| `default` | 2.5rem (40px) | 1rem | 默认 |
| `lg` | 2.75rem (44px) | 1.5rem | 突出显示 |
| `icon` | 2.5rem (40px) | 0 | 图标按钮 |

#### 状态

- **Default**: 默认样式
- **Hover**: 鼠标悬停，背景变暗/变亮
- **Active**: 点击时，scale(0.98) + 颜色加深
- **Disabled**: opacity 0.5，pointer-events none
- **Loading**: 显示 Spinner，禁用交互

#### 无障碍

- 必须有 `aria-label`（如果是图标按钮）
- 焦点时显示 `--ring` 环
- 支持键盘 Enter/Space 触发

### 2.2 Card 卡片

#### 结构

```
┌─ Card ──────────────────────────────┐
│  ┌─ CardHeader ───────────────────┐ │
│  │  [Icon]  Title              [Action]│
│  │  Description                       │
│  └──────────────────────────────────┘ │
│  ┌─ CardContent ──────────────────┐  │
│  │                                   │
│  └──────────────────────────────────┘ │
│  ┌─ CardFooter ───────────────────┐  │
│  │  [Actions]                        │
│  └──────────────────────────────────┘ │
└───────────────────────────────────────┘
```

#### 样式

- 背景: `--card`
- 文字: `--card-foreground`
- 边框: 1px solid `--border`
- 圆角: `--radius-lg`
- 阴影: `--shadow-sm`

#### 变体

| 变体 | 用途 | 样式 |
|------|------|------|
| `default` | 默认卡片 | 标准样式 |
| `outline` | 边框卡片 | 仅边框，无背景 |
| `ghost` | 幽灵卡片 | 透明背景 |

### 2.3 Input 输入框

#### 样式

- 高度: 2.5rem (40px)
- 水平内边距: 0.75rem (12px)
- 背景: `--input`
- 边框: 1px solid `--border`
- 圆角: `--radius-md`
- 文字: `--foreground`
- Placeholder: `--muted-foreground`

#### 状态

| 状态 | 样式 |
|------|------|
| Default | 标准边框 |
| Focus | `--ring` 焦点环 |
| Disabled | opacity 0.5 |
| Error | `--destructive` 边框 |

#### 无障碍

- 必须关联 `label`
- Error 时添加 `aria-invalid="true"`
- Error 消息关联 `aria-describedby`

### 2.4 Badge 标签

#### 变体

| 变体 | 用途 | 背景 | 文字 |
|------|------|------|------|
| `default` | 默认 | `--secondary` | `--secondary-foreground` |
| `secondary` | 次要 | `--muted` | `--muted-foreground` |
| `outline` | 边框 | transparent | `--foreground` |
| `accent` | 强调 | `--accent` | `--accent-foreground` |
| `destructive` | 危险 | `--destructive` | `--destructive-foreground` |

#### 尺寸

| 尺寸 | 高度 | 水平内边距 | 文字大小 |
|------|------|-----------|---------|
| `sm` | 1.25rem | 0.5rem | `--text-xs` |
| `default` | 1.5rem | 0.625rem | `--text-xs` |
| `lg` | 1.75rem | 0.75rem | `--text-sm` |

### 2.5 Dialog 对话框

#### 结构

```
┌─ DialogOverlay ─────────────────────┐
│  ┌─ DialogContent ────────────────┐ │
│  │  ┌─ DialogHeader ────────────┐ │ │
│  │  │  ┌─ DialogTitle ─────────┐ │ │ │
│  │  │  └─ DialogDescription ───┘ │ │ │
│  │  └──────────────────────────┘ │ │
│  │  ┌─ [Content] ──────────────┐ │ │
│  │  └──────────────────────────┘ │ │
│  │  ┌─ DialogFooter ────────────┐ │ │
│  │  │  [Cancel] [Confirm]       │ │ │
│  │  └──────────────────────────┘ │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

#### 样式

- 遮罩: `--background` 80% 透明度
- 内容: `--card` 背景
- 圆角: `--radius-lg`
- 阴影: `--shadow-xl`
- 最大宽度: 32rem (512px)

#### 动画

- 打开: 200ms fade-in + zoom-in
- 关闭: 150ms fade-out

#### 无障碍

- `role="dialog"` + `aria-modal="true"`
- 焦点困在对话框内
- Escape 关闭
- 关闭后焦点返回触发按钮

### 2.6 Tabs 标签页

#### 结构

```
┌─ Tabs ──────────────────────────────┐
│  ┌─ TabsList ──────────────────────┐ │
│  │  [Tab 1] [Tab 2*] [Tab 3]       │ │  (* = active)
│  └─────────────────────────────────┘ │
│  ┌─ TabsContent ───────────────────┐ │
│  │  [Content for Tab 2]            │ │
│  └──────────────────────────────────┘ │
└───────────────────────────────────────┘
```

#### 样式

**TabsList:**
- 背景: `--muted`
- 圆角: `--radius-md`
- 内边距: 0.25rem

**TabTrigger:**
- 默认: transparent
- Active: `--card` 背景 + `--shadow-sm`
- 圆角: `--radius-sm`

### 2.7 Toast 通知

基于 [sonner](https://sonner.emilkowal.ski/) 库实现，使用 `useToast` Hook 进行调用。

#### 使用方法

```tsx
import { useToast } from "@/hooks/use-toast"

function MyComponent() {
  const { success, error, warning, info } = useToast()

  const handleAction = () => {
    success("操作成功", { description: "详细信息", duration: 4000 })
    error("操作失败", { description: "错误详情", duration: 5000 })
    warning("注意", { description: "警告信息" })
    info("提示", { description: "一般信息" })
  }
}
```

#### 位置

固定在屏幕右下角 (bottom-4 right-4)

#### 变体

| 变体 | 用途 | 对应方法 |
|------|------|----------|
| `success` | 成功 | `toast.success()` |
| `error` | 错误 | `toast.error()` |
| `warning` | 警告 | `toast.warning()` |
| `info` | 一般信息 | `toast.info()` |

#### 动画

- 进入: 300ms slide-in-from-right
- 退出: 200ms fade-out
- 默认持续时间: 4000ms (success/warning/info), 5000ms (error)

#### 结构

```
┌─ Toast ─────────────────────────────┐
│  [Icon]  Title                    [X] │
│         Description                   │
│  [Action Button]                      │
└───────────────────────────────────────┘
```

---

## 3. 布局规范

### 3.1 页面结构

```
┌─ Page ──────────────────────────────┐
│  ┌─ Header ────────────────────────┐ │
│  │  Title                            │
│  │  Description / Actions           │
│  └───────────────────────────────────┘ │
│  ┌─ Content ────────────────────────┐ │
│  │                                   │
│  └───────────────────────────────────┘ │
└───────────────────────────────────────┘
```

### 3.2 容器

| 容器 | 最大宽度 | 水平内边距 |
|------|---------|-----------|
| `container-sm` | 640px | 1rem |
| `container-md` | 768px | 1rem |
| `container-lg` | 1024px | 1.5rem |
| `container-xl` | 1280px | 1.5rem |
| `container-2xl` | 1400px | 2rem |

### 3.3 网格系统

使用 Tailwind 网格类：

| 类名 | 列数 | 用途 |
|------|------|------|
| `grid-cols-1` | 1 | 移动端默认 |
| `grid-cols-2` | 2 | 平板并排 |
| `grid-cols-3` | 3 | 桌面三列 |
| `grid-cols-4` | 4 | 大屏四列 |

常用组合：
- `grid gap-4 lg:grid-cols-3` - 响应式三列
- `grid gap-4 lg:grid-cols-[1.1fr_0.9fr]` - 非对称两列

### 3.4 响应式断点

| 断点 | 宽度 | 用途 |
|------|------|------|
| `sm` | 640px | 大手机 |
| `md` | 768px | 平板 |
| `lg` | 1024px | 小桌面 |
| `xl` | 1280px | 桌面 |
| `2xl` | 1536px | 大桌面 |

---

## 4. 交互规范

### 4.1 加载状态

#### Skeleton 骨架屏

```tsx
<Skeleton className="h-6 w-32" />      // 标题
<Skeleton className="h-4 w-full" />     // 正文行
<Skeleton className="h-4 w-3/4" />      // 短正文
<Skeleton className="h-16 w-full" />    // 列表项
```

#### Spinner 加载指示器

- 尺寸: 1rem (16px) 默认
- 动画: animate-spin
- 颜色: `--muted-foreground`

#### 按钮加载状态

```tsx
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      处理中...
    </>
  ) : (
    "提交"
  )}
</Button>
```

### 4.2 空状态

```tsx
<EmptyState
  icon={<PackageIcon className="h-12 w-12" />}
  title="暂无 Skills"
  description="创建一个 Skill 来开始使用"
  action={{ label: "创建 Skill", onClick: () => router.push("/skills/new") }}
/>
```

### 4.3 错误状态

#### 页面级错误

```tsx
<Card>
  <CardContent className="py-10 text-sm text-destructive">
    {error}
  </CardContent>
</Card>
```

#### 表单错误

```tsx
<Input
  aria-invalid={!!error}
  aria-describedby={error ? "error-msg" : undefined}
/>
{error && (
  <p id="error-msg" role="alert" className="text-sm text-destructive">
    {error}
  </p>
)}
```

### 4.4 动画规范

#### 时长

| 场景 | 时长 | 缓动函数 |
|------|------|---------|
| 按钮点击反馈 | 100ms | ease-in-out |
| 模态框打开 | 200ms | ease-out |
| 模态框关闭 | 150ms | ease-in |
| Tab 切换 | 150ms | ease-in-out |
| Toast 滑入 | 300ms | ease-out |
| Toast 消失 | 200ms | ease-in |
| 骨架屏脉冲 | 1500ms | ease-in-out (循环) |

#### 变换

| 效果 | 值 |
|------|-----|
| 按钮点击 | scale(0.98) |
| 模态框打开 | scale(0.95) → scale(1) |
| Toast 滑入 | translateX(100%) → translateX(0) |

---

## 5. 无障碍规范 (WCAG AA)

### 5.1 颜色对比度

| 元素 | 最小对比度 | 目标 |
|------|-----------|------|
| 正文文字 | 4.5:1 | ✅ |
| 大文字 (>18px) | 3:1 | ✅ |
| UI 组件 | 3:1 | ✅ |

### 5.2 焦点管理

- 所有可交互元素必须有可见焦点状态
- 焦点环: 2px solid `--ring`，偏移 2px
- Tab 顺序必须符合视觉顺序

### 5.3 键盘导航

| 组件 | Tab | Enter/Space | Escape | Arrow Keys |
|------|-----|-------------|--------|------------|
| 按钮 | 聚焦 | 触发 | - | - |
| 输入框 | 聚焦 | - | 关闭建议 | 移动光标 |
| 对话框 | 困在内部 | - | 关闭 | - |
| 下拉菜单 | 聚焦触发器 | 打开 | 关闭 | 导航选项 |
| Tabs | 聚焦当前 | 激活 | - | 水平切换 |
| Toast | 忽略 | - | 关闭 | - |

### 5.4 ARIA 属性

| 场景 | ARIA 属性 |
|------|----------|
| 图标按钮 | `aria-label="描述"` |
| 加载中 | `aria-busy="true"` |
| 禁用 | `aria-disabled="true"` |
| 表单错误 | `aria-invalid="true"` + `aria-describedby` |
| 展开/折叠 | `aria-expanded="true/false"` |
| 对话框 | `role="dialog"` + `aria-modal="true"` |

### 5.5 运动偏好

**CSS 实现：**

```css
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
```

**说明：**
- 尊重用户的减少动画偏好设置
- 应用于全局 CSS (globals.css)
- 禁用所有动画和过渡效果
- 滚动行为改为即时

---

## 6. 组件模式

### 6.1 AppShell 应用外壳

**功能：**
- 统一的应用布局框架
- 响应式导航（桌面标签栏 + 移动端 Sheet）
- 用户菜单下拉框
- 退出登录确认对话框
- Skip Link 无障碍支持

**结构：**

```
┌─ AppShell ───────────────────────────┐
│  ┌─ Skip Link (sr-only) ────────────┐ │  无障碍跳转
│  └──────────────────────────────────┘ │
│  ┌─ Header ─────────────────────────┐ │
│  │  ┌─ Logo ───────────────────────┐ │ │
│  │  │  [Icon] SkillHub              │ │ │
│  │  └──────────────────────────────┘ │ │
│  │  ┌─ Desktop Nav ────────────────┐ │ │  md:flex
│  │  │  [概览] [Skills] [Tokens]...  │ │ │
│  │  └──────────────────────────────┘ │ │
│  │  ┌─ Actions ───────────────────┐ │ │
│  │  │  [Theme] [工作台 ▼] [Menu ☰]│ │ │  Menu = mobile
│  │  └──────────────────────────────┘ │ │
│  └──────────────────────────────────┘ │
│  ┌─ Main Content ──────────────────┐ │
│  │  {children}                      │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

**响应式行为：**

| 断点 | 布局 |
|------|------|
| `< md` (768px) | Sheet 抽屉导航 + 汉堡菜单 |
| `>= md` | 水平标签导航 |

**无障碍特性：**

| 特性 | 实现 |
|------|------|
| Skip Link | `sr-only focus:not-sr-only` |
| ARIA Labels | Logo、菜单按钮、图标 |
| Focus States | `focus-visible:ring-2` |
| Touch Targets | `min-h-[44px]` |
| Logout Confirm | AlertDialog 确认 |

**代码示例：**

```tsx
// Skip Link
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute ..."
>
  跳转到主内容
</a>

// Navigation Link with Accessibility
<Link
  href={item.href}
  className={cn(
    "inline-flex items-center gap-2 rounded-lg px-3 py-2",
    "min-h-[44px]", // Touch target
    "focus-visible:ring-2 focus-visible:ring-ring", // Focus state
    isActive ? "bg-primary text-primary-foreground" : "bg-muted/60"
  )}
>
  <Icon className="h-4 w-4" aria-hidden="true" />
  {item.label}
</Link>

// Logout with Confirmation
<AlertDialog>
  <AlertDialogTrigger asChild>
    <DropdownMenuItem className="text-destructive">
      <LogOut className="h-4 w-4" aria-hidden="true" />
      退出登录
    </DropdownMenuItem>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
      <AlertDialogDescription>
        退出后需要重新登录才能访问您的账户。
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>取消</AlertDialogCancel>
      <AlertDialogAction onClick={handleLogout}>
        确认退出
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 6.2 Sheet 抽屉组件

**用途：**
- 移动端导航抽屉
- 侧边栏菜单
- 从屏幕边缘滑入的面板

**变体：**

| Side | 用途 |
|------|------|
| `left` | 左侧导航栏 |
| `right` | 右侧设置面板、移动端菜单 |
| `top` | 顶部通知栏 |
| `bottom` | 底部操作栏 |

**无障碍：**

- `role="dialog"` + `aria-modal="true"`
- 焦点困在 Sheet 内
- Escape 关闭
- 点击遮罩关闭
- 关闭按钮有 `sr-only` 文字

---

## 7. 页面特定规范

### 6.1 登录/注册页

- 布局: 双栏（品牌区 + 表单区）
- 表单: Card 包裹，最大宽度 400px
- 输入框: 垂直排列，gap-4

### 6.2 Dashboard

- 统计卡片: 3 列网格
- 快捷入口: 2 列网格
- 操作按钮: 右上角

### 6.3 Skills 列表

- 搜索栏: Card 包裹，flex 布局
- 列表: 单列，gap-4
- 列表项: Card，header 包含标题和操作

### 6.4 Skill 详情

- Tabs: 概览、文件、版本、设置
- 内容区: 根据 Tab 变化

#### 版本 Tab (VersionsTab)

**功能：**
- 展示版本历史列表
- 支持选择两个版本进行对比
- 显示依赖变更（新增/移除）
- 支持回滚到指定版本

**组件：**
- `VersionsTab` - 主容器组件
- 布局：左侧版本列表 + 右侧详情面板

**交互：**
- 单选：查看版本详情（描述、依赖、元数据）
- 双选：对比版本差异
- 回滚：创建新版本（复制目标版本）

**文件位置：**
- `frontend/src/app/skills/[skillUuid]/_components/versions-tab.tsx`

### 6.5 Tokens

- 创建表单 + 列表并排（大屏）
- Token 值: 脱敏显示（前4后4）

### 6.6 Profile/Security

- 表单: 最大宽度 2xl
- 卡片分组: 基本信息、组织信息
- 危险操作: 单独 Card，边框红色

---

## 7. 实现参考

### 7.1 Tailwind 类名速查

| 设计 Token | Tailwind 类名 |
|-----------|--------------|
| `--background` | `bg-background` |
| `--foreground` | `text-foreground` |
| `--primary` | `bg-primary text-primary-foreground` |
| `--radius-lg` | `rounded-lg` |
| `--space-4` | `gap-4` / `p-4` / `m-4` |
| `--text-sm` | `text-sm` |
| `--font-display` | `font-display` |

### 7.2 常用组合

```tsx
// 页面容器
<div className="container mx-auto max-w-screen-xl px-6 py-8">

// 卡片列表
<div className="grid gap-4">

// 响应式两列
<div className="grid gap-4 lg:grid-cols-2">

// 按钮组
<div className="flex flex-wrap gap-2">

// 表单垂直布局
<div className="space-y-4">

// 水平对齐
<div className="flex items-center justify-between">
```

---

## 8. 设计原则

1. **一致性** - 使用统一的 Design Tokens，避免硬编码值
2. **层次清晰** - 通过颜色、字号、间距建立视觉层次
3. **反馈及时** - 每个操作都有即时反馈（hover、active、loading）
4. **容错设计** - 错误状态友好，提供恢复路径
5. **无障碍优先** - 所有设计考虑键盘和屏幕阅读器用户
6. **移动优先** - 响应式设计，核心功能移动端可用

---

*文档版本: 1.0*
*更新日期: 2026-03-22*
