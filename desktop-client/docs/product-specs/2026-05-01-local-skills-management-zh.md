# 本地 SKILL 管理

状态：规范的本地产品规格，待实现

## 目的

为桌面客户端构建一个以人工审核为前提的“本地 SKILL”视图。操作员需要能够查看本地
agent 技能目录中发现的有效 SKILL，了解每个 SKILL 是否已存在于服务端，并通过
Client API 明确上传服务端缺失的本地 SKILL。

该能力是本地库存与上传入口，不改变现有远端更新审核和分发流程。

## 目标

- 在主导航中新增“本地 SKILL”视图，位置在“首页”和“更新”之间。
- 基于现有 agent catalog 和检测快照，从已安装或显式配置的 agent 技能目标目录中枚举
  本地 SKILL 包根目录。
- 展示本地 SKILL 名称、本地版本、来源 agent、包根路径、校验状态和服务端存在状态。
- 通过 `GET /api/v1/client/skills` 按 SKILL 名称对比服务端，而不是按本地目录路径或远端
  skill ID 对比。
- 只为服务端响应中缺失同名 SKILL 的有效本地 SKILL 显示【上传】操作。
- 上传时由主进程把本地 SKILL 目录打成 ZIP，并通过 API Token 调用
  `POST /api/v1/client/skills/upload`。
- 所有文件系统读取、ZIP 创建、API Token 使用和网络上传都留在 Electron 主进程。
- 上传成功后刷新“本地 SKILL”列表，让该行从“服务端缺失”变为“服务端已存在”。

## 非目标

- 不做自动上传、后台上传或批量上传。
- 不在应用内编辑本地 SKILL 文件。
- 不删除本地或服务端 SKILL。
- 不在该视图里为服务端已存在的 SKILL 做版本管理。给已有服务端 SKILL 追加版本属于后续
  独立流程。
- 不写入 agent 技能目录。本地发现过程只读。
- 不把本地 SKILL 库存持久化到 SQLite 或配置 JSON。
- 不改变 API Token 启动、RBAC 或后端上传语义。
- 不使用浏览器 JWT Session 的 Console API 路由。

## 支持的 Agent

该能力复用现有 catalog 驱动的 agent 检测表面。支持的 agent ID 和显示名以
`../references/runtime-and-storage-surface.md` 与
`../../src/adapters/agents/definitions.ts` 为准。

首版必须覆盖当前 catalog 中的全部 ID：`claude-code`、`cursor`、`windsurf`、
`copilot`、`roocode`、`cline`、`gemini-cli`、`codex`、`opencode`、`kilocode`、
`amp`、`kiro`、`warp`、`trae`、`factory`、`kimi`、`mistral`、`pi`、`antigravity`、
`openclaw`。

## 核心产品规则

- 服务端状态仍然是服务端可见性和远端版本的事实来源。
- 本地库存只是只读快照，直到操作员点击【上传】才会产生上传动作。
- 本地 SKILL 没有远端 skill ID，除非服务端存在同名 SKILL。
- 本地目录名不是远端身份。规范的对比键是根路径 `SKILL.md` 中通过校验的 SKILL 名称。
- 服务端已存在的 SKILL 在本 v1 中不显示上传控件，即使本地版本不同。
- 本地重复副本允许出现在库存中。行表示唯一的本地包根目录，并展示共享物理目标覆盖的
  所有来源 agent。
- 扫描前按规范化路径对共享 agent 物理目标去重，与现有检测和分发规则一致。
- 当包根无效、缺少 `SKILL.md`、SKILL 名称不安全、目录不可读或 API Token 缺少上传权限时，
  上传必须失败关闭。

## 本地 SKILL 身份与匹配

### 本地包根目录

本地包根目录是有效 agent 技能目标目录的直接子目录。只有包含根路径 `SKILL.md` 的目录才被
视为有效。

库存可以显示无效子目录，但必须清楚标记无效原因，并且不能显示【上传】。

### 本地 SKILL 名称

SKILL 名称从根路径 `SKILL.md` frontmatter 中读取。它必须满足桌面端文件系统操作和后端
上传校验一致的安全名称预期：

- trim 后非空
- 不包含 `/` 或 `\`
- 不是 `.` 或 `..`
- 不包含路径穿越片段
- 不以点开头
- 不超过后端 SKILL 名称长度限制

如果 `SKILL.md` 缺少可用名称，该行是无效状态，不可上传。

### 服务端存在状态

主进程获取 `GET /api/v1/client/skills`，并按服务端 skill `name` 建立查找表。

服务端存在状态：

| 状态 | 含义 | 上传 |
|------|------|------|
| `existing` | 服务端存在同名 SKILL | 隐藏 |
| `missing` | 服务端不存在同名 SKILL | 本地包有效时显示 |
| `unknown` | 服务端列表失败或认证/配置不可用 | 隐藏 |
| `invalid-local` | 本地根目录无法安全上传 | 隐藏 |

当本地行是 `existing` 时，展示远端 skill ID 和最新远端版本作为辅助信息。不要把远端
skill ID 作为本地行 key。

## 上传行为

只有本地包有效且服务端状态为 `missing` 的行可以上传。

上传流程：

```text
操作员点击【上传】
  -> renderer 使用本地行 key 调用 typed IPC
  -> 主进程重新校验被选中的本地包根目录
  -> 主进程创建包含根 SKILL.md 与包内容的 ZIP
  -> 主进程用 multipart/form-data POST 到 /api/v1/client/skills/upload
  -> 主进程删除临时上传产物
  -> renderer 刷新本地库存和服务端存在状态
```

请求规则：

- Endpoint：`POST /api/v1/client/skills/upload`
- Auth：使用现有 secret store/runtime config 中的 API Token Bearer Token
- Content type：`multipart/form-data`
- 字段：
  - `file`：ZIP 包
  - `visibility`：`private`
- v1 不发送 `skill_uuid`，因为该视图只创建服务端缺失的 SKILL。
- 创建模式不发送 `metadata`。后端从 ZIP 根路径 `SKILL.md` 创建 SKILL。

主进程必须在成功或失败后删除临时 ZIP 文件。

## UI 规范

### 导航

在“首页”和“更新”之间新增“本地 SKILL”导航项。首屏就是可用的库存表格，不做说明型
落地页。

### 本地 SKILL 视图

视图使用现有桌面端 UI 模式展示紧凑库存表格或列表：

- SKILL 名称
- 本地版本；可从 `SKILL.md` frontmatter 或支持的元数据读取器获取时展示
- 来源 agent，使用 catalog 显示名
- 本地包根路径，截断但可查看
- 服务端状态
- 服务端已存在时展示远端版本和远端 ID
- 行操作

### 操作与状态

- 【刷新】：重新扫描本地库存并查询服务端存在状态。
- 【上传】：只对有效且服务端缺失的行显示。
- 【上传中】：禁用该行操作，防止重复上传。
- 【已上传】：显示成功反馈，然后刷新库存。
- 【本地 SKILL 无效】：展示校验原因，不显示上传控件。
- 【服务端不可用】或【缺少 Token】：服务端状态为 unknown，不显示上传控件。
- 【点击后名称冲突】：如果其他上传或服务端变更在本次上传完成前创建了同名 SKILL，
  展示后端冲突并刷新。

## 架构边界

- Renderer UI 只展示快照并调用 typed IPC。
- Preload 只暴露本地 SKILL 库存刷新和上传方法；绝不暴露文件系统或 token 原语。
- Electron 主进程负责：
  - 读取 agent detection 快照
  - 扫描技能目标目录
  - 读取根路径 `SKILL.md`
  - 校验本地包根目录
  - 创建并删除临时 ZIP
  - 调用 Client API 列表和上传路由
- 库存快照只是 renderer 临时状态，不写入 `state.sqlite3`、`state.json`、配置 JSON 或 agent
  目录。
- 现有 sync state 仍然只表示远端分发状态，不能复用为本地库存存储。

## 安全要求

- Renderer 不能收到原始 API Token、本地文件内容、ZIP 字节或临时上传路径。
- IPC 上传输入必须是最新主进程快照中的稳定本地行 key，不能是 renderer 任意传入的文件系统路径。
- 主进程在创建 ZIP 前必须立即重新校验被选中的包根目录。
- ZIP 创建必须拒绝路径穿越、不安全名称、逃逸包根的符号链接、缺少根路径 `SKILL.md`、不可读文件，
  以及会超过后端上传约束的大小/数量。
- 上传只使用 Client API 路由和 API Token 认证。
- 临时上传产物创建在 runtime cache 或操作系统临时目录下，并在成功或失败后清理。

## 验收标准

- “本地 SKILL”出现在“首页”和“更新”之间。
- 视图列出所有检测/配置到的 agent 目标中的本地 SKILL 包根，并按覆盖 agent 展示共享物理目标。
- 有效本地 SKILL 按 SKILL 名称展示服务端存在状态。
- 服务端已存在的 SKILL 不显示【上传】。
- 服务端缺失的有效本地 SKILL 显示【上传】。
- 无效本地项展示不可上传原因。
- 点击服务端缺失本地 SKILL 的【上传】后，通过 `POST /api/v1/client/skills/upload` 创建服务端
  SKILL，并刷新该行到服务端已存在状态。
- 缺少 token、token 无效、缺少 `skill.upload` 权限、网络失败、ZIP 无效、名称重复和后端校验
  错误都能以不同的操作员可理解状态展示。
- 扫描和上传过程中不修改本地 SKILL 文件。
- 原始 token、文件内容和上传 ZIP 字节不会进入 renderer state 或日志。

## 参考

- API 契约：`../references/client-api-contract.md`
- 运行时和存储表面：`../references/runtime-and-storage-surface.md`
- Agent 检测：`../design-docs/agent-detection-and-distribution.md`
- 技术设计：`../design-docs/local-skills-management.md`
