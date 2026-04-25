# Pre-Distribution Skill Check - Technical Design

## Problem Statement

当前分发流程中，`adapter.installSkill()` 直接将技能文件复制到 agent 技能目录，
**不做任何同名技能检查**。这导致：

1. **无提示覆盖**：已安装的（可能更新版本的）技能被静默覆盖
2. **版本回退风险**：如果 agent 技能目录被手动升级，客户端分发可能回退到旧版本
3. **违背核心信念**：用户在 UI 审批时不知道目标目录的当前状态

## Scope

- 在分发前检测目标 agent 目录是否已存在同名技能
- 将检测结果暴露给 UI 层，供用户在审批时参考
- 不改变"用户审批后分发"的核心流程，只增加信息透明度

## Non-Goals

- 不做自动版本冲突解决（留待后续版本）
- 不做技能内容 diff 或合并
- 不改变现有 `DesktopSyncState` 的持久化 schema

## Design Decisions

### Decision 1: 检查时机

**选择**：在 `distribution-service.ts` 的 `distribute()` 方法中，调用 `installSkill()` 之前执行检查。

**理由**：
- 检查属于分发决策的一部分，应该在 distribution 层而非 adapter 层
- adapter 只负责"写入"，不负责"决策"
- 这样每个 agent 的检查可以独立进行，一个失败不影响其他

**替代方案**：
- 在 adapter.installSkill 内部检查 → 拒绝，adapter 不应包含决策逻辑
- 在 UI 层提前检查 → 拒绝，UI 层不应直接访问文件系统

### Decision 2: 检查内容

检查以下信息：

| 字段 | 说明 |
|------|------|
| `exists` | 目标目录是否存在 |
| `installedVersion` | 已安装版本（从 SKILL.md 或元数据文件读取） |
| `pendingVersion` | 待分发版本（来自请求） |
| `versionComparison` | `newer` / `older` / `same` / `unknown` |

### Decision 3: 版本读取方式

**选择**：从 agent 技能目录中的 `SKILL.md` 头部元数据读取版本号。

**理由**：
- SKILL.md 是 agent 技能的标准元数据文件
- 不需要引入新的元数据格式
- 如果文件不存在或格式不匹配，版本标记为 `unknown`

**SKILL.md 格式约定**：
```markdown
---
name: my-skill
version: 1.2.0
---
# My Skill
...
```

### Decision 4: 失败处理策略

| 场景 | 行为 |
|------|------|
| 检查失败（权限/路径问题） | `fail closed`，中止该 agent 的分发 |
| 版本读取失败（无 SKILL.md） | `version = unknown`，继续分发但标记警告 |
| 本地版本 > 远程版本 | 继续分发，但 UI 显示警告 |
| 本地版本 = 远程版本 | 继续分发，跳过（幂等优化） |

### Decision 5: 返回值扩展

扩展 `SkillDistributionTargetResult`：

```typescript
interface SkillDistributionTargetResult {
  agentId: string
  success: boolean
  errorMessage: string | null
  // 新增
  preCheck?: {
    existed: boolean
    installedVersion: string | null
    pendingVersion: string | null
    versionComparison: "newer" | "older" | "same" | "unknown"
  }
}
```

## Implementation Plan

### 新增文件

```
src/
  core/distribution/
    pre-check-service.ts    # 分发前检查服务
```

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/types/index.ts` | 扩展 `SkillDistributionTargetResult` 类型 |
| `src/adapters/agents/base.ts` | 新增 `readInstalledVersion()` 方法 |
| `src/core/distribution/distribution-service.ts` | 在 `distribute()` 中调用 pre-check |
| `src/components/pending-updates-panel.tsx` | 显示版本对比警告 |

### 核心流程

```
用户点击 "Distribute"
    │
    ▼
distribution-service.distribute()
    │
    ├── 对每个 enabledAgentId:
    │   │
    │   ├── preCheckService.check(agentId, skillId, version)
    │   │   ├── 检查目录是否存在
    │   │   ├── 读取 SKILL.md 版本
    │   │   └── 对比版本
    │   │
    │   ├── 如果 existed && same → 跳过（幂等）
    │   │
    │   └── 否则 → installSkill()
    │
    ▼
返回结果包含 preCheck 信息
```

## Security Considerations

遵循 `core-beliefs.md` 原则：

### Principle 4: Fail Closed On Contract Gaps

- 如果 SKILL.md 格式不匹配，版本标记为 `unknown`，不阻止分发
- 如果路径验证失败，直接中止分发
- 检查过程不修改任何文件系统状态

### 路径安全

- 检查路径必须通过现有的路径验证逻辑
- 不允许遍历父目录或访问系统敏感路径

## UI/UX Impact

### Pending Updates Panel 扩展

在用户点击 "Distribute" 前，显示预检查结果：

```
┌─────────────────────────────────────────────────┐
│  Skill: my-skill v2.0.0                         │
│                                                 │
│  Target: Claude Code                            │
│  Status: ⚠️ Already installed (v2.1.0)          │
│  Warning: Local version is newer than remote.   │
│           Distributing will downgrade.           │
│                                                 │
│  Target: Codex                                  │
│  Status: ✅ Not installed                        │
│                                                 │
│  Target: Gemini CLI                             │
│  Status: ℹ️ Already installed (v2.0.0)          │
│           Same version, will skip.               │
│                                                 │
│  [ Cancel ]  [ Distribute Anyway ]              │
└─────────────────────────────────────────────────┘
```

## Testing Strategy

### 单元测试

| 测试场景 | 验证点 |
|---------|--------|
| 目录不存在 | `exists = false` |
| 目录存在，无 SKILL.md | `version = null` |
| 目录存在，SKILL.md 版本更新 | `comparison = "newer"` |
| 目录存在，SKILL.md 版本更旧 | `comparison = "older"` |
| 目录存在，版本相同 | `comparison = "same"` |
| SKILL.md 格式错误 | `version = null`, `comparison = "unknown"` |

### 集成测试

- 完整分发流程包含 pre-check
- pre-check 失败时不执行安装
- 幂等场景（相同版本）跳过安装

## Migration Notes

- 现有 `localRecords` 在 State DB 中继续保留，作为已分发技能的记录
- pre-check 读取的是 agent 目录的实际状态，不依赖 State DB
- 如果 State DB 记录和 agent 目录状态不一致，以 agent 目录为准

## Open Questions

1. **SKILL.md 格式标准化**：当前 agent 技能目录是否都有 SKILL.md？格式是否统一？
2. **多版本共存**：某些 agent 是否支持同一技能的多个版本？
3. **回滚支持**：如果分发后发现问题，是否需要回滚到之前的版本？

## References

- Core beliefs: `core-beliefs.md`
- Product spec: `../product-specs/2026-04-17-skill-distribution-v1.md`
- Architecture: `../ARCHITECTURE.md`
- Adapter base: `../../src/adapters/agents/base.ts`
- Distribution service: `../../src/core/distribution/distribution-service.ts`
