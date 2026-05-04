# Agent 路径配置

Status: 本地规范产品文档，已于 2026-05-04 实施

## 目的

用持久化的 JSON 配置文件替代基于环境变量的 Agent 技能路径覆盖机制，由桌面客户端管理。用户必须能够在不设置环境变量的情况下自定义每个 Agent 的技能目录位置，并且桌面客户端必须提供 UI 入口供用户访问和编辑配置。

## 目标

- 在应用配置目录中新增持久化 JSON 配置文件（`agent-paths.json`），存储每个 Agent 的技能目标路径覆盖。
- 从 Agent 检测和路径解析代码中移除所有 `SKILLDRIVE_*_SKILLS_PATH` 环境变量支持。
- 建立明确的优先级顺序：用户 JSON 配置覆盖 `definitions.ts` 中的内置默认值。
- 在设置抽屉中提供 UI 入口，供用户访问和编辑 Agent 路径配置。
- 支持跨平台路径格式：`~` 前缀的主目录相对路径和平台原生绝对路径。
- 在用户配置的路径用于检测或分发之前进行安全校验。
- 保持所有现有功能：共享路径（`sharedPathKey`）、Agent 检测、本地技能扫描和技能分发。

## 非目标

- v1 不提供应用内逐字段输入的路径编辑器。UI 入口可以打开配置文件目录供手动编辑。
- 不修改 `AgentId` 联合类型或支持的 Agent 集合。
- 不修改 `detectionDirs` 的解析逻辑。只有 `defaultTargets` 路径可被用户覆盖。
- 不修改后端 API 契约、同步状态或分发语义。
- 不提供从环境变量的自动路径迁移。之前依赖环境变量的用户必须通过新的 JSON 文件重新配置。
- 不支持在内置目录之外添加自定义 Agent。

## 配置文件

### 位置

配置文件与现有 `config.json` 存放在同一应用配置目录中：

| 平台 | 路径 |
|------|------|
| Windows | `%LOCALAPPDATA%\SkillDrive\config\agent-paths.json` |
| macOS | `~/Library/Application Support/SkillDrive/config/agent-paths.json` |
| Linux | `~/.local/share/SkillDrive/config/agent-paths.json` |

路径遵循现有 `config-store.ts` 使用的 `appPaths.configDir` 约定。

### 格式

```json
{
  "trae": {
    "targetPath": "~/custom-skills/trae"
  },
  "claude-code": {
    "targetPath": "D:/skills/claude"
  }
}
```

每个键是内置目录中的 `AgentId`。每个值对象包含一个 `targetPath` 字符串，覆盖该 Agent 的 `defaultTargets[0].path`。

### 优先级

1. 用户 JSON 配置（`agent-paths.json`）
2. 内置默认值（`src/adapters/agents/definitions.ts`）

当 JSON 文件缺失、为空或不包含某个 Agent 的条目时，使用内置默认值。

### 路径解析

用户配置的路径由 `agent-detection-service.ts` 中现有的 `resolvePath()` 函数解析，支持：

- `~` 或 `~/...` &mdash; 解析为用户主目录
- 平台原生绝对路径 &mdash; 标准化后直接使用

不支持其他 shell 扩展或变量替换。

### 校验

用户配置的路径在生效前必须通过以下校验：

- 路径修剪后不能为空。
- 原始路径或标准化后的路径不能包含 `..` 路径遍历段。
- 路径必须是 `~`、`~/...`，或当前平台原生的绝对路径。
- 解析后的路径必须在当前平台上标准化为有效的目录字符串。

JSON 文件中的无效条目将被静默忽略，改用内置默认值。

## 环境变量移除

必须移除所有 `SKILLDRIVE_*_SKILLS_PATH` 环境变量处理：

- 从 `definitions.ts` 的 `AgentPathDefinition` 中移除 `envVar` 字段。
- 从 `supportedAgentDefinitions` 的每个条目中移除所有 `envVar` 值。
- 从 `agent-detection-service.ts` 中移除环境变量查找逻辑。
- 移除 `AgentInstallSource` 值 `"environment"` 及所有引用它的代码分支。
- 更新 `AgentInstallStatus.source`，仅允许 `"auto-detected"` 或 `"missing"`。
- 更新引用 `"environment"` 来源的 UI 标签。

## UI 规格

### 入口

在设置抽屉中（现有 `AgentsPanel` 内部或旁边）添加一个按钮，用于在系统文件管理器中打开 `agent-paths.json` 配置文件所在目录。用户可以手动编辑 JSON 文件。

### 按钮行为

- 点击时调用 IPC 通道，使用 `shell.showItemInFolder()` 或等效方法在资源管理器（Windows）、Finder（macOS）或默认文件管理器（Linux）中打开配置目录。
- 如果 `agent-paths.json` 文件不存在，先创建一个空对象 `{}`，再打开目录，以便用户立即看到该文件。
- 主进程应优先定位并展示 `agent-paths.json`，若平台不支持展示文件，则回退为打开 `appPaths.configDir`。

### 编辑后刷新

- 用户在外部编辑并保存 JSON 文件后，需点击 `AgentsPanel` 中现有的"重新检测"按钮来刷新 Agent 检测。
- v1 不需要文件系统监视器。

### 布局保持

- 现有 `AgentsPanel`、`SettingsPanel`、`ConfigPanel` 和 `SettingsDrawer` 的布局不得重新调整。
- 新按钮仅为增量添加。

## IPC 变更

### 新增通道

| 通道 | 方向 | 用途 |
|------|------|------|
| `agent-paths:read` | 渲染进程 → 主进程 | 读取当前 Agent 路径配置 |
| `agent-paths:save` | 渲染进程 → 主进程 | 写入部分或完整的 Agent 路径配置 |
| `agent-paths:open-config-dir` | 渲染进程 → 主进程 | 在系统文件管理器中打开配置目录 |

### Bridge 接口新增

```typescript
getAgentPathsConfig(): Promise<AgentPathsConfig>
saveAgentPathsConfig(config: AgentPathsConfig): Promise<AgentPathsConfig>
openAgentPathsConfigDir(): Promise<void>
```

其中 `AgentPathsConfig` 为 `Partial<Record<AgentId, { targetPath: string }>>`。
`agent-paths:read` 与 `agent-paths:save` 只返回已校验条目；无效或未知条目在返回给渲染进程或用于检测之前会被丢弃。

## 架构边界

- JSON 配置仅由 Electron 主进程读写。
- 渲染进程通过类型化 IPC 通道访问配置。
- 路径解析和校验保留在主进程中。
- 复用 `config-store.ts` 中现有的 `createJsonConfigStore` 进行文件 I/O。
- 复用 `agent-detection-service.ts` 中现有的 `resolvePath()` 进行路径标准化。
- `agent-detection-service.ts` 在检测时将用户配置与内置默认值合并。

## 安全要求

- 渲染进程不得接收未经验证的原始文件系统路径。
- 路径校验必须在路径到达检测或分发代码之前拒绝遍历、空值和不安全路径。
- JSON 配置文件必须以适当权限创建（POSIX 系统上仅用户可读）。
- 迁移过程中不记录或持久化环境变量值。
- 当前桌面端架构、安全、AGENTS 和运行时参考文档必须同步更新，不再宣传 `SKILLDRIVE_*_SKILLS_PATH` 覆盖方式。

## 验收标准

- 当用户打开配置目录或保存配置时，`agent-paths.json` 在 `appPaths.configDir` 中被创建。
- 用户配置的路径覆盖 Agent 检测和技能分发的内置默认值。
- 缺失或为空的 `agent-paths.json` 回退到内置默认值，不产生错误。
- 所有 `SKILLDRIVE_*_SKILLS_PATH` 环境变量代码已移除。
- `AgentInstallSource` 类型不再包含 `"environment"`。
- 设置抽屉中包含一个按钮，可在系统文件管理器中打开配置目录。
- 编辑 JSON 文件后点击"重新检测"可获取新路径。
- JSON 文件中的无效路径被优雅地忽略。
- 共享路径去重（`sharedPathKey`）在用户配置路径下继续正常工作。
- `npm test`、`npm run build` 和 `python scripts/validate_agents_docs.py --level ERROR` 全部通过。
- 当前桌面端运行时文档指引用户通过 `agent-paths.json` 配置 Agent 技能路径覆盖，而不是使用 `SKILLDRIVE_*_SKILLS_PATH` 变量。

## 参考

- Agent 定义：`../../src/adapters/agents/definitions.ts`
- Agent 检测服务：`../../src/core/detection/agent-detection-service.ts`
- 配置存储：`../../src/core/storage/config-store.ts`
- 应用路径：`../../src/core/storage/app-paths.ts`
- IPC 通道：`../../electron/ipc.ts`
- 运行时配置管理器：`../../src/core/runtime/runtime-config-manager.ts`
