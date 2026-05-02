# API Token Configuration UI

状态：已完成

## 概述

为桌面客户端添加用户友好的 API Token 配置界面，实现完整的 IPC 桥接、状态管理和 UI 组件。

## 实现清单

### Phase 1: Runtime 配置基础设施

- [x] 创建 runtime config manager - 统一读取 JSON URL 配置、secret-store token、bootstrap 状态
- [x] 将 API Base URL 持久化到 `config/config.json`，不要写入 State DB
- [x] 调整 sync/download 调用路径，确保保存或清除配置后主进程立即使用最新 runtime config
- [x] 保存配置后重启 polling 并刷新 review state；清除配置后停止 polling

### Phase 2: IPC 基础设施

- [x] 保留现有 `sync:refresh` 和 `distribution:run` channel 名称
- [x] 扩展 `electron/ipc.ts` - 添加新 channels
- [x] 实现 `electron/main.ts` handlers - getConfiguration, saveConfiguration, clearConfiguration, testConnection
- [x] 扩展 `electron/preload.ts` bridge - 添加新方法
- [x] 扩展 `src/lib/ipc-client.ts` - 添加类型和方法
- [x] `getConfiguration` 返回脱敏状态：hasToken、tokenSource、persistedEnvironmentToken、secretStoreAvailable、warning

### Phase 3: UI 组件

- [x] 创建 `src/components/config-panel.tsx` - 配置表单
- [x] 创建 `src/components/config-status.tsx` - 状态指示器
- [x] 修改 `src/components/settings-panel.tsx` - 添加编辑按钮
- [x] 修改 `src/components/nav-shell.tsx` - 支持配置模式渲染

### Phase 4: 状态管理

- [x] 扩展 `src/app/App.tsx` - 添加配置状态
- [x] 实现配置模式路由逻辑
- [x] 实现保存后刷新 review state 的流程
- [x] 实现连接测试流程：调用 `GET /api/v1/client/skills?limit=1` 验证 URL 与 token

### Phase 5: 完善

- [x] 添加验证反馈（URL 格式、Token 为空）
- [x] 添加成功/错误通知
- [x] 添加键盘快捷键（Enter 保存）
- [x] 测试 keytar 成功路径、keytar 不可用 fallback、环境变量首次导入路径

## 进度追踪

| 阶段 | 状态 | 备注 |
|------|------|------|
| Phase 1 | 已完成 | Runtime config manager 已接管 JSON URL、secret-store token 与 runtime reload |
| Phase 2 | 已完成 | 新增配置 IPC，同时保留 sync/distribution 既有 channel |
| Phase 3 | 已完成 | 配置表单、状态指示器、Settings 与 NavShell 已接入 |
| Phase 4 | 已完成 | 无 token 进入配置模式，保存后刷新 review state，测试连接使用 authenticated client API |
| Phase 5 | 已完成 | 验证反馈、活动通知、Enter 保存、配置存储测试已补齐 |

## 已决策规则

### 连接测试是否强制？

| 选项 | 说明 |
|------|------|
| A: 测试失败阻止保存 | 强制在线验证 |
| B: 允许离线配置 | 已采用，用户可能稍后启动服务器 |

**决策**：选项 B。连接测试失败不阻止保存，但 UI 必须显示明确错误。
连接测试必须调用已认证的 client-oriented API，当前使用
`GET /api/v1/client/skills?limit=1`。

### 环境变量来源是否显示？

如果 Token 来自 `SKILLDRIVE_API_TOKEN`，是否在 UI 显示来源？

**决策**：Yes，显示"Token from environment"或"Token imported from
environment"指示器。该状态来自 `resolveApiTokenBootstrap()` 的脱敏结果。

### 清除操作范围

| 选项 | 清除内容 |
|------|---------|
| A: 仅清除 Token | URL 保留 |
| B: Token + URL | 已采用，完全重置 |

**决策**：选项 B。清除操作清除 keytar token，并将 JSON URL 配置重置为默认值。

### URL 存储位置

**决策**：API Base URL 使用 `src/core/storage/config-store.ts` 写入
`config/config.json`。State DB 继续只保存同步快照，不为 URL 配置扩 schema。

### Runtime 配置刷新

**决策**：保存或清除配置后必须刷新主进程内存中的 runtime config。实现可使用
runtime config manager，或在 handler 中重建依赖该配置的 sync/package 服务；无论采用哪种方式，验收标准都是无需重启应用即可使用新配置。

### 是否新增 `/api/v1/health`

**决策**：不新增专用 `/api/v1/health` 端点。连接测试复用现有的
`GET /api/v1/client/skills?limit=1`，根路径 `/health` 仅作为运维健康检查。

## 相关文档

- 产品规格：`docs/product-specs/2026-04-23-api-token-config.md`
- 技术设计：`docs/design-docs/api-token-config-technical.md`
- 安全规则：`docs/SECURITY.md`
- 设计信念：`docs/design-docs/core-beliefs.md`

## 验收标准

- [x] 用户可在桌面 UI 完成配置，无需终端
- [x] Token 存储在系统凭证存储（所有平台）
- [x] 连接测试有明确反馈
- [x] Settings 面板正确显示状态
- [x] Token 保存后不暴露给渲染进程
- [x] 保存或清除配置后无需重启应用即可影响 refresh/download 行为
- [x] URL 存储在 JSON config store，Token 只存储在 keytar
- [x] 测试通过：`npm run typecheck:electron`
- [x] 测试通过：`npm test`
- [x] 测试通过：`npm run build`

## 实现结果

- `src/core/runtime/runtime-config-manager.ts` 统一管理 API Base URL、Token bootstrap 状态、poll/cache/agent runtime config。
- `electron/main.ts` 的 sync/download/distribution 路径每次读取最新 runtime config，保存后重启 polling，清除后停止 polling。
- `electron/ipc.ts`、`electron/preload.ts`、`src/lib/ipc-client.ts` 暴露配置读取、保存、清除、连接测试方法；renderer 只接收脱敏状态。
- `src/app/App.tsx`、`src/components/config-panel.tsx`、`src/components/config-status.tsx` 支持首次配置、保存后刷新、连接测试和 Settings 状态展示。
