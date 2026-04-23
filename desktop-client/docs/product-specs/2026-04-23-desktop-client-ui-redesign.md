# Desktop Client UI Redesign

> 状态：产品规格文档

## 目标

重新设计 desktop-client 的用户界面，让客户端首页简洁、重点功能突出，并与服务端 Web console 的视觉风格保持一致。

本次重设计不改变 Electron IPC、runtime config、sync、download、distribution 或 secret-store 行为。它只调整 renderer 的信息架构、视觉系统和组件组织。

## 问题背景

当前 desktop-client 界面存在两个主要问题：

| 问题 | 影响 |
|------|------|
| 视觉风格与服务端界面不统一 | 用户在 Web console 与桌面客户端之间切换时感知割裂 |
| 所有功能集中在同一界面 | 首页同时承载概览、待审核更新、代理目标、配置、活动日志，显得复杂拥挤 |

服务端 Web console 当前使用浅色为主的 console 风格：顶部品牌栏、简洁导航、页面介绍、卡片、按钮和 muted 状态文本。desktop-client 应靠近这个体验，而不是继续保持独立的深色侧栏仪表盘风格。

## 首页主任务

首页只突出一个核心任务：**待审核更新**。

用户打开 desktop-client 后，应能快速回答：

1. 当前是否已连接并完成同步？
2. 是否有待审核更新？
3. 如果有，最重要的几个更新是什么？
4. 下一步应该刷新、查看全部，还是分发更新？

首页保留：

- 同步与连接状态摘要
- 待审核更新数量
- 最多前 3 个待审核更新
- 刷新入口
- 进入完整 Updates 视图的入口

首页不再常驻：

- API Token 配置表单
- 代理目标详情
- 完整活动日志
- 完整待审核列表

## 信息架构

### Home

Home 是客户端默认首页。

它展示轻量摘要和前 3 个待审核项。没有待审核更新时，首页显示空状态和刷新入口。无 API Token 时，首页显示配置引导，并引导用户打开 Settings 抽屉完成配置。

### Updates

Updates 是完整待审核列表视图。

它承载所有 pending updates、版本差异、review reason 和 distribute 操作。现有 review-first 行为保持不变：没有用户明确点击分发前，不写入任何 agent skills 目录。

### Settings 抽屉

Settings 抽屉承载低频但必要的操作：

- API Base URL 与 API Token 配置
- 连接测试
- 代理目标状态
- Bridge 状态
- 最近活动日志

抽屉从顶部栏或首页配置引导打开。配置保存后仍应刷新 review state；清除配置后暂停同步并回到配置引导。

## 视觉统一策略

本次采用“轻量复刻”服务端风格：

- 不引入完整 Tailwind、shadcn 或 lucide 依赖
- 在 desktop-client 内新增轻量 design tokens 和基础 UI primitives
- 使用浅色 console 基调，保留 dark mode 作为后续能力而非本次要求
- 对齐服务端的层级语言：顶部品牌栏、页面标题区、卡片、按钮、badge、muted 文本
- 避免继续扩大 inline style；新 UI 应优先复用本地样式类和小组件

目标不是像素级复制服务端，而是在同一产品语言下呈现一个更轻、更本地化的桌面体验。

## 范围

本次包含：

- 重构 desktop-client renderer 信息架构
- 新增或调整本地 UI primitives 和样式 tokens
- 简化首页
- 将配置、代理目标、活动日志迁入 Settings 抽屉
- 增加完整 Updates 视图
- 更新对应测试和桌面文档

## 非范围

本次不包含：

- 改动后端 API
- 改动 Electron IPC contract
- 改动 API Token 保存、清除、连接测试语义
- 改动 sync、download、distribution core service 行为
- 引入 Tailwind、shadcn、lucide 或服务端前端依赖
- 新增登录、OAuth、多账户能力

## 成功标准

用户能做到这些就算成功：

1. 打开 desktop-client 后，首页一眼能看出是否有待审核更新。
2. 首页不再同时展示配置、代理、活动日志和完整列表。
3. desktop-client 与服务端 Web console 在颜色、卡片、按钮、字体层级和导航结构上保持一致感。
4. API 配置仍然可发现，并能通过 Settings 抽屉完成。
5. 完整待审核列表和分发流程仍然可用。
6. 原有 refresh、save configuration、clear configuration、test connection、distribute flows 行为不变。
7. `npm run typecheck:electron`、`npm test`、`npm run build` 通过。

## 相关文档

- 执行计划：`docs/exec-plans/active/2026-04-23-desktop-client-ui-redesign.md`
- 架构文档：`docs/ARCHITECTURE.md`
- 设计规则：`docs/DESIGN.md`
- 安全规则：`docs/SECURITY.md`
