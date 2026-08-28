# 桌面客户端边栏收起按钮执行计划

状态: Completed
更新日期: 2026-08-28
规格: `docs/product-specs/2026-08-28-desktop-sidebar-collapse-toggle.md`

## 目的 / 总览

为桌面客户端 AppShell 左侧边栏增加一个悬停可见的手动收起/展开切换按钮，支持 localStorage 持久化，窄屏不显示以避免与现有响应式 auto-collapse 冲突。复用现有 4.5rem icon-rail 视觉样式，保证收起态与窄屏自动模式像素级一致。

## 进度

- [x] 创建产品规格文档
- [x] 创建执行计划（本文件）
- [x] 实现 i18n 字典与类型
- [x] 实现 AppShell 状态、按钮与 className 切换逻辑
- [x] 实现 styles.css 手动收起样式（`.app-shell--collapsed` 修饰类）
- [x] 新增 / 更新回归测试
- [x] 运行验证门禁并归档

## 涉及文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `desktop-client/src/i18n/messages/types.ts` | 编辑 | 在 `appShell` 内新增 `collapseSidebar` / `expandSidebar` 字符串字段 |
| `desktop-client/src/i18n/messages/zh-CN.ts` | 编辑 | 添加中文文案："收起边栏"、"展开边栏" |
| `desktop-client/src/i18n/messages/en-US.ts` | 编辑 | 添加英文文案："Collapse sidebar"、"Expand sidebar" |
| `desktop-client/src/components/app-shell.tsx` | 编辑 | 新增 `collapsed` state（useState lazy init + useEffect 写 localStorage）、toggle 处理器、ChevronsLeft/ChevronsRight 切换按钮渲染、`app-shell--collapsed` 条件 class 到 `<main>` |
| `desktop-client/src/styles.css` | 编辑 | 新增手动收起修饰类 `.app-shell--collapsed` 下的 grid/文字隐藏/居中/drawer-left；新增 `.sidebar-toggle-btn` 绝对定位 + hover 淡入；窄屏 `@media (max-width:1099px)` 内隐藏按钮 |
| `desktop-client/src/__tests__/app.test.tsx` | 编辑 | 新增 `describe("sidebar collapse toggle")` 嵌套块，含 3 个回归用例：默认展开态、点击双向切换+持久化、localStorage 预置还原收起态 |

## 关键实现决策（已记录）

- D-1 图标来源: `lucide-react` 的 `ChevronsLeft` / `ChevronsRight`（与现有 nav 图标体系一致）。
- D-2 修饰类位置: 仅 `<main className="app-shell app-shell--collapsed">` 根节点，后代选择器覆盖子元素。
- D-3 窄屏抑制: CSS-only 方案 `@media (max-width: 1099px) { .sidebar-toggle-btn { display: none; } }`，媒体查询内原有的 icon-rail 规则按正常 CSS 级联优先于修饰类覆盖。
- D-4 localStorage 键名: `skilldrive:sidebarCollapsed`（命名空间前缀）。

## 验证结果

```bash
# Tests (desktop-client)
Test Files  38 passed (38)
Tests       231 passed (231)    # 含 3 个新增回归用例

# Build (desktop-client)
npm run build          → exit 0；vite render + electron main + preload 全部成功
npm run typecheck:electron → tsc -p tsconfig.node.json --noEmit exit 0

# Repo docs gate
python scripts/validate_agents_docs.py --level ERROR → 0 个错误, 11 个警告
```

## 完成后跟进

- 建议启动 `npm run start:electron` 做一次手动 QA：收起/展开点击、刷新持久化、窗口缩窄至 <1100px 按钮隐藏。
- 若后续桌面端引入全局偏好存储层，可将 `localStorage.skilldrive:sidebarCollapsed` 迁移到统一配置 schema 中。
