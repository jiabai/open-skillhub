# Desktop Client UI Redesign

状态：待实现

## 概述

按照产品规格 `docs/product-specs/2026-04-23-desktop-client-ui-redesign.md`，重构 desktop-client renderer 的信息架构和视觉系统。

本计划只覆盖 UI 和 renderer 组织，不改变 Electron IPC、runtime config、sync、download、distribution 或 secret-store 行为。

## 实现原则

- 首页只突出“待审核更新”这一主任务。
- 配置、代理目标、活动日志迁入 Settings 抽屉。
- 完整待审核列表迁入 Updates 视图。
- 使用本地轻量 design tokens 和 UI primitives 对齐服务端 Web console 风格。
- 不引入 Tailwind、shadcn、lucide 或服务端前端依赖。
- 保持 renderer 无特权边界：所有 privileged 行为仍通过 preload 和 typed IPC。

## 实现清单

### Phase 1: 视觉基础

- [ ] 新增 desktop-client renderer 全局样式入口，并在 `src/main.tsx` 引入。
- [ ] 定义本地 design tokens：background、foreground、card、primary、muted、border、destructive、radius、font。
- [ ] 新增轻量 UI primitives：Button、Card、Badge、PageIntro、Drawer 或等价组件。
- [ ] 将新样式基调对齐服务端 Web console：浅色背景、柔和卡片、顶部品牌栏、muted 状态文本。

### Phase 2: App 信息架构

- [ ] 将 `src/app/App.tsx` 的当前单页堆叠改为轻量 view state：Home、Updates、Settings drawer。
- [ ] 保留现有 configuration、refresh、test connection、clear configuration、distribute handlers 的行为。
- [ ] 无 API Token 时，Home 显示配置引导并提供打开 Settings 抽屉的入口。
- [ ] 保存配置后继续刷新 review state；清除配置后继续暂停同步并回到配置引导。

### Phase 3: Home 首页

- [ ] 新增或重构首页组件，展示连接状态、待审核数量、最近刷新时间和主操作。
- [ ] 首页最多展示前 3 个 pending updates。
- [ ] 首页提供“查看全部更新”入口进入 Updates 视图。
- [ ] 首页不常驻渲染代理目标、配置表单、完整活动日志或完整 pending updates 列表。

### Phase 4: Updates 视图

- [ ] 将完整 pending updates 列表迁入 Updates 视图。
- [ ] 保留现有 distribute 操作、busy state、成功/失败反馈。
- [ ] 保持无 pending updates 的空状态可读、轻量、与服务端卡片风格一致。

### Phase 5: Settings 抽屉

- [ ] 将 API 配置、连接测试、配置状态迁入 Settings 抽屉。
- [ ] 将代理目标状态迁入 Settings 抽屉。
- [ ] 将最近活动日志迁入 Settings 抽屉。
- [ ] 顶部栏提供 Settings 入口；无 token 配置引导也能打开该抽屉。

### Phase 6: 测试与文档

- [ ] 更新 `src/__tests__/app.test.tsx`，覆盖新的首页、Updates 视图、Settings 抽屉。
- [ ] 保留并更新配置、刷新、分发成功、刷新失败、部分分发失败测试。
- [ ] 运行 `npm run typecheck:electron`。
- [ ] 运行 `npm test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `python scripts/validate_agents_docs.py --level ERROR`。
- [ ] 如架构或设计说明发生变化，更新 `docs/ARCHITECTURE.md`、`docs/DESIGN.md` 或 `task-tracker.md`。

## 待改模块

主要改动集中在 renderer：

- `src/app/App.tsx`
- `src/components/`
- `src/main.tsx`
- `src/__tests__/app.test.tsx`

不应改动：

- `electron/ipc.ts`
- `electron/main.ts`
- `electron/preload.ts`
- `src/core/sync/`
- `src/core/distribution/`
- `src/core/runtime/`
- `src/core/storage/`

## 组件策略

优先新增本地小组件，而不是继续扩散 inline style。

推荐组件边界：

| 组件 | 责任 |
|------|------|
| AppShell | 顶部品牌栏、Home/Updates 导航、Settings 入口 |
| HomeView | 首页摘要、前 3 个 pending updates、主操作 |
| UpdatesView | 完整 pending updates 列表与分发操作 |
| SettingsDrawer | 配置、代理目标、bridge 状态、活动日志 |
| UI primitives | Button、Card、Badge、PageIntro、Drawer 等基础样式组件 |

现有 `ConfigPanel`、`ConfigStatus`、`AgentsPanel`、`ActivityPanel` 可迁入 Settings 抽屉并逐步替换样式。

## 验收标准

- [ ] 首页只突出待审核更新，不再同屏堆叠所有功能。
- [ ] 首页最多展示前 3 个 pending updates。
- [ ] 完整 pending updates 可在 Updates 视图查看和分发。
- [ ] Settings 抽屉可完成 API 配置、连接测试、清除配置、查看代理目标和活动日志。
- [ ] 视觉风格与服务端 Web console 保持一致感。
- [ ] 不引入 Tailwind、shadcn、lucide 或服务端前端依赖。
- [ ] Electron IPC、runtime config、sync、distribution 行为不变。
- [ ] `npm run typecheck:electron` 通过。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。
- [ ] `python scripts/validate_agents_docs.py --level ERROR` 通过。

## 完成规则

实现完成并验证通过后：

1. 将本文件移动到 `docs/exec-plans/completed/`。
2. 更新 `docs/exec-plans/active/index.md` 和 `docs/exec-plans/completed/index.md`。
3. 更新 `task-tracker.md`，记录 UI redesign 完成状态。
4. 如实施中产生明确后续事项，将其记录到 `docs/exec-plans/tech-debt-tracker.md`。
