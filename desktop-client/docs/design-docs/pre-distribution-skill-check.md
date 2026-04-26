# Pre-Distribution Skill Check - Technical Design

> 在分发技能到 agent 之前，先检查目标目录是否已存在同名技能及其版本，将结果展示给用户辅助决策。

## Problem Statement

当前分发流程中，`adapter.installSkill()` 直接将技能文件复制到 agent 技能目录，**不做任何同名技能检查**。这会带来三个问题：

1. **无提示覆盖** — 已安装的（可能更新版本的）技能被静默覆盖
2. **版本回退风险** — 如果 agent 技能目录被手动升级，客户端分发可能回退到旧版本
3. **信息不透明** — 用户在 UI 审批时不知道目标目录的当前状态

本方案在 sync 阶段增加一步只读检查：读取各 agent 目录中已安装技能的版本，与待分发版本对比，将结果展示在审核面板中。**检查结果仅供参考，不阻止分发。**

## Scope 与 Non-Goals

**做什么：**

- 在 sync 阶段检测目标 agent 目录是否已存在同名技能
- 将检查结果（已安装版本、版本对比、是否已安装）展示在审核列表中
- 提供"刷新检查"按钮让用户手动更新检查结果
- 不改变"用户审批后分发"的核心流程

**不做什么：**

- 不做自动版本冲突解决（留待后续版本）
- 不做技能内容 diff 或合并
- 不改变现有 `DesktopSyncState` 的持久化 schema
- 不持久化检查结果（详见 Decision 8）

## Design Decisions

以下 9 个决策点覆盖了检查的触发时机、执行逻辑、数据结构、生命周期和性能约束。

### Decision 1: 检查时机

**选择**：在 sync 阶段（`sync-service.refresh()` 之后）执行检查。

**为什么选这里：** 审核的本质是让用户在充分信息下做决策——检查结果必须在点击 Distribute 之前可见。sync 阶段负责"收集信息"，distribution 阶段只负责"执行写入"，职责分离清晰，且与现有 `compareRemoteSkills()` 流程自然衔接。

**否决的替代方案：**

| 方案 | 否决理由 |
|------|---------|
| 在 `distribution-service.distribute()` 内部检查 | 用户点击后才知道问题，打断决策流程 |
| 在 UI 层直接读文件系统 | renderer 不应访问 privileged API |

### Decision 2: 检查触发策略

以下场景会触发或跳过检查：

| 触发场景 | 行为 |
|----------|------|
| sync refresh 完成且有 pending updates | 自动执行检查 |
| 用户点击"刷新检查"按钮 | 重新执行检查 |
| 应用启动且有 pending updates | 自动执行一次（改善首次体验） |
| 无 pending updates | 跳过检查 |

sync 轮询间隔通常 5–15 分钟，每次有 pending updates 时自动检查一次是可接受的开销。用户也可以随时点击"刷新检查"来手动更新。

### Decision 3: 检查内容

每个 agent 的检查结果包含以下字段：

| 字段 | 说明 |
|------|------|
| `exists` | 目标技能目录是否存在 |
| `installedVersion` | 已安装版本（从 SKILL.md 或 manifest.json 读取） |
| `remoteVersion` | 待分发版本（来自远程技能，对应 `PendingSyncUpdate.remoteVersion`） |
| `versionComparison` | `newer` / `older` / `same` / `unknown` / `error` |
| `versionFormat` | `semver` / `unknown` |
| `errorMessage` | 失败原因（仅 `error` 时有值） |
| `checkedAt` | 检查时间戳（ISO 8601） |
| `durationMs` | 检查耗时（毫秒，用于性能监控） |

### Decision 4: 版本读取方式

从 agent 技能目录中的元数据文件读取版本号，按以下优先级依次尝试：

1. `SKILL.md` frontmatter 中的 `version` 字段（首选）
2. `manifest.json` 中的 `version` 字段（备选）
3. 都不存在或格式不匹配 → `version = null`

`SKILL.md` 的格式约定如下：

```markdown
---
name: my-skill
version: 1.2.0
---
# My Skill
...
```

### Decision 5: 版本对比逻辑

仅支持 **semver 三段式**（`major.minor.patch`）对比。非 semver 格式一律返回 `unknown`。`versionFormat` 字段按同样规则填充：能解析为 semver → `"semver"`，否则 → `"unknown"`。

#### 对比规则

| 条件 | 结果 | 含义 |
|------|------|------|
| `exists = false`（技能未安装） | `older` | 未安装，视为需要升级 |
| 任一版本无法解析为 semver | `unknown` | 无法判断 |
| installed > pending | `newer` | 分发会降级 |
| installed < pending | `older` | 正常升级 |
| installed === pending | `same` | 幂等覆盖 |

> **关于 `exists = false`**：此时 `installedVersion` 为 `null`，技术上无法比较。但 UX 上"未安装"等价于"需要升级"，直接返回 `older` 避免对新安装场景显示无意义的"无法确定版本"警告。

> **关于远程版本为 `null`**：`RemoteSkillSummary.version` 是 `string | null`，当远程版本缺失时 `comparison = "unknown"`，UI 显示"远程版本未知"。

#### 非 semver 格式的处理

| 版本格式 | 示例 | 结果 |
|---------|------|------|
| Git hash | `abc1234` | `unknown` |
| 日期格式 | `2024-01-15` | `unknown` |
| 空字符串 | `""` | 视为 `null`，`unknown` |
| 标签 | `latest`, `stable` | `unknown` |
| 自定义格式 | `2024.1.15`, `v1.2` | 尝试解析为 semver，失败则 `unknown` |
| `v` 前缀 | `v1.2.3` | 去掉 `v` 后尝试解析，成功则 `semver` |
| pre-release | `1.0.0-alpha.1` | 本版本不支持 pre-release 比较，返回 `unknown` |

### Decision 6: 失败处理策略

遵循 `core-beliefs.md` 的 Fail Closed 原则——检查失败时展示错误信息，但**不阻止分发**。检查是为了信息透明，不是门禁。

| 场景 | 结果 | UI 表现 |
|------|------|---------|
| 检查失败（权限/路径问题） | `versionComparison = "error"` | 显示错误信息 |
| 版本读取失败（无 SKILL.md） | `version = null`, `comparison = "unknown"` | 显示警告 |
| 本地版本 > 远程版本 | `comparison = "newer"` | 降级警告 |
| 本地版本 = 远程版本 | `comparison = "same"` | 幂等覆盖提示 |
| 本地版本 < 远程版本 | `comparison = "older"` | 正常升级提示 |

### Decision 7: 数据结构

检查结果使用独立的 `PreCheckResults` 结构，**不修改现有 `PendingSyncUpdate` 类型**，避免影响 `DesktopSyncState` 的持久化 schema。每个 agent 的检查结果通过 `remoteSkillId` + `AgentId` 二级索引关联到对应的 pending update。

```typescript
// AgentId 复用 src/adapters/agents/base.ts 中的现有定义
// type AgentId = "codex" | "claude-code" | "gemini-cli"

interface AgentPreCheckResult {
  exists: boolean
  installedVersion: string | null
  remoteVersion: string | null    // 对应 PendingSyncUpdate.remoteVersion
  versionComparison: "newer" | "older" | "same" | "unknown" | "error"
  versionFormat: "semver" | "unknown"
  errorMessage: string | null
  checkedAt: string   // ISO 8601
  durationMs: number  // 检查耗时
}

// 独立结构，不嵌入 PendingSyncUpdate
// Key: remoteSkillId
type PreCheckResults = Record<string, Record<AgentId, AgentPreCheckResult>>
```

**检查范围**：基于已配置且路径可达的 agent，而非"已启用"的 agent。
- 从 adapter 注册表中获取所有已配置的 agent IDs
- 如果某个 agent 的 skillsPath 未配置或不可达，标记为 `error` 并跳过

### Decision 8: 检查结果生命周期

检查结果缓存在内存中，不持久化。过期时间等于 sync 间隔（`pollIntervalMs × 1.0`），确保结果在下次自动检查前始终有效。

| 属性 | 值 |
|------|-----|
| 缓存位置 | 内存（不持久化到磁盘或 State DB） |
| 过期策略 | `pollIntervalMs × 1.0`，与 sync 间隔对齐 |
| 刷新方式 | 用户点击"刷新检查"按钮，或下次 sync refresh 自动刷新 |
| 过期 UI 表现 | 显示"信息可能已过期，建议刷新"提示，不阻止分发 |

### Decision 9: 性能与超时控制

检查涉及磁盘 I/O，需要超时保护和并发控制，避免阻塞主进程：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 单个 agent 检查超时 | 5 秒 | 防止网络挂载目录或慢速磁盘阻塞 |
| 最大并发 agent 数 | 2 | 避免同时读取多个 agent 目录导致 I/O 压力 |
| 总检查超时 | 15 秒 | 所有 agent 检查的总时间上限 |

**并发模型**：全局 semaphore，所有 pendingUpdate × agentId 的检查组合共享同一并发池（上限 2）。外层遍历 pendingUpdate，内层遍历 agentId，内层并发受 semaphore 控制。

**超时处理**：
- 单个 agent 超时 → `comparison = "error"`, `errorMessage = "Check timed out"`
- 总超时 → 已完成的结果保留，未完成标记为 `error`
- UI 显示超时警告，但不阻止分发

## Implementation Plan

### 新增文件

三个新文件负责核心检查逻辑和配置：

```
src/core/sync/
  pre-check-service.ts    # 检查服务（读 agent 目录、解析版本、对比）
  version-compare.ts      # semver 对比工具函数
src/config/
  pre-check-config.ts     # 超时、并发数等配置项
```

### IPC 契约

renderer 通过 `pre-check:run` 通道请求 main 进程执行检查，main 进程返回检查结果：

```typescript
// Request (renderer → main)
interface PreCheckRunRequest {
  pendingUpdates: PendingSyncUpdate[]
  // agentIds 由 main 进程根据 adapter 注册表自行确定，renderer 不传入
}

// Response (main → renderer)
interface PreCheckRunResponse {
  results: PreCheckResults
  totalDurationMs: number
  errors: string[]  // 全局错误（如 IPC 层面的超时），与 per-agent 的 errorMessage 互不干扰
}

// IPC channel: 'pre-check:run'
// Error codes: 'TIMEOUT', 'PATH_INVALID', 'PERMISSION_DENIED', 'INTERNAL_ERROR'
```

### 修改文件

以下现有文件需要改动，按修改幅度从大到小排列：

| 文件 | 修改内容 |
|------|---------|
| `src/types/index.ts` | 新增 `AgentPreCheckResult` 和 `PreCheckResults` 类型 |
| `src/adapters/agents/base.ts` | 新增 `readInstalledVersion(skillId: string): Promise<string \| null>` 方法到 `AgentAdapterV1` 接口（默认实现从 `skillsPath/{skillId}/SKILL.md` 读取版本，允许各 adapter 覆盖） |
| `src/core/sync/sync-service.ts` | 在 `refresh()` 后调用 pre-check（仅当有 pending updates 时） |
| `src/components/pending-updates-panel.tsx` | 显示检查结果 + "刷新检查"按钮 |
| `electron/ipc.ts` | 新增 `pre-check:run` IPC handler |
| `electron/preload.ts` | 暴露 `preCheckRun` 方法 |

### 核心流程

整体流程分为三层：触发判断 → 并行检查 → 结果展示。检查不阻断分发，用户始终可以跳过。

```
sync refresh 完成
    │
    ├── 有 pending updates？
    │   ├── 否 → 结束
    │   └── 是 ↓
    │
    ├── 获取已配置且路径可达的 agentIds
    │
    ├── preCheckService.checkAll(pendingUpdates, agentIds)
    │   │
    │   ├── 对每个 pendingUpdate:
    │   │   └── 对每个 agentId（最多并发 2 个）:
    │   │       ├── 获取 agent skillsPath（超时 5 秒）
    │   │       ├── 检查 skill 目录是否存在
    │   │       ├── 读取 SKILL.md / manifest.json 版本
    │   │       ├── 对比版本（非 semver → unknown）
    │   │       └── 填充 AgentPreCheckResult
    │   │
    │   └── 返回 PreCheckResults（总超时 15 秒）
    │
    ├── UI 渲染审核列表，展示检查结果
    │
    └── 用户审批后分发（pre-check 结果仅供参考，不阻断）
```

### 用户交互流程

用户在 Pending Updates Panel 中看到检查结果后，可以刷新或直接分发：

```
用户打开 Pending Updates Panel
    │
    ├── 显示每个 pending update 的检查结果
    │   ├── ⚠️ Claude Code: 已安装 v2.1.0（本地更新，分发会降级）
    │   ├── ✅ Codex: 未安装
    │   └── ℹ️ Gemini CLI: 已安装 v2.0.0（版本相同，幂等覆盖）
    │
    ├── 检查结果过期？→ 显示"信息可能已过期"提示
    │
    ├── 用户点击"刷新检查" → 重新执行 pre-check，更新 UI
    │
    └── 用户点击"Distribute" → 执行分发
```

## Security Considerations

检查过程是**只读**的，不修改任何文件系统状态。遵循 `core-beliefs.md` 的 Fail Closed 原则：

### 合约缺口处理

- SKILL.md 格式不匹配 → 版本标记为 `unknown`
- 路径验证失败 → 标记为 `error`，不阻止其他 agent 的检查

### 路径安全

- 检查路径必须通过现有的路径验证逻辑（不允许遍历父目录或访问系统敏感路径）
- 使用 `resolveInstallContext()` 获取的 skillsPath 是已验证的安全路径

## UI/UX Impact

### Pending Updates Panel

每个 pending update 展开后显示各 agent 的检查状态，底部有刷新和分发按钮：

```
┌─────────────────────────────────────────────────────────┐
│  Skill A  1.0.0 → 1.1.0                          [▼]    │
│  Reason: Version mismatch                               │
│                                                         │
│  Agent Status:                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Claude Code    ⚠️ Installed v1.2.0               │  │
│  │                 Local is newer. Distributing      │  │
│  │                 will downgrade.                   │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  Codex          ✅ Not installed                  │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  Gemini CLI     ℹ️ Installed v1.1.0               │  │
│  │                 Same version, idempotent.         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Last checked: 2 min ago  [ Refresh Check ]             │
│  [ Distribute ]                                         │
└─────────────────────────────────────────────────────────┘
```

### 状态图标

| comparison | 图标 | 颜色 | 含义 |
|------------|------|------|------|
| `older` | ✅ | 绿色 | 正常升级 |
| `newer` | ⚠️ | 橙色 | 本地更新，分发会降级 |
| `same` | ℹ️ | 蓝色 | 版本相同，幂等覆盖 |
| `unknown` | ❓ | 灰色 | 无法确定版本 |
| `error` | ❌ | 红色 | 检查失败 |

> **时间戳聚合**：每个 `AgentPreCheckResult` 有独立的 `checkedAt`。UI 中每个 pending update 只显示一个"Last checked"，取该 skill 所有 agent 结果中**最早的** `checkedAt`（最保守的过期判断）。

## Testing Strategy

### 单元测试

#### 版本对比逻辑

| 测试场景 | 验证点 |
|---------|--------|
| 目录不存在 | `exists = false`, `comparison = "older"` |
| 目录存在，无 SKILL.md 或 manifest.json | `version = null`, `comparison = "unknown"` |
| 目录存在，SKILL.md 版本更新 | `comparison = "newer"` |
| 目录存在，SKILL.md 版本更旧 | `comparison = "older"` |
| 目录存在，版本相同 | `comparison = "same"` |

#### 版本读取与格式

| 测试场景 | 验证点 |
|---------|--------|
| SKILL.md 格式错误 | `version = null`, `comparison = "unknown"` |
| manifest.json 版本读取 | 从 manifest.json 成功读取版本 |
| SKILL.md 和 manifest.json 都存在 | 优先使用 SKILL.md |
| 版本号不是合法 semver（如 "latest"） | `comparison = "unknown"` |
| semver 对比 "1.10.0" vs "1.9.0" | 正确识别 "1.10.0" > "1.9.0" |
| `v` 前缀版本 "v1.2.3" | 去掉 `v` 后解析为 semver，`versionFormat = "semver"` |
| pre-release 版本 "1.0.0-alpha.1" | `versionFormat = "unknown"`, `comparison = "unknown"` |
| 远程版本为 null（`remoteVersion = null`） | `comparison = "unknown"` |

#### 错误处理

| 测试场景 | 验证点 |
|---------|--------|
| 路径验证失败 | `comparison = "error"`, `errorMessage` 有值 |
| agent 目录无读写权限 | `comparison = "error"` |
| 并发检查多个 agent | 每个 agent 独立检查，不互相干扰 |

### 集成测试

- sync refresh 后自动触发 pre-check（有 pending updates 时）
- pre-check 结果通过 `PreCheckResults` 正确传递到 UI
- "刷新检查"按钮触发重新检查
- pre-check 缺失时仍可正常分发（不阻断）
- IPC 层请求/响应格式正确
- 超时场景下部分结果保留

### UI 组件测试

- 所有状态图标和颜色正确渲染
- 过期提示正确显示
- "刷新检查"按钮交互
- 加载中 / 错误状态显示

### 性能测试

- 并发检查多个 agent 不互相阻塞
- 单个 agent 超时后继续检查其他 agent
- 总超时后返回已完成结果

### 安全测试

- 路径遍历攻击防护（`../../../etc/passwd`）
- 符号链接跟随检查
- 权限不足时的错误处理

## Migration Notes

本功能为纯增量变更，不修改现有数据结构：

- 现有 `localRecords` 在 State DB 中继续保留，作为已分发技能的记录
- pre-check 读取的是 agent 目录的**实际状态**，不依赖 State DB
- 如果 State DB 记录和 agent 目录状态不一致，以 agent 目录为准
- 分发成功后，以远程版本更新 `localRecords` 中的 `installedVersion`

## Prerequisites（实现前必须确认）

以下问题直接影响功能的可用性，需要在编码前解决：

1. **SKILL.md 格式标准化**：当前 agent 技能目录是否都有 SKILL.md？格式是否统一？
   - 行动项：实现前检查现有 agent 技能目录，确认 SKILL.md 存在性和格式一致性
   - 影响：如果格式不统一，需要增加更多解析逻辑或回退策略。此问题不解决，pre-check 大部分场景会返回 `unknown`，功能价值大打折扣

## Open Questions

以下问题不影响当前版本的核心功能，记录以备后续迭代参考：

1. **多版本共存**：某些 agent 是否支持同一技能的多个版本？
   - 行动项：调研各 agent 的技能目录结构，确认是否支持多版本
   - 影响：如果支持多版本，需要调整检查逻辑，检查所有已安装版本

2. **回滚支持**：如果分发后发现问题，是否需要回滚到之前的版本？
   - 留待后续版本：当前版本只做检查，不做回滚

## References

- Core beliefs: `core-beliefs.md`
- Product spec: `../product-specs/2026-04-17-skill-distribution-v1.md`
- Architecture: `../ARCHITECTURE.md`
- Adapter base: `../../src/adapters/agents/base.ts`
- Distribution service: `../../src/core/distribution/distribution-service.ts`
- Sync service: `../../src/core/sync/sync-service.ts`
- Compare logic: `../../src/core/sync/compare.ts`
