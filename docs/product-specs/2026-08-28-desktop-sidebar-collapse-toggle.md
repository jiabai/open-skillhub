# 桌面客户端边栏收起/展开按钮

## 背景

桌面客户端（Electron）的 `AppShell` 当前通过 CSS 媒体查询实现了三档响应式布局：
- 宽屏 `>= 1440px`：13.5rem 完整边栏
- 中屏 `1100px–1439px`：13.5rem 完整边栏
- 窄屏 `< 1100px`：自动切换为 4.5rem 纯图标边栏（icon rail）

用户希望在宽/中屏下也能**主动手动收起**边栏以获得更大的内容浏览区域，而不必依赖窗口宽度自动切换。当前缺少这样的手动控制入口。

## 目标

1. 在边栏右上角添加一个「收起 / 展开」切换按钮，鼠标悬停时才显示。
2. 点击「收起」后，边栏从 13.5rem 收窄为 4.5rem 纯图标模式（样式与现有窄屏 auto-collapse 一致）。
3. 点击「展开」后恢复 13.5rem 完整边栏。
4. 收起 / 展开状态通过 `localStorage` 持久化，下次启动自动恢复。
5. 当窗口宽度进入窄屏区间（`< 1100px`）时，不显示手动切换按钮（已有 auto-collapse 接管，避免状态冲突）。

## 非目标（不包含）

- 不修改 Web 控制台（Next.js `frontend/`）的任何布局。
- 不改变现有 `< 1100px` 窄屏的自动响应式行为。
- 不引入可拖拽宽度调节（仅二态切换：完整 / 收起）。
- 不影响桌面客户端 tray、窗口尺寸或启动行为。
- 不新增后端 API、数据模型或安全相关变更。

## 功能需求

### FR-1：切换按钮的可见性与外观
- 按钮位于 `.brand` 区域的右上角（边栏最上方品牌区右侧）。
- 默认状态下按钮透明度极低 / 不可见；鼠标悬停在边栏 `.app-sidebar` 内时，按钮淡入显示。
- 按钮使用轻量浅色背景（与现有 ghost/outline 按钮一致），圆角，无焦点时不抢视觉。
- 按钮图标：
  - 展开态 → 显示 `«`（左双尖括号，表示「收起到左侧」）
  - 收起态 → 显示 `»`（右双尖括号，表示「展开到右侧」）
- 按钮含 `aria-label` 和 `title` 提示当前操作方向。

### FR-2：二态切换行为
- 初始态：读取 `localStorage` 中的 `sidebarCollapsed` 键；若不存在，默认展开（`false`）。
- 点击按钮切换 `collapsed` 布尔状态，并同步写入 `localStorage.sidebarCollapsed`。
- `collapsed = true` 时：
  - `.app-shell` 的 `grid-template-columns` 从 `13.5rem` 收为 `4.5rem`。
  - 隐藏 `.app-nav .btn__label`、`.brand__copy`、`.app-sidebar__footer-copy` 文字（复用现有 `@media (max-width: 1099px)` 同款视觉隐藏样式：`position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%)`）。
  - `.app-sidebar` 内元素水平居中对齐，与窄屏 auto-collapse 保持一致。
  - `.drawer-overlay` 的 `left` 同步改为 `4.5rem`。
- `collapsed = false` 时恢复默认宽屏样式。

### FR-3：窄屏冲突抑制
- 当视口宽度 `<= 1099px` 时，隐藏手动切换按钮（`display: none`）。
- 此时由现有媒体查询接管边栏的 icon-rail 渲染，手动状态暂不生效（避免双源冲突）。
- 当视口从窄屏回到 `>= 1100px` 时，按钮重新显示，并按 `localStorage.sidebarCollapsed` 还原手动状态。

### FR-4：无障碍与可访问性
- 按钮可通过 `Tab` 聚焦，`Enter` / `Space` 触发切换。
- 状态变化通过 `aria-expanded` 属性反映到按钮上（`true` = 展开，`false` = 收起）。
- 收起后导航按钮仍保留 `aria-label` / `title` 属性，屏幕阅读器用户可正常识别每个导航项。

### FR-5：国际化
- 按钮 `title` / `aria-label` 文案需进入 i18n 字典，中英双语：
  - 中文：`"收起边栏"` / `"展开边栏"`
  - 英文：`"Collapse sidebar"` / `"Expand sidebar"`
- 字典位置：`desktop-client/src/i18n/messages/{zh-CN,en-US}.ts`，类型同步到 `types.ts`。

## 非功能需求

- 不引入新的第三方依赖（图标使用 Unicode 字符 `«` / `»` 或 `lucide-react` 现有 `ChevronsLeft` / `ChevronsRight` 图标，优先选现有图标库以保持一致）。
- 状态切换应瞬时完成，不做耗时过渡动画（最多 150ms 轻过渡，避免影响密集操作体验）。
- 所有现有测试通过，新增至少 3 个回归用例覆盖：默认展开态、点击后收起、localStorage 恢复。
- 桌面客户端 `npm run build`、`npm run typecheck:electron` 通过。

## 约束条件

- 仅修改 `desktop-client/` 目录内文件。
- 严格遵循 `desktop-client/docs/DESIGN.md` 中 Visual Language 与 Responsive Review Workspace 规范。
- 手动收起态的视觉表现必须与现有 `< 1099px` 自动 icon-rail 模式像素级一致（同一套布局样式，切换 class 或 media query 等价实现）。

## 验收标准

- [x] 宽/中屏（`>= 1100px`）边栏右上角悬停可看到切换按钮，窄屏不显示。
- [x] 点击按钮后，边栏在 13.5rem ↔ 4.5rem 间切换，文本标签按规则隐藏/显示。
- [x] 切换状态写入 `localStorage.skilldrive:sidebarCollapsed`，刷新页面后保持一致。
- [x] 导航按钮在收起态中 `aria-label` / `title` 仍可读可用。
- [x] 新增 i18n 文案在中英字典中均存在，类型无报错。
- [x] 所有现有测试 + 新增回归测试全部通过（231 tests, 38 suites 全过）。
- [x] `npm run build` 与 `npm run typecheck:electron` 无错误。
