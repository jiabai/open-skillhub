# 本地 SKILL 管理

状态：规范的本地产品规范

## 目的

构建一个管理界面，允许操作员查看所有本地探测到的 SKILL，识别那些服务端不存在的 SKILL，并在需要时将它们上传到服务端。

## 目标

- 提供一个专门的视图用于显示所有本地探测到的 SKILL
- 为每个 SKILL 指示它是否在服务端存在
- 为仅存在于本地的 SKILL 添加【上传】按钮
- 保持与现有 UI 模式的一致性
- 复用现有的代理探测基础设施

## 非目标

- 应用内 SKILL 编辑功能
- 无明确用户操作的自动上传到服务端
- 批量上传操作
- 从服务端删除 SKILL
- 服务端的 SKILL 版本管理

## 支持的代理

- Claude Code
- Cursor
- Windsurf
- GitHub Copilot
- RooCode
- Cline
- Gemini CLI
- Codex
- OpenCode
- KiloCode
- Amp
- Kiro
- Warp
- Trae
- Factory
- Kimi Code CLI
- Mistral Le Chat
- Pi Coding Agent
- Antigravity
- OpenClaw

## 核心产品规则

- 服务端仍然是 SKILL 可见性和版本的事实来源
- 本地 SKILL 仅用于感知和可选上传
- 上传操作必须是明确的用户操作
- 服务端已存在的 SKILL 不应显示任何上传控件
- 应复用现有的代理探测基础设施来查找本地 SKILL

## 本地 SKILL 显示机制

### 定义

本地 SKILL 管理指的是一个界面，用于显示当前存在于本地代理安装中的所有 SKILL，指示它们在服务端的存在状态，并为服务端缺失的 SKILL 提供上传功能。

### 理由

**可见性**
- 操作员需要查看他们本地安装了哪些 SKILL
- 防止意外丢失自定义的本地 SKILL
- 提供 SKILL 库存的感知

**上传能力**
- 操作员可能希望将他们的自定义 SKILL 分享到服务端
- 上传是一个明确的操作，确保没有无意的分享
- 只有服务端不存在的 SKILL 才显示上传按钮

### 显示流程

```
从代理探测本地 SKILL → 查询服务端确认存在性 → 显示列表并带有状态指示器 → 为缺失的 SKILL 显示上传按钮
```

## UI 规范

### 新的导航项

在主导航栏中将添加一个新的导航项 "Local Skills"（中文："本地 SKILL"），位置在 "Home"（中文："首页"）和 "Updates"（中文："更新"）之间。

### 本地 SKILL 视图

新视图将显示：

**SKILL 列表**
- SKILL 名称（主要显示）
- SKILL ID（次要信息）
- 代理来源（从哪个代理安装中找到的 SKILL）
- 服务端存在性指示器（存在 / 缺失）

**上传按钮**
- 仅对服务端**不存在**的 SKILL 可见
- 定位在 SKILL 条目旁边
- 点击时启动上传过程
- 上传期间显示忙碌状态

**空状态**
- 当没有找到本地 SKILL 时显示
- 提供关于 SKILL 探测的有用信息

## 预期用户体验

- 操作员可以一目了然地查看所有本地安装的 SKILL
- 操作员可以轻松识别哪些 SKILL 在服务端缺失
- 上传过程简单明了，有清晰的反馈
- 界面感觉与现有视图一致

## 架构边界

- 渲染器 UI：显示 SKILL 列表和上传控件
- IPC 桥接：处理渲染器和主进程之间的通信
- Electron 主进程：
  - 复用现有的 AgentDetectionService 查找本地 SKILL
  - 通过 API 查询服务端确认 SKILL 存在性
  - 处理上传操作（如果实现）
  - 管理 SKILL 包准备的文件系统访问

## 安全要求

- 不向渲染器进程暴露密钥
- 上传操作必须在传输前验证 SKILL 包
- SKILL 包文件的路径验证
- API 令牌管理遵循现有模式

## 参考

- API 契约：`../references/client-api-contract.md`
- 运行时和存储表面：`../references/runtime-and-storage-surface.md`
- 代理探测：`../design-docs/agent-detection-and-distribution.md`
