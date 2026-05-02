# 桌面端暗黑模式

## 目标

为 SkillDrive 桌面端增加一键浅色/暗黑主题切换，并让暗黑视觉语言与
frontend Web 控制台保持一致。

桌面端仍然是 review-first 的同步工具。暗黑模式用于改善长时间托盘运行
和审核时的视觉舒适度，不改变同步、分发、上传或本地 agent 文件系统行为。

## 范围

- 在桌面端 header 操作区增加可见的主题切换按钮，位置靠近 Refresh 和 Settings。
- 支持两个明确模式：`dark` 与 `light`。
- 对新安装或未保存主题的配置，默认使用 `dark`，与 frontend 的
  `ThemeProvider` 默认值保持一致。
- 将用户选择保存到现有桌面端 JSON config 中，重启后仍然生效。
- 点击切换后立即应用主题。
- 以 frontend 控制台作为视觉对齐来源：
  - `.dark` class 的语义化主题切换
  - 暗色中性背景和 card 表面
  - muted 文本
  - 克制的边框
  - 紧凑的 outline/icon toggle 模式
- 主题状态只作为 renderer-safe 的配置元数据返回，不暴露 token、文件内容或特权能力。
- 为主题切换补充英文和中文文案。

## 非目标

- 不改后端 API。
- 不引入数据库或 SQLite migration。
- v1 不自动跟随操作系统主题。
- v1 不增加 `system` 三态主题选择。
- 不把 Tailwind、shadcn 或 `next-themes` 引入桌面端。
- 除主题 token 覆盖外，不重设计 Home、Updates、Local Skills、Settings 或 dialog。

## frontend 对齐来源

Web 控制台当前使用：

- `frontend/src/components/theme-provider.tsx`
  - `next-themes`
  - `attribute="class"`
  - `defaultTheme="dark"`
- `frontend/src/components/app/theme-toggle.tsx`
  - 一个按钮
  - 在 `dark` 和 `light` 间切换
  - 暗黑模式显示 `Sun`，浅色模式显示 `MoonStar`
- `frontend/src/app/globals.css`
  - `.dark` class 切换 background、foreground、card、muted、border、
    primary、accent、destructive、ring 等语义 token

桌面端应复用行为和语义，不复用 frontend 的依赖栈。

## 用户体验

### Header 操作

Header 操作区增加紧凑主题切换按钮。按钮必须可键盘访问、有可访问标签，
并能表达当前状态或下一步动作。

建议顺序：

```text
Pending badge | Refresh | Theme toggle | Settings
```

### 主题行为

- 首次启动且没有保存主题时，桌面端进入暗黑模式。
- 点击切换按钮后立即切换到另一个模式。
- 选择通过 Electron 主进程保存。
- 重启 app 后使用已保存主题。
- 如果测试或 renderer-only dev 环境中 bridge 不可用，renderer 可以使用默认
  暗黑主题，但涉及持久化配置动作时仍遵循现有 bridge-unavailable 反馈。

### 视觉要求

暗黑模式应与 frontend 控制台一致：

- 暗色中性页面背景
- 略亮的 card 和 drawer 表面
- 低对比但可见的边框
- 可读的 muted 文本
- 高对比 primary action
- destructive、warning、success、accent 状态清晰可见
- 暗色表面上不能残留明亮 cream 面板

浅色模式保持当前桌面端视觉语言。

## 持久化契约

扩展现有桌面端配置状态：

```typescript
type AppTheme = "light" | "dark"

interface ConfigurationState {
  theme: AppTheme
}
```

主题不是 secret，可以与 locale 和 API Base URL 一起保存在 `config/config.json`。

## 验收标准

- 桌面端 header 显示主题切换按钮。
- 一次点击即可切换主题。
- 英文和中文 locale 都有主题切换文案。
- 暗黑模式覆盖 body、header、cards、badges、buttons、drawers、dialogs、
  callouts、inputs、update rows、Local Skills rows 和 pre-distribution summary 状态。
- 主题选择在 runtime reload 和 app restart 后保留。
- `ConfigurationState` 将脱敏后的 active theme 返回 renderer。
- 桌面端不引入 frontend Tailwind、shadcn 或 `next-themes`。
- Renderer 仍不直接访问 Node 或 Electron 特权 API。
- 两种主题下 focus state 都清晰可见。
- 现有桌面端测试和 build 继续通过。

## 验证

实现完成前必须通过：

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

实现后还应在桌面端目标窗口尺寸下手动检查浅色和暗黑模式。
