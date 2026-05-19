# Exec Plan: Help Center

## Goal

按照 `docs/product-specs/2026-05-19-help-center.md` 实现 SkillDrive Web 控制台的帮助中心。

## Files to Change

| # | 文件路径 | 说明 |
|---|----------|------|
| 1 | `frontend/src/i18n/messages/types.ts` | 扩展 `AppDictionary` 类型，新增 `help` 命名空间 |
| 2 | `frontend/src/i18n/messages/zh-CN.ts` | 添加中文帮助文案 |
| 3 | `frontend/src/i18n/messages/en-US.ts` | 添加英文帮助文案 |
| 4 | `frontend/src/lib/navigation.ts` | 可选：若导航配置需要能力开关则调整 |
| 5 | `frontend/src/components/app/app-shell.tsx` | 在顶部导航右侧新增帮助入口图标 |
| 6 | `frontend/src/app/help/page.tsx` | 帮助中心主页面（服务端组件） |
| 7 | `frontend/src/components/app/help-sidebar.tsx` | 左侧目录树组件 |
| 8 | `frontend/src/components/app/help-content.tsx` | 右侧内容渲染组件 |
| 9 | `frontend/src/components/app/help-layout.tsx` | 帮助页面布局壳（侧边栏+内容） |
| 10 | `frontend/src/lib/help-data.ts` | 帮助目录结构与锚点映射数据 |
| 11 | `frontend/src/__tests__/app-shell-auth.test.tsx` | 覆盖 `/help` 未登录公开访问和帮助入口 |
| 12 | `frontend/src/__tests__/help-page.test.tsx` | 覆盖帮助内容、目录、移动端抽屉入口 |
| 13 | `docs/product-specs/index.md` | 将帮助中心 spec 纳入索引 |
| 14 | `docs/design-docs/index.md` | 将帮助中心 design doc 纳入索引 |
| 15 | `docs/exec-plans/active/index.md` / `docs/exec-plans/completed/index.md` | 执行中/完成后维护计划索引 |

## Work Order

### Phase 1: 基础结构与类型（独立可验证）

1. 更新 `types.ts`，定义 `help` 字典类型
2. 在 `zh-CN.ts` 和 `en-US.ts` 中填充帮助文案
3. 创建 `frontend/src/lib/help-data.ts`，定义目录树数据结构
4. 运行 `cd frontend && npm run lint` 验证类型无错误

### Phase 2: 页面与布局（依赖 Phase 1）

5. 创建 `help-sidebar.tsx`：目录树渲染，接收当前激活项和选择回调
6. 创建 `help-content.tsx`：根据目录数据渲染内容区 + 锚点 ID
7. 创建客户端 `help-layout.tsx`：组合侧边栏与内容，使用 `IntersectionObserver` 追踪当前章节，处理响应式（桌面左右分栏 / 移动端抽屉）
8. 创建 `app/help/page.tsx`：保持轻量页面入口，渲染客户端 HelpLayout

### Phase 3: 导航集成（依赖 Phase 2）

9. 修改 `app-shell.tsx`：在 ThemeToggle 旁新增 `HelpCircle` 图标按钮，链接到 `/help`
10. 修改 `app-shell.tsx` 的 `isPublicRoute`，确保 `/help` 在未登录态下不被重定向到登录页
11. 更新 `app-shell-auth.test.tsx`，覆盖 `/help` 公开访问和登录后帮助入口

### Phase 4: 验证

12. 新增 `help-page.test.tsx`，验证帮助页内容、目录链接和移动端目录按钮
13. 运行 `cd frontend && npm run lint`
14. 运行 `cd frontend && npm test`
15. 运行 `cd frontend && npm run build`
16. 运行 `python scripts/validate_agents_docs.py --level ERROR`
17. 手动验证：切换语言后帮助文案同步切换
18. 手动验证：暗黑模式下目录高亮与内容可读性
19. 手动验证：移动端目录抽屉可正常打开/关闭
20. 手动验证：目录点击后页面平滑滚动到对应锚点

## Decisions to Track

| 决策 | 记录 |
|------|------|
| 内容渲染方式 | 使用 TSX 组件 + i18n 字典，而非 MDX。原因：项目无 MDX 依赖，且现有所有用户文案均走 i18n，保持一致性 |
| 路由公开性 | `/help` 设为公开路由，未登录用户可访问，降低了解门槛 |
| 搜索功能 | 第一期不实现，降低复杂度；后续若内容膨胀再考虑 |
| 目录数据来源 | 集中放在 `lib/help-data.ts`，与 i18n key 一一对应，便于维护 |
| 客户端边界 | `IntersectionObserver`、Sheet 打开状态和当前激活章节放在 `HelpLayout` 客户端组件；`app/help/page.tsx` 只做路由入口 |
| 测试范围 | 前端测试覆盖公共路由和主要帮助页面结构；滚动高亮和视觉细节通过 lint/build + 手动检查验证 |

## Progress

- [x] 读取 `AGENTS.md`、`WORKFLOW.md`、`docs/EXECUTION_GATES.md`、前端 AGENTS、spec、design 和核心治理文档
- [x] 创建隔离 worktree：`D:\Github\skilldrive\.worktrees\help-center`，分支 `codex/help-center`
- [x] 安装前端依赖：`cd frontend && npm install`
- [x] 基线验证：`cd frontend && npm run lint` 通过
- [x] 基线验证：`cd frontend && npm test` 通过（14 files / 70 tests）
- [x] 计划审阅并补充客户端边界、测试和文档索引维护
- [x] Phase 1: 基础结构与类型
- [x] Phase 2: 页面与布局
- [x] Phase 3: 导航集成
- [x] Phase 4: 验证与归档

## Outcome

- 新增 `/help` 路由，提供中英双语帮助中心内容、左侧目录、锚点跳转、滚动激活状态和移动端目录抽屉。
- AppShell 顶部工具区新增帮助中心图标入口，链接到 `/help`。
- `/help` 纳入公开路由，未登录用户可直接访问。
- 新增前端测试覆盖公开访问、帮助入口、帮助页内容、目录链接和移动端目录抽屉。
- 更新 product spec 与 design docs 索引，使新增文档可发现。
- 根据中文可读性反馈润色帮助中心中文文案，降低说明书腔和术语密度。

## Validation

- Baseline `cd frontend && npm run lint`：通过
- Baseline `cd frontend && npm test`：通过（14 files / 70 tests）
- Final `cd frontend && npm run lint`：通过
- Final `cd frontend && npm test`：通过（15 files / 73 tests）
- Final `cd frontend && npm run build`：通过，构建输出包含 `/help`
- Final `python scripts/validate_agents_docs.py --level ERROR`：通过（0 errors / 0 warnings）
- Browser check `http://localhost:3010/help`：页面返回 200，DOM 包含帮助中心、帮助目录和 `SkillDrive 是什么`
- Browser check：点击目录 `SkillDrive 是什么` 后 URL 更新为 `/help#what-is-skilldrive`
- 自动测试：移动端目录抽屉可打开并显示帮助目录
- 自动/构建验证：帮助文案来自 i18n 字典，随 Provider 字典切换
- 未完成的手动视觉项：浏览器插件截图命令超时，未保留截图；暗黑模式视觉只通过语义 token 用法和 build/lint 间接验证
