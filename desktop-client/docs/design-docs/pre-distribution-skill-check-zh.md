# 分发前 Skill 检查 - 最终技术设计

状态：最终设计，可供实现交付
最后更新：2026-04-26
范围：`desktop-client/`

> 在用户把 pending skill 分发到本地 agent 目录之前，桌面端先只读检查目标目录中是否已经存在同名 skill、已安装版本是什么、这次分发是否可能造成降级。检查结果用于辅助审批，不写入 agent 目录，也不写入 State DB。

## 1. 问题陈述

当前分发路径中，用户点击 `Distribute` 后，`distribution-service` 会把已下载并校验的 skill package 安装到所有已配置的 agent 目标目录。现有审核列表只显示远端版本和本地 State DB 中的 `localRecords` 版本，不读取 agent 目录的真实状态。

这会产生三个问题：

1. **目录真实状态不可见**：如果用户手动修改过 agent skills 目录，UI 审批时看不到实际已安装版本。
2. **潜在降级不可见**：如果 agent 目录里的同名 skill 版本高于远端 pending 版本，当前分发会覆盖为远端版本，但 UI 没有提前提示。
3. **State DB 与文件系统不一致时缺少解释**：`localRecords` 只是桌面端上次成功分发后的快照，不一定等于 agent 目录当前内容。

本设计增加一个只读的 pre-distribution check。它读取已配置 agent 目标目录中的同名 skill 元数据，并把结果显示在 Home/Updates 的审核队列中，帮助用户在点击分发前看到真实目标状态。

## 2. 非目标

- 不自动解决版本冲突。
- 不做 skill 内容 diff、合并或回滚。
- 不改变 `DesktopSyncState` 的持久化 schema。
- 不把检查结果持久化到 SQLite、JSON config 或 agent 目录。
- 不让 renderer 直接访问 Node、Electron 或文件系统 API。
- 不改变分发写入策略；用户仍可在看到警告后继续分发。

## 3. 当前代码事实

这些事实来自当前实现，编码时必须保持一致：

- `DesktopSyncState` 只持久化 `localRecords`、`pendingUpdates`、`successfulDistributionCount` 和 `lastRefreshedAt`。
- `PendingSyncUpdate.remoteVersion` 是非空 `string`。远端版本为 `null` 时，`compareRemoteSkills()` 不会创建 pending update。
- `sync-service.refresh()` 的职责是读取远端列表、比较 `localRecords`、写入 sync snapshot；它不应该读取 agent 文件系统。
- renderer 只能通过 `src/lib/ipc-client.ts` -> `electron/preload.ts` -> `electron/ipc.ts` 调用 main process。
- agent 目录约定属于 `src/adapters/agents/`；sync 和 UI 不应硬编码 Codex、Claude Code、Gemini CLI 的路径规则。
- 当前"enabled agents"实际等价于 runtime config 中已解析到 `skillsPath` 的 supported agents。未配置路径的 agent 不参与分发，也不应该在 pre-check 中显示错误。

## 4. 最终架构决策

Pre-check 放在 **main process orchestration + core pre-check service + agent adapter metadata reader** 这条路径中。

```
Renderer review refresh
  -> desktopClient.refreshSync()
  -> desktopClient.refreshPreDistributionCheck()
  -> render sync state + transient pre-check snapshot

Renderer manual "Refresh Check"
  -> desktopClient.refreshPreDistributionCheck()
  -> render updated transient pre-check snapshot

Main process
  -> 从 StateStore 读取当前 pending updates
  -> 从 runtime config 解析已配置的 agent 安装上下文
  -> 调用 pre-check service
  -> pre-check service 调用 adapter.readInstalledSkillMetadata(...)
  -> 通过 IPC 返回可序列化的快照
```

重要边界：

- `sync-service` 保持为远端/本地快照比较服务。
- `distribution-service` 保持为 agent 目录的唯一写入者。
- `pre-distribution-check-service` 只读元数据，没有持久化副作用。
- Renderer 将返回的快照仅存储在 React 状态中。

## 5. 触发规则

| 场景 | 行为 |
| --- | --- |
| 应用初始加载且已配置 token | 刷新 sync state，如果 `pendingUpdates.length > 0` 则运行 pre-check。 |
| 用户点击现有队列刷新 | 刷新 sync state，如果有 pending updates 则运行 pre-check。 |
| 用户点击新的 `Refresh Check` 操作 | 针对当前持久化的 pending updates 重新运行 pre-check，不调用远端 API。 |
| 分发成功或部分成功 | 刷新 sync state，如果仍有 pending updates 则重新运行 pre-check。 |
| 没有 pending updates | 清除 renderer 持有的 pre-check 快照，跳过文件系统检查。 |
| 后台轮询发现 pending updates | 可以像今天一样更新 tray state；当 renderer 刷新审核状态时运行 UI 可见的 pre-check。 |

这在保持现有轮询模型的同时，确保用户在从该表面分发前，可见的审核界面有最新的检查信息。

## 6. 目标 Agent 集合

Pre-check 使用与分发相同的有效目标集合：

1. 从 `listAgentAdapters()` 开始。
2. 只保留 `getRuntimeConfig().agentSkillsPaths[agentId]` 有值的 agent ID。
3. 为每个已配置的目标构建 `{ adapter, installContext: { skillsPath } }`。

规则：

- 未配置的受支持 agent 会被省略，不标记为错误。
- 如果没有配置任何 agent 目标，返回空结果加上全局警告。分发已经用明确的错误处理这种情况。
- 如果已配置的 `skillsPath` 不存在，将该 skill 视为 `not-installed`；分发可以稍后创建目录。
- 如果 `skillsPath` 存在但无法读取，将该 agent 结果标记为 `error`。

## 7. Adapter 元数据合约

为 `AgentAdapterV1` 添加一个只读元数据方法：

类型所有权调整：

- 将 `AgentId` 从 `src/adapters/agents/base.ts` 移动到 `src/types/index.ts`。
- 在 `src/types/index.ts` 中定义 `InstalledSkillVersionSource` 和 `InstalledSkillMetadataV1`。
- `src/adapters/agents/base.ts` 应该通过 `import type` 导入这些共享类型，然后暴露下面的方法。

```typescript
export type AgentId = "codex" | "claude-code" | "gemini-cli"

export type InstalledSkillVersionSource =
  | "skill-frontmatter"
  | "manifest-json"
  | "nested-manifest-json"
  | null

export interface InstalledSkillMetadataV1 {
  exists: boolean
  skillDir: string
  version: string | null
  versionSource: InstalledSkillVersionSource
}

export interface AgentAdapterV1 {
  id: AgentId
  displayName: string
  installSkill(payload: ExtractedSkillPayloadV1, context: AgentInstallContextV1): Promise<InstalledSkillV1>
  verifyInstalledSkill(payload: ExtractedSkillPayloadV1, installed: InstalledSkillV1): Promise<boolean>
  readInstalledSkillMetadata(skillId: string, context: AgentInstallContextV1): Promise<InstalledSkillMetadataV1>
}
```

默认文件系统 adapter 行为：

1. 使用与安装相同的路径安全规则对 `skillId` 进行归一化和验证。
2. 解析 `skillDir = join(context.skillsPath, safeSkillId)`。
3. 如果 `skillDir` 不存在，返回 `exists: false`，`version: null`。
4. 如果 `skillDir` 不是目录，抛出错误。
5. 按以下优先级顺序读取版本元数据：
   - `SKILL.md` frontmatter 字段 `version`
   - 根目录 `manifest.json` 字段 `version`
   - `skills/manifest.json` 字段 `version`，作为当前 package/test 布局的兼容性回退
6. 将空字符串修剪为 `null`。

格式错误的元数据文件本身不会导致检查失败。读取器应在可能时继续尝试下一个来源；如果没有支持的来源能产生非空版本，返回 `version: null`。

Adapter 拥有这个元数据读取，因为未来的 agent 集成可能不使用默认的文件系统布局。

## 8. 版本解析与比较

使用小型严格解析器，不引入新依赖。

支持的格式：

- `major.minor.patch`
- 可选的前导 `v`
- 仅数字标识符

不支持的示例返回 `unknown`：

- `1.0`
- `1.0.0-alpha.1`
- `1.0.0+build.1`
- `latest`
- `2026-04-26`
- 空字符串

比较结果枚举：

```typescript
export type PreDistributionVersionComparison =
  | "not-installed"
  | "installed-older"
  | "same"
  | "installed-newer"
  | "unknown"
  | "error"
```

规则：

| 条件 | 结果 | 含义 |
| --- | --- | --- |
| `exists === false` | `not-installed` | 此目标的新安装。 |
| 元数据读取抛出 | `error` | 此目标的检查失败。 |
| 已安装或远端版本不是严格 semver | `unknown` | 显示版本但不声明顺序。 |
| 已安装 > 远端 | `installed-newer` | 分发可能对此目标降级。 |
| 已安装 < 远端 | `installed-older` | 正常升级。 |
| 已安装 === 远端 | `same` | 幂等覆盖。 |

## 9. 临时数据合约

在 `src/types/index.ts` 中添加共享可序列化类型。这些是 IPC/renderer 类型，不会被持久化。

```typescript
export type AgentId = "codex" | "claude-code" | "gemini-cli"

export type InstalledSkillVersionSource =
  | "skill-frontmatter"
  | "manifest-json"
  | "nested-manifest-json"
  | null

export interface InstalledSkillMetadataV1 {
  exists: boolean
  skillDir: string
  version: string | null
  versionSource: InstalledSkillVersionSource
}

export type PreDistributionVersionFormat = "semver" | "unknown"

export type PreDistributionVersionComparison =
  | "not-installed"
  | "installed-older"
  | "same"
  | "installed-newer"
  | "unknown"
  | "error"

export interface AgentPreDistributionCheckResult {
  agentId: AgentId
  displayName: string
  skillDir: string | null
  exists: boolean
  installedVersion: string | null
  installedVersionSource: InstalledSkillVersionSource
  remoteVersion: string
  installedVersionFormat: PreDistributionVersionFormat
  remoteVersionFormat: PreDistributionVersionFormat
  versionComparison: PreDistributionVersionComparison
  checkedAt: string
  durationMs: number
  errorCode: string | null
  errorMessage: string | null
}

export type PreDistributionCheckResults = Record<
  string,
  Partial<Record<AgentId, AgentPreDistributionCheckResult>>
>

export interface PreDistributionCheckSnapshot {
  results: PreDistributionCheckResults
  checkedAt: string
  expiresAt: string
  pendingUpdateFingerprint: string
  targetAgentIds: AgentId[]
  totalDurationMs: number
  globalErrors: string[]
}
```

`pendingUpdateFingerprint` 是基于排序后的 `remoteSkillId@remoteVersion` 对构建的稳定字符串。当当前 pending update 列表的指纹不同时，Renderer 必须丢弃快照。

## 10. IPC 合约

保持 `sync:refresh` 专注于 sync state。添加一个新的 IPC 通道：

```typescript
desktopClientIpcChannels = {
  // 已有
  refreshSync: "sync:refresh",
  distributePendingUpdate: "distribution:run",

  // 新增
  refreshPreDistributionCheck: "pre-distribution-check:refresh"
}
```

Bridge 方法：

```typescript
interface DesktopClientBridge {
  refreshSync(): Promise<DesktopSyncState>
  refreshPreDistributionCheck(): Promise<PreDistributionCheckSnapshot>
}
```

Renderer 不会将 `pendingUpdates` 传递给 main process。main handler 从 `StateStore` 读取当前 `DesktopSyncState`，然后检查那些 pending updates。这避免了过时或被篡改的 renderer 输入。

全局 handler 行为：

- 如果 `stateStore` 不可用，抛出错误。
- 如果没有 pending updates，返回带有当前指纹的空快照。
- 如果没有配置任何 agent 目标，返回空结果加上全局警告。
- 每个 agent 的失败保留在 `AgentPreDistributionCheckResult` 内；除非 handler 本身无法运行，否则不应使整个 IPC 调用失败。

## 11. UI 行为

预检查结果必须在任何可以启动分发的地方可见。

需要的 UI 变更：

- 将 `PreDistributionCheckSnapshot | null` 传入 `HomeView`、`UpdatesView` 和 `PendingUpdatesPanel`。
- Home pending 预览在 `Distribute` 按钮前显示紧凑的 per-skill 目标摘要。
- Updates 完整列表显示每个 pending update 的每个已配置 agent 结果。
- 在完整 pending updates 面板添加 `Refresh Check` 按钮。
- 检查运行时显示 loading 文本。
- 如果快照指纹与当前 pending updates 不匹配，显示需要刷新/过期的提示，不显示旧的 per-agent 声明。
- 当 pre-check 为 `unknown` 或 `error` 时，分发仍然启用，但警告文本必须在操作旁边可见。

建议的 per-agent 标签：

| `versionComparison` | UI 色调 | 文案意图 |
| --- | --- | --- |
| `not-installed` | 中性/成功 | 此目标未安装。 |
| `installed-older` | 成功 | 已安装版本比远端旧；分发将升级它。 |
| `same` | 中性 | 版本相同；分发是幂等覆盖。 |
| `installed-newer` | 警告 | 已安装版本更新；分发可能降级它。 |
| `unknown` | 警告/中性 | 无法确定版本顺序。 |
| `error` | 警告/错误 | 检查失败；分发仍然是用户的选择。 |

Skill 的 `Last checked` 使用该 skill 的 agent 结果中最早的 `checkedAt`。快照在 `expiresAt` 后过期。

## 12. 错误与安全规则

Pre-check 是信息性的，但它不能削弱现有的 fail-closed 分发规则。

- 不安全的 skill 标识符仍然在任何路径连接前失败验证。
- Renderer 永远不会接收特权的文件系统访问。
- Pre-check 只读取已配置的 agent `skillsPath` 加上已验证的 skill 目录名称。
- 如果已配置的路径不可读，为该 agent 目标返回 `error` 结果。
- 如果所有元数据来源都缺失或格式错误，返回 `unknown`；除非读取本身意外失败，否则不抛出。
- 不要记录包内容、API token 或完整文件内容。
- Pre-check 失败不会阻止分发，因为它不是安全门；实际的包验证、路径验证和安装验证仍然发生在分发路径中。

## 13. 实现文件映射

创建：

| 文件 | 职责 |
| --- | --- |
| `src/core/pre-distribution-check/version-compare.ts` | 严格 semver 解析器和比较助手。 |
| `src/core/pre-distribution-check/pre-distribution-check-service.ts` | 遍历 pending updates 和已配置的 agents，应用超时/并发，构建快照。 |
| `src/core/pre-distribution-check/pre-distribution-check-config.ts` | 超时、并发和快照 TTL 的默认值。 |
| `src/__tests__/version-compare.test.ts` | 版本解析/比较覆盖。 |
| `src/__tests__/pre-distribution-check-service.test.ts` | 服务行为、错误、超时、空目标集合。 |

修改：

| 文件 | 变更 |
| --- | --- |
| `src/types/index.ts` | 移动/添加 `AgentId`，添加已安装元数据类型，添加临时 pre-check IPC/renderer 类型。 |
| `src/adapters/agents/base.ts` | 导入共享 agent 类型，添加 `readInstalledSkillMetadata()`，复用/导出安全 skill 目录名验证。 |
| `src/__tests__/agent-adapters.test.ts` | 覆盖 SKILL.md、根 manifest、嵌套 manifest、缺失目录、无效 skill ID。 |
| `electron/ipc.ts` | 添加 `pre-distribution-check:refresh` 通道、bridge 合约、handler 注册。 |
| `electron/preload.ts` | 暴露 `refreshPreDistributionCheck()`。 |
| `src/lib/ipc-client.ts` | 添加包装器方法和 bridge 类型。 |
| `electron/main.ts` | 将新 handler 连接到 `stateStore`、runtime config 和 adapters。 |
| `src/app/App.tsx` | 管理 pre-check 快照/加载/过期状态，在同步/分发后刷新。 |
| `src/components/home-view.tsx` | 在 Home 分发操作前显示紧凑的 per-skill pre-check 摘要。 |
| `src/components/updates-view.tsx` | 传递 pre-check props。 |
| `src/components/pending-updates-panel.tsx` | 显示详细的 per-agent 结果和 `Refresh Check`。 |
| `src/i18n/messages/*` | 添加检查状态的中英文 UI 文案。 |
| `src/__tests__/app.test.tsx` | 覆盖 bridge 方法、刷新后自动检查、过期快照处理、刷新按钮。 |

## 14. 性能规则

默认值：

| 设置 | 值 |
| --- | --- |
| 每个目标超时 | 5 秒 |
| 总超时 | 15 秒 |
| 最大并发目标检查 | 2 |
| 快照 TTL | 当前 `pollIntervalMs` |

并发模型：

- 一个全局信号量，由所有 `pendingUpdate x agent` 检查共享。
- 总超时时保留已完成的结果。
- 将未完成的检查标记为 `error`，`errorCode = "TIMEOUT"`。

## 15. 测试策略

单元测试：

- 严格 semver 解析和比较
- 可选的 `v` 前缀
- 不支持的 prerelease/build/custom/date/tag 格式
- `not-installed`、`installed-older`、`same`、`installed-newer`、`unknown`、`error`
- SKILL.md frontmatter 解析优先级
- manifest 回退优先级
- 无效 skill ID 路径安全

服务测试：

- 没有 pending updates 返回空快照
- 没有已配置的目标 agents 返回全局警告
- 缺失 `skillsPath` 目录产生 `not-installed`
- 不可读路径或 adapter 抛出产生 per-agent `error`
- pending IDs 或版本变化时指纹变化
- 超时保留已完成的结果

Renderer 测试：

- 初始刷新运行 sync 然后在有 pending updates 时运行 pre-check
- 没有 pending updates 时清除快照
- Home 和 Updates 表面在指纹不匹配时不显示旧声明
- `Refresh Check` 只重新运行 pre-check
- 分发刷新 sync state 然后对剩余 pending updates 运行 pre-check

验证命令：

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
```

## 16. 迁移与文档

不需要持久化迁移。

实现后，更新：

- 如果新的 pre-check service 成为持久模块，更新 `desktop-client/docs/ARCHITECTURE.md`。
- 在 `desktop-client/docs/references/runtime-and-storage-surface.md` 中列出新的 IPC 通道。
- 只有在添加超出本设计规则的新路径或 symlink 行为时，才更新 `desktop-client/docs/SECURITY.md`。

编码前，在 `desktop-client/docs/exec-plans/active/` 下使用本设计作为已批准的技术源创建 active ExecPlan。

## 17. 早期草案的已解决问题

- 将 pre-check 从 `sync-service.refresh()` 移出，以保持 sync 边界。
- 移除了 pending update 处理中可空的 `remoteVersion`，因为当前 `PendingSyncUpdate.remoteVersion` 是非空的。
- 用明确的 `not-installed` 替换了缺失安装的模糊 `older` 结果。
- 澄清未配置的 agent 会被省略，而不是显示为错误。
- 添加了安全的 IPC 流，其中 main 读取 `StateStore`；renderer 不提交 pending updates 进行文件系统检查。
- 添加了基于指纹的过期检测，这样旧结果不能显示给变化的队列。
- 要求 Home 和 Updates 都显示检查上下文，因为这两个表面都可以启动分发。

## 18. 参考资料

- 核心信念：`core-beliefs.md`
- 产品规格：`../product-specs/2026-04-17-skill-distribution-v1.md`
- 架构：`../ARCHITECTURE.md`
- 安全：`../SECURITY.md`
- Adapter 基础：`../../src/adapters/agents/base.ts`
- Sync service：`../../src/core/sync/sync-service.ts`
- Distribution service：`../../src/core/distribution/distribution-service.ts`
- IPC 合约：`../../electron/ipc.ts`
