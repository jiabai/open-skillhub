# Product Spec: Help Center

## User-Visible Goal

为普通 SaaS 用户提供一份内嵌于 Web 控制台的帮助文档，帮助他们理解 SkillDrive 的核心概念、完成常见操作，并在遇到问题时自助找到答案。

## Scope

### In Scope

- 一个可通过 `/help` 访问的帮助中心页面
- 左侧目录树 + 右侧内容区的经典文档布局
- 覆盖普通用户日常使用的帮助主题（快速入门、Skills、令牌、账户等）
- 顶部导航栏新增帮助入口（图标按钮）
- 支持中英双语（复用现有 i18n 体系）
- 移动端响应式（目录可折叠为抽屉）
- 内容区支持锚点跳转与当前章节高亮

### Non-Goals

- 不接入第三方文档平台（如 GitBook、Notion）
- 不做全文搜索（第一期不做，后续可扩展）
- 不做用户反馈/打分系统
- 不覆盖管理员专属功能（用户管理、审计日志等）的详细说明
- 不需要后端 API 支持（纯前端静态内容）

## Affected Surfaces

| 表面 | 变更 |
|------|------|
| 路由 | 新增 `/help` 路由 |
| 导航 | AppShell 顶部右侧新增帮助图标入口 |
| i18n | `zh-CN.ts` / `en-US.ts` 新增 `help` 命名空间 |
| 组件 | 新增 `HelpSidebar`、`HelpContent`、`HelpLayout` 等组件（位于 `components/app/`） |
| 页面 | 新增 `frontend/src/app/help/page.tsx` |

## Acceptance Criteria

1. 用户点击顶部导航栏的 `?` 图标按钮后，跳转到 `/help` 页面
2. `/help` 页面展示左侧目录树和右侧内容，目录项点击后平滑滚动到对应内容区
3. 目录树当前激活项随滚动自动高亮
4. 移动端下目录树折叠为左侧抽屉，通过按钮触发打开
5. 所有帮助文案支持中英文切换（与全局语言设置一致）
6. 页面风格与现有控制台一致（Tailwind + shadcn/ui 配色、字体、圆角）
7. 内容覆盖以下主题（至少）：快速入门、Skills（公共/私有/引用/克隆）、令牌管理、账户与安全、常见问题
8. 帮助内容不硬编码 inline，统一走 i18n 字典，便于后续维护
9. 路由 `/help` 在未登录状态下也可访问（方便未登录用户了解产品）
10. 页面通过 `npm run lint` 和 `npm run build` 检查

## Information Architecture

```
帮助中心 (/help)
├── 快速入门
│   ├── SkillDrive 是什么
│   ├── 注册与登录
│   └── 界面导览
├── Skills
│   ├── 公共 Skills（引用与克隆）
│   ├── 我的 Skills
│   ├── 上传 Skill
│   └── 版本管理
├── 令牌与客户端
│   ├── 创建 API 令牌
│   ├── 连接桌面客户端
│   └── 令牌生命周期
├── 账户与安全
│   ├── 更新个人信息
│   ├── 绑定邮箱
│   └── 删除账户
└── 常见问题
    ├── 引用和克隆有什么区别
    ├── 令牌丢失怎么办
    └── Skill 上传失败怎么办
```

## UX Notes

- 目录树最大宽度 260px，内容区最大宽度与现有主内容区一致（max-w-screen-xl）
- 内容区标题使用清晰的层级（h2 → h3），段落行高 1.75，保证长文可读性
- 使用 `scroll-smooth` 实现平滑滚动
- 帮助入口使用 `HelpCircle` 图标（Lucide），放置在 ThemeToggle 旁边
