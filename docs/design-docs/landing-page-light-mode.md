# 浅色模式宣传导览页设计说明

## 这份文档解决什么问题

Open SkillHub 需要一个面向未登录用户的宣传导览页（Landing Page），用于说明产品定位、
建立可信的第一印象，并引导用户登录、注册或浏览公开 Skills。本文档定义浅色模式下的
视觉和信息架构约定，供后续实现使用。

本文档是设计决策，不表示当前前端代码已经实现这些页面结构。实现前必须先完成对应的
产品规格和 ExecPlan：

- `docs/product-specs/2026-05-02-landing-page-light-mode.md`
- `docs/exec-plans/completed/landing-page-light-mode-plan.md`
- `docs/exec-plans/completed/landing-page-light-mode-tasks.md`

## 已修正的设计约束

本设计说明不得包含不可证实或与当前代码冲突的描述。后续实现必须遵守以下修正：

- 不虚构评分、客户数量、客户 Logo 或公司背书。没有真实数据前，不展示星级评分和
  “Trusted by” Logo 墙。
- 不热链第三方视频或图片资源。视觉资产必须放入仓库可控的静态资源位置，或在
  `docs/references/` 记录授权来源。
- 不使用装饰性玻璃球、渐变球、bokeh 光斑或独立圆球作为主要视觉。主视觉应展示产品
  状态、能力流程或可检查的界面预览。
- 不使用负字距。宣传页所有文字 `letter-spacing` 保持 `0`。
- 不把 `frontend/src/app/(landing)/page.tsx` 描述成可直接落地的事实；当前已有
  `frontend/src/app/page.tsx`，Next.js 路由组不能与它同时声明根路径 `/`。
- 不假设路由组可以绕过 `RootLayout` 中的 `AppShell`。当前 `AppShell` 会对非登录/注册
  路由执行认证检查，Landing Page 若要公开访问，必须先调整 Shell 边界。
- 不混用 `hsl(var(--token))` 和 OKLCH token 值。实现阶段已将 `globals.css` 中覆盖
  Tailwind HSL 语义色的 OKLCH token 收敛为 HSL 变量。

## 产品定位与文案方向

Landing Page 的首屏必须直接说明 Open SkillHub 是什么，而不是使用泛化的项目管理类文案。

推荐信息层级：

| 元素 | 内容方向 |
|------|----------|
| H1 | `Open SkillHub` |
| 副标题 | 面向 AI agent 团队的私有 Skill 注册表、版本管理和分发控制台 |
| 信任徽章 | `Private skill registry for AI agents` 或 `Versioned skills, governed distribution` |
| 主 CTA | 注册或开始使用，例如 `Create account` |
| 次 CTA | 登录或浏览公开 Skills，例如 `Sign in` / `Browse public skills` |

所有用户可见文字必须进入 `frontend/src/i18n/` 字典，不写在组件内。

## 视觉概念：Agent Skill Control Room

浅色 Landing Page 的视觉方向是 **Agent Skill Control Room**：一个给 AI agent 团队使用的
能力控制台。页面要有“精密、可信、可操作”的感觉，而不是通用 SaaS 的装饰性炫技。

设计记忆点：

- 首屏右侧不是抽象图形，而是一块产品相关的“能力控制台预览”。
- 预览里能看到 Skills、版本、权限、同步状态和分发关系，让用户一眼明白产品管理的对象。
- 视觉高级感来自细线网格、状态标签、层级面板、轻量动效和清晰的信息密度。
- 页面整体是浅色、干净、专业的工作台气质，避免大片紫蓝渐变或纯装饰光效。

### 首屏叙事

首屏讲一个具体故事：

1. 团队把 agent 能力封装为 versioned Skills。
2. Open SkillHub 记录私有与公开 Skills 的状态、版本和权限。
3. API Token、桌面同步或客户端分发从同一个受管控入口获取能力。

用户看到的不是“我们很酷”，而是“这里能控制我的 agent 能力供应链”。

### 首屏构图

| 区域 | 视觉内容 | 设计意图 |
|------|----------|----------|
| 左侧 Hero Copy | 徽章、H1、副标题、两个 CTA、3 个能力事实标签 | 快速说明产品价值和入口 |
| 右侧 Control Room Preview | registry 面板、version rail、distribution map、sync ticker | 用产品状态制造记忆点 |
| 底部 Capability Strip | 3-4 个真实能力事实 | 替代虚构 Logo 墙，增加可信度 |

桌面端左侧约占 `44%`，右侧约占 `56%`。右侧预览可以略高于左侧正文，但不得遮挡导航或底部
能力条。移动端按顺序堆叠：Hero Copy -> CTA -> Control Room Preview -> Capability Strip。

### 主视觉组成

Control Room Preview 由三个可组件化区域组成：

| 区域 | 内容 | 视觉规格 |
|------|------|----------|
| Registry Panel | 3 条示例 Skill 记录，包含名称、visibility、current version、updated 状态 | 主面板，`bg-card`、细边框、8px 圆角 |
| Version Rail | 当前选中 Skill 的 `v1.0.0 -> v1.1.0 -> v1.2.0` 版本轨道 | 细线连接，小圆点节点，使用 `primary` 低透明度 |
| Distribution Map | API Token、Desktop Sync、Public Catalog 三个分发目的地 | 小型节点图，线条使用 `border` 和 `accent` |

示例数据必须明显是示例，不伪装成真实用户数据。推荐示例：

- `review-checklist`
- `release-notes`
- `security-audit`

每条记录可以显示 `private`、`public`、`api-token`、`synced` 等状态标签，但标签含义必须与当前或
已规划的产品能力一致。

### 视觉质感

| 元素 | 约定 |
|------|------|
| 背景 | 暖白或白色页面画布，可叠加非常轻的细线网格，透明度低于 `0.06` |
| 面板 | 使用 `bg-card`、`border-border`、极轻 shadow，避免厚重玻璃质感 |
| 线条 | 使用 1px 细线，表达版本流和分发关系 |
| 状态标签 | 使用 `secondary`、`muted`、`accent` 的低饱和组合 |
| 强调 | 只在 CTA、选中版本节点和少量状态点使用 `primary` |
| 空间 | 信息密度高于普通营销页，但每个面板内部留出足够呼吸感 |

这个方向允许页面“酷”，但酷来自产品结构被视觉化，而不是来自与产品无关的素材。

## 色彩约定

### 使用原则

宣传导览页应使用项目语义色，不引入新的全局色板：

- 交互色、强调色和边框优先使用 Tailwind 语义类，例如 `bg-primary`、`text-primary-foreground`、
  `border-border`、`text-muted-foreground`。
- 需要透明度时，可以使用 HSL 兼容 token 的透明度形式，例如 `hsl(var(--primary) / 0.12)`。
- 背景、文字、卡片、边框等 token 均保持 HSL 值，以兼容 `tailwind.config.ts` 中的
  `hsl(var(--token))` 语义色映射。
- HEX 值只作为设计参考，不是实现来源。
- 视觉资产自身包含的像素颜色不属于 UI token；但资产必须来自仓库可控文件或有明确授权。

### 当前浅色 token 参考

| 角色 | CSS 变量 | 当前来源 | 实现使用 |
|------|----------|----------|----------|
| Primary | `--primary` | 顶层 HSL `222 70% 34%` | CTA、焦点、品牌强调 |
| Primary 前景 | `--primary-foreground` | 顶层 HSL `0 0% 100%` | Primary 上的文字 |
| Secondary | `--secondary` | 顶层 HSL `32 45% 92%` | 次级背景、徽章 |
| Secondary 前景 | `--secondary-foreground` | 顶层 HSL `222 22% 16%` | 次级文字 |
| Accent | `--accent` | 顶层 HSL `188 65% 45%` | 少量辅助强调 |
| Accent 前景 | `--accent-foreground` | 顶层 HSL `0 0% 100%` | Accent 上的文字 |
| Muted | `--muted` | 顶层 HSL `30 30% 94%` | 弱化背景 |
| Muted 前景 | `--muted-foreground` | 顶层 HSL `215 14% 42%` | 辅助说明文字 |
| Card | `--card` | 顶层 HSL `36 33% 99%` | 预览面板或重复项背景 |
| Card 前景 | `--card-foreground` | 顶层 HSL `222 22% 12%` | 预览面板文字 |
| Border | `--border` | 顶层 HSL `28 20% 88%` | 边框、分割线 |
| Background | `--background` | HSL `36 33% 99%` | 页面背景 |
| Foreground | `--foreground` | HSL `222 22% 12%` | 主文字 |
| Ring | `--ring` | 顶层 HSL `222 70% 34%` | 焦点环 |
| Destructive | `--destructive` | 顶层 HSL `0 70% 50%` | 错误、警告 |

### Primary 衍生效果

不新增 `Primary-50`、`Primary-100` 等全局变量。浅色 Landing Page 如需强调背景或高光，
使用 `--primary` 的低透明度版本，并限制在局部组件样式中：

| 用途 | 推荐表达 |
|------|----------|
| CTA hover | `bg-primary` 或 `bg-primary/90` |
| 局部高光 | `hsl(var(--primary) / 0.08)` |
| 分割强调 | `hsl(var(--primary) / 0.18)` |

## 布局结构

### 整体架构

```
┌─────────────────────────────────────────────────────┐
│ Public Landing Shell                                │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Public Navbar                                  │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  Hero Section                                   │ │
│  │  ┌──────────────┬──────────────────────────┐   │ │
│  │  │  Hero Copy   │  Control Room Preview    │   │ │
│  │  └──────────────┴──────────────────────────┘   │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  Capability Proof Strip                         │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

页面不使用嵌套卡片。首屏背景应是完整页面画布或轻量分区，不使用漂浮装饰球。个别重复项
可以使用卡片，但圆角不超过 `8px`，除非复用现有 shadcn 组件需要遵守项目 `--radius`。

### 响应式断点

| 断点 | 布局 | 说明 |
|------|------|------|
| < 768px | 单列 | Hero copy 在前，产品预览在后，CTA 换行但不溢出 |
| 768px-1024px | 单列增强 | 产品预览全宽显示，能力条使用 2 列或横向滚动 |
| > 1024px | 双列 | Hero copy 与产品预览并排，内容宽度受容器约束 |

固定格式元素必须有稳定尺寸约束，例如 `aspect-ratio`、`min-height`、`max-width` 或明确的
grid track，避免图标、按钮和预览面板在 hover 或加载时造成布局跳动。

### 首屏尺寸建议

| 元素 | 桌面端建议 | 移动端建议 |
|------|------------|------------|
| Public Shell | `min-h-screen`，首屏底部露出 Capability Strip 顶部 | 内容自然高度，不强制塞满视口 |
| Hero Section | `grid-template-columns: minmax(0, 0.9fr) minmax(520px, 1.1fr)` | 单列，`gap-8` |
| Control Room Preview | `aspect-ratio: 1.16 / 1`，`min-height: 520px` | `aspect-ratio: 0.92 / 1`，隐藏次要装饰线 |
| Registry Panel | 右侧预览内最大视觉权重 | 保留 2-3 条记录，缩短标签文案 |
| Capability Strip | 首屏底部露出至少 48px | 在预览后完整展示 |

## 字体与排版

宣传导览页使用项目 `layout.tsx` 已加载的字体，不引入额外字体：

| 角色 | 字体 | CSS 变量 | Tailwind |
|------|------|----------|----------|
| 标题与品牌 | Fraunces | `--font-display` | `font-display` |
| 正文与 UI | IBM Plex Sans | `--font-body` | `font-body` |
| 备用无衬线 | Inter | `--font-sans` | `font-sans` |

### 排版规格

| 元素 | 字体 | 大小 | 行高 | 字距 |
|------|------|------|------|------|
| Hero 标题 | Fraunces Bold | mobile 40px / md 56px / lg 72px | 1.05 | 0 |
| 品牌名 | Fraunces Bold | 20px | 1.2 | 0 |
| 导航链接 | IBM Plex Sans Medium | 14px | 1.5 | 0 |
| 副标题 | IBM Plex Sans Regular | 18px | 1.6 | 0 |
| CTA 文字 | IBM Plex Sans Medium | 16px | 1.5 | 0 |
| 徽章文字 | IBM Plex Sans Medium | 14px | 1.5 | 0 |
| 能力条文字 | IBM Plex Sans Regular | 14px | 1.5 | 0 |

字体大小通过断点切换，不使用 `vw` 字号。按钮和紧凑面板内部不使用 Hero 级字号。

## 组件设计

### Public Navbar

Landing Page 需要自己的公开导航，不复用认证后的 `AppShell` 顶栏。

| 属性 | 约定 |
|------|------|
| 定位 | 首屏顶部，建议 `sticky top-4` 或静态顶部导航 |
| 背景 | `bg-card/80` 加轻量 `backdrop-blur`，避免厚重玻璃效果 |
| 边框 | `border border-border/70` |
| 圆角 | `rounded-md` |
| 内边距 | `px-4 py-3`，移动端保持可触达尺寸 |

导航项应指向真实存在或同页锚点：

- `Features` -> 首屏下方能力区锚点
- `Public skills` -> `/public-skills`
- `Sign in` -> `/login`
- `Create account` -> `/register`

不要预设 `Company`、`Pricing` 等尚未存在的页面。

### Hero 内容

#### 信任徽章

| 属性 | 值 |
|------|-----|
| 文字 | `Private skill registry for AI agents` |
| 文字色 | `text-muted-foreground` |
| 背景 | `bg-secondary` |
| 圆角 | `rounded-full` |
| 图标 | 可使用 lucide 图标，例如 `ShieldCheck` 或 `Boxes` |

该徽章表达产品属性，不表达未经证实的评分、客户数量或第三方背书。

#### 副标题

推荐文案方向：

> Manage private and public Skills, keep versions auditable, and distribute agent capabilities from one governed console.

实现时必须进入 i18n 字典，并提供中文对应文案。

#### CTA

| 类型 | 文案 | 目标 |
|------|------|------|
| 主 CTA | `Create account` | `/register` |
| 次 CTA | `Sign in` 或 `Browse public skills` | `/login` 或 `/public-skills` |

按钮使用项目 Button 组件或等价样式，带清晰图标。Hover 可使用 `hover:bg-primary/90`、
`hover:translate-y-[-1px]` 或轻量 shadow，不使用会影响布局的尺寸变化。

### Product Preview Asset

主视觉命名为 Control Room Preview，必须展示产品相关内容，而不是纯装饰素材。优先顺序：

1. 由 React 组件构成的静态预览，内容来自 i18n 或安全的示例数据。
2. 真实产品界面截图，脱敏后放入 `frontend/public/landing/`。
3. 生成的 bitmap mockup，文件保存在仓库中，并在 `docs/references/` 记录生成提示和用途。

不使用外部热链视频，例如第三方 `webm`。如果后续确实需要视频，应使用仓库托管资产，
提供静态 poster，并遵守 `prefers-reduced-motion`。

#### Control Room Preview 结构

```
┌─────────────────────────────────────────────┐
│ Toolbar: Open SkillHub / Private Registry   │
├───────────────────────┬─────────────────────┤
│ Registry Panel        │ Version Rail         │
│ - review-checklist    │ v1.0 -> v1.1 -> v1.2 │
│ - release-notes       ├─────────────────────┤
│ - security-audit      │ Distribution Map     │
│                       │ API / Desktop / Web  │
└───────────────────────┴─────────────────────┘
```

实现时建议把预览拆为以下 Landing 专用组件：

| 组件 | 职责 |
|------|------|
| `LandingControlRoomPreview` | 承载整体预览画布和响应式布局 |
| `LandingSkillRegistryPanel` | 渲染示例 Skill 列表和状态标签 |
| `LandingVersionRail` | 渲染版本节点和当前版本状态 |
| `LandingDistributionMap` | 渲染分发目的地和轻量连接线 |

这些组件都属于 `frontend/src/components/landing/`，不进入 `components/ui/`。

#### 示例面板内容

| 面板 | 示例内容 |
|------|----------|
| Toolbar | `Private registry`、`3 Skills tracked`、`API token scoped` |
| Registry row | `review-checklist`、`private`、`v1.2.0`、`synced 2m ago` |
| Registry row | `release-notes`、`team`、`v0.8.4`、`draft review` |
| Registry row | `security-audit`、`public`、`v2.1.0`、`published` |
| Version Rail | `v1.0.0 created`、`v1.1.0 reviewed`、`v1.2.0 active` |
| Distribution Map | `API Token`、`Desktop Sync`、`Public Catalog` |

如果某个示例状态当前尚未实现，文案必须改为“planned”或从预览中移除。

### Capability Proof Strip

页脚区域不展示虚构 Logo。浅色模式先使用 3 到 4 个能力事实作为可信证明：

| 项 | 内容方向 |
|----|----------|
| Versioned skills | 版本化 Skill 上传、回滚或审计语义 |
| Private distribution | 用户私有空间与权限边界 |
| Public catalog | 公开 Skills 浏览与导入 |
| Client sync ready | 桌面客户端或 API Token 分发边界 |

这些文案必须与当前或已规划的产品能力一致；尚未实现的能力应避免用完成式表达。

## 动效与交互

Landing Page 可以有动效，但动效必须服务于“控制台预览正在工作”的感觉：

| 动效 | 建议 | 约束 |
|------|------|------|
| 首屏进入 | Hero copy 与 Control Room Preview 分批淡入，延迟不超过 240ms | `prefers-reduced-motion` 下禁用 |
| Version Rail | 当前版本节点轻微高亮，连接线短暂扫过一次 | 不循环闪烁，不影响可读性 |
| Distribution Map | 分发线路可以有一次性轻微流动效果 | 不使用持续跑马灯 |
| Skill row hover | 仅改变背景和边框透明度 | 不改变行高或布局 |
| CTA hover | 轻微上移或 shadow | 不使用 scale 导致布局抖动 |

动效实现优先使用 CSS transition/keyframes；只有实现阶段已有 Motion 依赖时才考虑额外动画库。

## 与深色模式的关系

浅色模式和深色模式可以采用不同视觉方案，但共享产品信息架构：

- 共享导航结构、CTA 目标、i18n key 和可访问性交互。
- 不共享装饰层或视觉资产，除非资产在两种模式下均经过验证。
- 深色模式不在本文档中定义；需要单独设计文档或更新本文档的专门章节。
- 切换模式时，CSS token 由 ThemeProvider 控制，Landing Page 不硬编码主题判断。

## 技术规格

| 项目 | 约定 |
|------|------|
| 路由 | 首选公开根路径 `/`；实现前必须解决现有 `frontend/src/app/page.tsx` 根路由冲突 |
| Shell 边界 | Landing Page 不应被 `AppShell` 的认证跳转包裹；需调整布局边界或 AppShell 条件 |
| 组件归属 | Landing 专用组件放在 `frontend/src/components/landing/` |
| 视觉资产 | 放在 `frontend/public/landing/`，不得热链第三方资源 |
| i18n | 所有用户可见文字走 `frontend/src/i18n/` 字典 |
| API | 不调用需要认证的后端 API |
| 颜色 | 使用项目语义 token；`globals.css` token 保持 HSL 以匹配 Tailwind 映射 |
| 可访问性 | CTA 有明确可访问名称，动效尊重 `prefers-reduced-motion` |
| 验证 | 文档阶段跑 `python scripts/validate_agents_docs.py --level ERROR`；实现阶段跑 frontend lint/test/build |

## 不做什么

- 不展示未经证实的评分、客户数、客户 Logo 或商业背书。
- 不热链第三方图片、视频或字体。
- 不引入项目 CSS 变量以外的新 UI 交互色。
- 不为 Landing Page 加载额外字体。
- 不使用装饰性玻璃球、渐变球或 bokeh 光斑作为主要视觉。
- 不把 Landing 专用装饰组件放入 `components/ui/`。
- 不在 Landing Page 中调用需要认证的后端 API。
- 不在未解决 AppShell 边界前宣称页面已对未登录用户公开可访问。

## 稳定约定

- Landing Page 是公开访问体验，不属于认证后 Console Shell。
- 首屏文案必须产品相关，并避免泛化 SaaS 或项目管理套话。
- 颜色从项目 token 派生，HEX 仅作说明参考。
- 主视觉必须展示产品状态或能力流程，资产来源可追踪。
- 浅色与深色模式共享信息架构，不强制共享视觉资产。
- 后续实现必须先完成产品规格、ExecPlan 和任务清单审阅，再改代码。
