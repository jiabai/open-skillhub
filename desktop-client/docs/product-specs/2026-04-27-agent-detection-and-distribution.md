# AI 编程助手感知与定向分发

> 状态：产品规格文档（已审查；实现前需完成 ExecPlan 评审）

## 这个功能是什么？

让桌面客户端自动感知本机已安装的 AI 编程助手，只向已安装的助手分发 SKILL，未安装的不分发。

简单来说：**客户端启动 → 扫描本机 → 发现哪些助手已安装 → 只往已安装的助手目录写入 SKILL**。

## 为什么需要这个功能？

**当前痛点**

| 问题 | 影响 |
|------|------|
| 仅支持 3 个 Agent（Codex、Claude Code、Gemini CLI） | 覆盖面窄，大量主流助手无法使用 |
| 不感知助手是否安装 | 可能向不存在的目录分发，浪费操作且产生错误 |
| AgentId 硬编码为 3 个 | 扩展新助手需要改动类型定义和多个模块 |

**目标用户**

- 同时使用多种 AI 编程助手的开发者
- 只安装了部分助手的用户
- 希望一次审批、自动分发到所有已安装助手的操作员

## 核心产品规则

1. **感知优先**：分发前必须先感知，只向已安装的助手分发
2. **未安装不分发**：助手未安装时，该助手不参与写入流程，不报错、不阻塞
3. **目录检测是启发式判断**：通过检测助手配置/数据目录是否存在来判断是否安装；这不是助手可执行程序或版本检测
4. **环境变量是显式目标覆盖**：设置环境变量时，将该路径视为用户明确配置的分发目标，但仍需执行路径安全、可写性和安装校验
5. **读取路径和写入目标分离**：多路径助手可能读取多个 SKILL 目录，但桌面客户端只写入该助手定义的 owned target；兼容读取路径不自动重复写入
6. **共享路径只写一次**：多个助手共享同一物理 SKILL 目录时，按规范化后的真实目标路径去重，只执行一次文件写入
7. **分发前仍需人工审批**：感知和分发是两个独立阶段，感知结果仅决定分发目标范围
8. **权限边界不变**：目录扫描、路径校验和文件写入都必须停留在 Electron main process、core service 或 agent adapter 层，renderer 只消费 IPC 返回的序列化状态

## 支持的 AI 编程助手一览

### 支持 SKILL 的助手（20 个）

| 序号 | Agent | 显示名称 | 默认分发目标 | 检测目录（判断是否安装） | 路径类型 |
|------|-------|---------|-----------|----------------------|---------|
| 1 | Claude | Claude Code | `~/.claude/skills` | `~/.claude` | 单路径 |
| 2 | Cursor | Cursor | `~/.cursor/skills` | `~/.cursor` | 单路径（主路径） |
| 3 | Windsurf | Windsurf | `~/.codeium/windsurf/skills` | `~/.codeium/windsurf` | 单路径 |
| 4 | Copilot | GitHub Copilot | `~/.copilot/skills` | `~/.copilot` | 单路径 |
| 5 | RooCode | RooCode | `~/.roo/skills` | `~/.roo` | 单路径 |
| 6 | Cline | Cline | `~/.agents/skills` | `~/.agents` | 共享路径 |
| 7 | Gemini | Gemini CLI | `~/.gemini/skills` | `~/.gemini` | 单路径 |
| 8 | Codex | OpenAI Codex | `~/.codex/skills` | `~/.codex` | 单路径（主路径） |
| 9 | OpenCode | OpenCode | `~/.config/opencode/skills` | `~/.config/opencode` | 单路径（主路径） |
| 10 | KiloCode | KiloCode | `~/.kilocode/skills` | `~/.kilocode` | 单路径 |
| 11 | Amp | Amp | `~/.config/agents/skills` | `~/.config/agents` | 共享路径 |
| 12 | Kiro | Kiro | `~/.kiro/skills` | `~/.kiro` | 单路径 |
| 13 | Warp | Warp | `~/.agents/skills` | `~/.agents` | 共享路径 |
| 14 | Trae | Trae | `~/.trae/skills` | `~/.trae` | 单路径 |
| 15 | Factory | Factory | `~/.factory/skills` | `~/.factory` | 单路径 |
| 16 | Kimi | Kimi Code CLI | `~/.config/agents/skills` | `~/.config/agents` | 共享路径（与 Amp 共享） |
| 17 | Mistral | Mistral Le Chat | `~/.vibe/skills` | `~/.vibe` | 单路径 |
| 18 | Pi | Pi Coding Agent | `~/.pi/agent/skills` | `~/.pi/agent` | 单路径 |
| 19 | Antigravity | Antigravity | `~/.gemini/antigravity/skills` | `~/.gemini/antigravity` | 单路径 |
| 20 | OpenClaw | OpenClaw | 优先级检测（见下文） | 优先级检测（见下文） | 优先级路径 |

### 不支持 SKILL 的助手（3 个）

| 序号 | Agent | 显示名称 | 说明 |
|------|-------|---------|------|
| 1 | Zed | Zed | 不支持 Skills |
| 2 | AugmentCode | AugmentCode | 不支持 Skills |
| 3 | JetBrains AI | JetBrains AI | 不支持 Skills |

不支持 SKILL 的助手不参与感知和分发流程。

## 助手感知机制

### 感知原理

通过检测助手在本机的配置/数据目录是否存在来判断该助手是否已安装。

```
助手已安装 = 助手的检测目录在文件系统中存在
助手未安装 = 助手的检测目录在文件系统中不存在
```

### 感知流程

```
应用启动 / 运行时配置重载 / 用户手动刷新 / 分发前
    ↓
遍历所有支持 SKILL 的助手定义
    ↓
对每个助手检测其「检测目录」是否存在，并合并环境变量显式目标
    ↓
生成已安装助手列表（installedAgents）和有效分发目标（effectiveTargets）
    ↓
分发时仅向 effectiveTargets 中需要写入的目标分发
```

### 感知时机

| 时机 | 说明 |
|------|------|
| 应用启动 | 初始扫描，建立已安装助手列表 |
| 用户手动刷新 | 在 Agents 面板提供「重新检测」按钮 |
| 分发前 | 审批分发前再次确认助手安装状态，防止用户在等待期间卸载 |

### 特殊检测规则

#### 多路径读取助手

以下助手会读取多个 SKILL 路径，但本功能只写入该助手的 owned target。兼容路径仅用于解释覆盖关系，不作为该助手的重复分发目标。

**Cursor** — 分发到主路径
```
主路径：~/.cursor/skills        ← 分发目标
兼容路径：~/.claude/skills      ← 不重复分发（由 Claude 适配器负责）
兼容路径：~/.codex/skills       ← 不重复分发（由 Codex 适配器负责）
```

**OpenCode** — 分发到主路径
```
主路径：~/.config/opencode/skills  ← 分发目标
兼容路径：~/.claude/skills         ← 不重复分发（由 Claude 适配器负责）
兼容路径：~/.agents/skills         ← 不重复分发（由 Cline/Warp 适配器负责）
```

**Codex** — 分发到主路径
```
主路径：~/.codex/skills       ← 分发目标
兼容路径：~/.agents/skills    ← 不重复分发（由 Cline/Warp 适配器负责）
系统路径：/etc/codex/skills   ← Windows 不存在，跳过
```

**Claude** — 分发到主路径
```
主路径：~/.claude/skills                          ← 分发目标
动态路径：~/.claude/plugins/marketplaces/*/skills  ← 不自动分发，由 Claude 插件系统管理
```

**设计原则**：每个 SKILL 目录只由一个 owned target 负责写入，避免多适配器重复写入同一目录导致冲突。多读取路径不等于多写入路径。

#### 优先级路径助手

**OpenClaw** — 按优先级检测，选择第一个存在的路径作为分发目标
```
优先级 1：~/.openclaw/skills    ← 优先检测和分发
优先级 2：~/.clawdbot/skills    ← 次优先
优先级 3：~/.moltbot/skills     ← 最后
```

检测逻辑：依次检查三个目录，第一个存在的即为分发目标。如果三个都不存在，判定为未安装。

#### 共享路径助手

**Amp 和 Kimi** 共享 `~/.config/agents/skills` 路径。两个助手检测到同一目录时，只需写入一次，并在结果里标记两个助手均由该共享路径覆盖。

**Cline 和 Warp** 共享 `~/.agents/skills` 路径。同理只需写入一次。

共享路径去重不能依赖异步扫描完成顺序，必须基于规范化后的目标路径或稳定的 `sharedPathKey`。UI 可以展示多个助手，但 core distribution 只能收到去重后的物理写入目标。

## SKILL 分发机制

### 本地 SKILL 冲突检测

感知到助手已安装时，该助手的 SKILL 目录下可能已存在多个 SKILL。需要根据远程 SKILL 与本地已有 SKILL 的同名关系，决定分发按钮的显示逻辑：

**检测流程**

```
感知到助手已安装
    ↓
扫描该助手 SKILL 目录下所有已存在的 SKILL
    ↓
对每个待分发的远程 SKILL，与本地同名 SKILL 比较版本
    ↓
根据比较结果决定分发按钮显示
```

**判定规则**

| 远程 SKILL 与本地关系 | 含义 | 分发按钮 | 界面提示 |
|---------------------|------|---------|---------|
| 不同名 | 本地不存在该 SKILL，无冲突 | **显示** | 「新安装」 |
| 同名同版本 | 本地已有相同版本，无需更新 | **不显示** | 「已安装 v1.2.0」（灰色，不可操作） |
| 同名不同版本 | 本地版本与远程版本不同，需要更新 | **显示** | 「v1.1.0 → v1.2.0」（版本变更提示） |
| 同名但本地无版本信息 | 本地存在该 SKILL 但无法读取版本 | **显示** | 「本地版本未知 → v1.2.0」 |

**设计原则**

- 同名同版本意味着该 SKILL 已是最新，无需重复分发，不显示分发按钮避免误操作
- 同名不同版本意味着存在版本差异，显示分发按钮让用户决定是否覆盖更新
- 不同名意味着全新安装，始终显示分发按钮
- 版本读取来源遵循现有 `readInstalledSkillMetadata` 的优先级：SKILL.md frontmatter → manifest.json → nested manifest.json

**操作显示规则**

- 如果至少一个有效分发目标是「不同名」「同名不同版本」或「本地版本未知」，展示分发按钮
- 如果所有有效分发目标都是「同名同版本」，不展示分发按钮，展示「已安装」状态
- 如果所有有效分发目标都是「同名同版本」但本地 `StateStore` 仍有 pending 记录，展示非写入动作「同步本地记录」；该动作只更新桌面客户端本地记录，不写入任何助手目录
- 如果没有有效分发目标，展示「未检测到已安装助手」状态，不展示分发按钮

### 分发前提

1. 助手已被感知为已安装
2. 至少一个有效目标需要写入（本地不存在、版本不同，或本地版本未知）
3. SKILL 更新已通过人工审批
4. 分发目标目录可写
5. 分发请求中的物理写入目标已完成共享路径去重

### 分发流程

```
用户审批 SKILL 更新
    ↓
重新扫描已安装助手和有效分发目标
    ↓
对每个有效目标：
    ├─ 扫描该助手 SKILL 目录下的本地 SKILL
    ├─ 对比远程 SKILL 与本地同名 SKILL 的版本
    ├─ 同名同版本 → 跳过写入，标记已安装
    ├─ 同名不同版本、不同名或本地版本未知 → 纳入待写入目标
    ├─ 检查目标目录可写性
    ├─ 执行分发（写入 SKILL 文件）
    └─ 记录分发结果
    ↓
汇总分发结果，展示给用户
```

如果所有有效目标都是同名同版本，则不进入文件写入流程；用户可通过「同步本地记录」将本地 `StateStore` 与实际目录状态对齐，从而移除 stale pending 记录。

### 分发结果

| 结果 | 含义 | 用户看到 |
|------|------|---------|
| 成功 | SKILL 已写入助手目录 | 绿色成功提示 |
| 覆盖（共享路径） | 该助手与另一个助手共享同一物理目录，已由同一次写入覆盖 | 灰色提示：已由共享路径覆盖 |
| 跳过（助手未安装） | 助手未安装，不参与写入 | 灰色提示：助手未安装，已跳过 |
| 跳过（同名同版本） | 本地已有相同版本，无需分发 | 灰色提示：已安装 v1.2.0，无需更新 |
| 失败 | 写入出错（权限、磁盘等） | 红色错误提示 + 具体原因 |

### 去重写入规则

当多个助手共享同一 SKILL 目录时，实际只写入一次：

| 共享目录 | 负责写入的助手 | 其他共享助手 |
|---------|-------------|------------|
| `~/.agents/skills` | 规范化路径对应的单个物理写入目标 | Cline / Warp 标记为「已由共享路径覆盖」或「同一目标已处理」 |
| `~/.config/agents/skills` | 规范化路径对应的单个物理写入目标 | Amp / Kimi 标记为「已由共享路径覆盖」或「同一目标已处理」 |

## 用户界面

### Agents 面板改造

当前 Agents 面板是静态信息面板，需要改造为动态感知面板：

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   已安装的 AI 编程助手                          [重新检测]  │
│                                                             │
│   ┌───────────────────────────────────────────────────────┐│
│   │ ✓ Claude Code          ~/.claude/skills              ││
│   │ ✓ Cursor               ~/.cursor/skills              ││
│   │ ✓ Trae                 ~/.trae/skills                ││
│   │ ✗ Windsurf             未安装                         ││
│   │ ✗ Copilot              未安装                         ││
│   │ ...                                                   ││
│   └───────────────────────────────────────────────────────┘│
│                                                             │
│   已安装 3 个 · 支持 SKILL 的助手 20 个 · 不支持 3 个      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 面板交互

| 操作 | 行为 |
|------|------|
| 点击「重新检测」 | 重新扫描所有助手目录，刷新安装状态 |
| 查看助手详情 | 展示助手的 SKILL 路径、检测目录、安装状态 |
| 分发确认 | 仅显示已安装助手作为分发目标 |

### Overview 面板扩展

在概览面板中增加已安装助手数量指标：

```
待审批更新：5
本地记录：12
已安装助手：3    ← 新增
上次刷新：2 分钟前
```

### 分发确认对话框扩展

分发确认时，明确告知将分发到哪些已安装助手：

```
即将分发到以下已安装助手：
  • Claude Code
  • Cursor
  • Trae

未安装的助手将跳过：
  • Windsurf
  • Copilot
  • ...

确认分发？
```

## 环境变量覆盖

每个助手支持通过环境变量覆盖自动检测的 SKILL 路径：

| 助手 | 环境变量 |
|------|---------|
| Claude Code | `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH` |
| Codex | `OPEN_SKILLHUB_CODEX_SKILLS_PATH` |
| Gemini CLI | `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH` |
| Cursor | `OPEN_SKILLHUB_CURSOR_SKILLS_PATH` |
| Windsurf | `OPEN_SKILLHUB_WINDSURF_SKILLS_PATH` |
| Copilot | `OPEN_SKILLHUB_COPILOT_SKILLS_PATH` |
| RooCode | `OPEN_SKILLHUB_ROOCODE_SKILLS_PATH` |
| Cline | `OPEN_SKILLHUB_CLINE_SKILLS_PATH` |
| OpenCode | `OPEN_SKILLHUB_OPENCODE_SKILLS_PATH` |
| KiloCode | `OPEN_SKILLHUB_KILOCODE_SKILLS_PATH` |
| Amp | `OPEN_SKILLHUB_AMP_SKILLS_PATH` |
| Kiro | `OPEN_SKILLHUB_KIRO_SKILLS_PATH` |
| Warp | `OPEN_SKILLHUB_WARP_SKILLS_PATH` |
| Trae | `OPEN_SKILLHUB_TRAE_SKILLS_PATH` |
| Factory | `OPEN_SKILLHUB_FACTORY_SKILLS_PATH` |
| Kimi | `OPEN_SKILLHUB_KIMI_SKILLS_PATH` |
| Mistral | `OPEN_SKILLHUB_MISTRAL_SKILLS_PATH` |
| Pi | `OPEN_SKILLHUB_PI_SKILLS_PATH` |
| Antigravity | `OPEN_SKILLHUB_ANTIGRAVITY_SKILLS_PATH` |
| OpenClaw | `OPEN_SKILLHUB_OPENCLAW_SKILLS_PATH` |

环境变量优先级高于自动检测路径。设置了环境变量时，该助手被视为用户显式配置的目标，自动检测目录不存在也不阻止它进入候选目标列表。

环境变量不会跳过安全校验：路径仍需规范化，分发前仍需验证目标目录可创建或可写。环境变量覆盖的是该助手的默认分发目标，不自动扩展到兼容读取路径或共享路径的其他助手。

## 架构变更

### AgentId 类型扩展

当前 `AgentId` 仅包含 3 个值，需扩展为 20 个：

```typescript
export type AgentId =
  | "claude-code"
  | "cursor"
  | "windsurf"
  | "copilot"
  | "roocode"
  | "cline"
  | "gemini-cli"
  | "codex"
  | "opencode"
  | "kilocode"
  | "amp"
  | "kiro"
  | "warp"
  | "trae"
  | "factory"
  | "kimi"
  | "mistral"
  | "pi"
  | "antigravity"
  | "openclaw"
```

### 适配器注册表扩展

每个助手需要一个适配器实例，注册到 `registry.ts`。所有适配器复用 `createFilesystemAgentAdapter`，差异仅在 `id`、`displayName` 和路径解析。

### 路径解析策略

路径解析逻辑从 `runtime-config-manager.ts` 中提取，改为数据驱动：

```typescript
interface AgentPathDefinition {
  id: AgentId
  displayName: string
  detectionDirs: string[]       // 用于自动判断是否安装的目录
  defaultTargets: Array<{
    path: string
    role: "primary" | "owned-secondary"
    sharedPathKey?: string      // 共享路径标识，用于去重
  }>
  compatibleReadPaths?: string[] // 记录助手会读取但桌面客户端不重复写入的路径
  pathResolution: "all-owned" | "priority" // all-owned=写入全部 owned target，priority=第一个存在或配置的目标
  envVar: string
}
```

环境变量覆盖时，`defaultTargets` 会被替换为一个显式目标。`compatibleReadPaths` 永远不因为环境变量而变成写入目标。

### 感知服务新增

新增 `src/core/detection/agent-detection-service.ts`：

```
职责：
- 扫描所有助手的检测目录
- 返回已安装助手列表
- 处理共享路径去重
- 处理优先级路径选择
- 提供手动重新检测接口
- 生成 renderer 可消费的安装状态快照
- 为分发服务提供去重后的物理写入目标
```

## 成功标准

1. ✅ 应用启动时自动检测本机已安装的 AI 编程助手
2. ✅ Agents 面板显示所有 20 个支持 SKILL 的助手的安装状态
3. ✅ SKILL 分发仅针对已安装助手，未安装助手自动跳过
4. ✅ 共享路径不重复写入
5. ✅ OpenClaw 优先级路径正确选择
6. ✅ 环境变量覆盖正常工作
7. ✅ 分发结果明确区分成功、跳过、失败三种状态
8. ✅ 现有 3 个助手（Codex、Claude Code、Gemini CLI）的行为不退化
9. ✅ 同名同版本的 SKILL 不显示分发按钮，界面提示已安装版本
10. ✅ 同名不同版本的 SKILL 显示分发按钮，界面提示版本变更
11. ✅ 不同名的 SKILL 始终显示分发按钮，界面提示新安装
12. ✅ 所有有效目标同名同版本时，可通过非写入动作同步本地记录并移除 stale pending
13. ✅ 多读取路径助手只写入 owned target，兼容读取路径不重复写入

## 不做什么

这些功能不在本次范围内：

- 自动安装未安装的 AI 编程助手
- 助手可执行程序、版本号或运行状态检测（只检测目录是否存在）
- SKILL 路径的手动自定义界面（仅支持环境变量覆盖）
- 不支持 SKILL 的 3 个助手（Zed、AugmentCode、JetBrains AI）的任何集成
- 多路径助手的兼容路径写入（仅写入主路径）

## 相关文档

- SKILL 路径数据源：`2026-04-23-agents-skill-paths.md`
- 分发规范：`2026-04-17-skill-distribution-v1.md`
- 架构文档：`../ARCHITECTURE.md`
- 安全规则：`../SECURITY.md`
