# 浅色模式宣传导览页

## 背景

当前 `frontend/src/app/page.tsx` 是认证后 App Shell 包裹下的简单入口卡片。`AppShell`
会对非登录/注册路由执行认证检查，未登录用户访问根路径会被引导到 `/login`。这意味着
Open SkillHub 目前没有真正面向未登录用户的公开宣传导览页。

Open SkillHub 需要一个可信、产品相关、可国际化的公开 Landing Page，用于说明它是面向
AI agent 团队的私有 Skill 注册表、版本管理和分发控制台，并引导用户注册、登录或浏览
公开 Skills。

## 目标

1. 在浅色模式下定义公开 Landing Page 的产品信息架构、视觉约束和可访问性要求。
2. 明确 Landing Page 与认证后 `AppShell` 的边界，避免未登录访问被当前 Shell 逻辑拦截。
3. 使用真实、可验证的产品能力表达，不虚构评分、客户数量、Logo 背书或不存在的页面。
4. 使用项目已有字体、Tailwind 语义 token、i18n 字典和前端组件边界。
5. 采用 `Agent Skill Control Room` 视觉方向，用产品预览、版本轨道和分发关系表达高级感。
6. 为后续实现提供验收标准、执行计划和任务拆分；本阶段不修改前端代码。

## 非目标

- 不在本阶段实现 React 组件、路由、布局或样式代码。
- 不设计深色模式的完整视觉方案。
- 不新增后端 API，不改变认证、权限、runtime capability 或数据模型。
- 不新增真实营销指标、客户 Logo 或商业背书；这些内容必须另有可信来源和产品确认。
- 不引入第三方热链视频、图片或字体。
- 不改变 `desktop-client/`。

## 使用场景

1. 未登录访客访问 Open SkillHub 根路径时，可以理解产品用途，并选择注册、登录或浏览公开 Skills。
2. 已有用户从公开页面进入登录流程，再回到认证后 Console。
3. 团队成员或部署方需要在不登录的情况下向同事展示 Open SkillHub 的核心价值。
4. 后续深色模式设计可以复用信息架构和 CTA 目标，但独立定义视觉资产。

## 受影响表面

后续实现预计涉及以下前端表面：

| 表面 | 预期影响 |
|------|----------|
| `frontend/src/app/layout.tsx` | 需要重新划分 Root providers 与认证后 `AppShell` 的关系，避免公开页被认证跳转包裹 |
| `frontend/src/app/page.tsx` | 需要决定根路径 `/` 是否替换为公开 Landing Page，或迁移现有认证后首页 |
| `frontend/src/components/app/app-shell.tsx` | 可能需要缩小到认证后 Console 路由，或支持明确的公开路由旁路 |
| `frontend/src/components/landing/` | 新增 Landing Page 专用组件，不放入 `components/ui/` |
| `frontend/src/i18n/` | 新增英文和中文 Landing Page 文案 |
| `frontend/public/landing/` | 放置可追踪来源的产品预览资产 |

## 功能需求

- Landing Page 必须对未登录用户公开可访问。
- 首屏必须明确显示 `Open SkillHub` 和产品定位。
- 主 CTA 指向注册流程，次 CTA 指向登录或公开 Skills 浏览。
- 导航只指向真实存在的路由或同页锚点，不预设未实现的 Pricing、Company 页面。
- 主视觉必须展示产品状态、能力流程或可检查的界面预览，不使用纯装饰玻璃球或外部热链媒体。
- 所有用户可见文字必须进入 i18n 字典。
- 页面不得调用需要认证的后端 API。
- 页面必须尊重 `prefers-reduced-motion`。

## 设计需求

- 浅色模式设计以 `docs/design-docs/landing-page-light-mode.md` 为准。
- 首屏视觉概念采用 `Agent Skill Control Room`，主视觉必须是产品相关的能力控制台预览。
- 控制台预览至少表达 Skill registry、version rail、distribution map 三类产品状态。
- 使用项目已加载的 Fraunces、IBM Plex Sans 和 Inter，不引入额外字体。
- 使用项目语义色和 Tailwind token；`globals.css` 的主题 token 应保持 HSL 值以匹配
  `tailwind.config.ts` 中的 `hsl(var(--token))` 映射。
- 不使用负字距。
- 避免嵌套卡片，重复项卡片圆角不超过 `8px`，除非复用现有组件需要遵守项目 `--radius`。
- 按移动端、平板、桌面三类布局验证文本不溢出、不互相遮挡。
- 动效应服务于控制台状态表达，必须尊重 `prefers-reduced-motion`，不得依赖持续闪烁或纯装饰动画。

## 文案约束

Landing Page 文案必须产品相关：

- 可以描述私有 Skill 管理、版本化、公开目录、API Token 或桌面同步边界。
- 可以使用能力事实，例如 “Versioned skills” 或 “Private distribution”。
- 不可以使用未经证实的 “Rated 4.9/5”、客户数量、客户 Logo 或 “Top-tier companies”。
- 不可以使用泛化任务管理文案，例如 “manage your projects and collaborate with your team”。

## 验收标准

文档阶段验收：

- 设计说明修正当前不准确描述。
- 本产品规格、对应 ExecPlan、任务清单和索引文件存在且互相可发现。
- `python scripts/validate_agents_docs.py --level ERROR` 通过。

实现阶段验收：

- 未登录用户可以访问公开 Landing Page，不被重定向到 `/login`。
- 登录、注册、公开 Skills CTA 指向正确路由。
- 认证后 Console 的导航和权限行为不回退。
- 中英文 i18n 文案完整。
- 首屏主视觉呈现 `Agent Skill Control Room`，包含 Skill 列表、版本轨道和分发目的地。
- 浅色模式布局在移动端和桌面端文本不溢出、不遮挡。
- 视觉资产来自仓库可控路径或有记录的授权来源。
- `cd frontend && npm run lint`、`cd frontend && npm test`、`cd frontend && npm run build`
  通过，或在 ExecPlan 中记录无法运行的原因和剩余风险。

## 相关文档

- `docs/design-docs/landing-page-light-mode.md`
- `docs/exec-plans/completed/landing-page-light-mode-plan.md`
- `docs/exec-plans/completed/landing-page-light-mode-tasks.md`
- `frontend/AGENTS.md`
- `docs/DESIGN.md`
