# 桌面客户端

SkillDrive 的 Electron + Vite 桌面端应用。

## 快速链接

- `AGENTS.md`
- `task-tracker.md`
- `docs/ARCHITECTURE.md`
- `docs/design-docs/core-beliefs.md`
- `docs/SECURITY.md`
- `docs/product-specs/2026-04-17-skill-distribution-v1.md`
- `docs/references/index.md`
- `docs/generated/state-db-schema.md`
- `docs/exec-plans/index.md`
- `docs/exec-plans/tech-debt-tracker.md`

## 本地运行

```bash
cd desktop-client
npm install
npm test
npm run build
npm run dev
npm run start:electron
```

`npm run dev` 仅启动 Vite 渲染器。`npm run start:electron` 是完整的桌面端运行时启动命令：它会构建渲染器、构建 Electron main/preload 模块，并从 `dist-electron/main.js` 启动 Electron。`npm run build` 是验证渲染器、Electron TypeScript 代码和 Electron 运行时模块的标准路径。

Electron 主进程在本地开发时读取以下环境变量：

- `SKILLDRIVE_API_BASE_URL` - 后端基础 URL，例如 `http://127.0.0.1:8001`
- `SKILLDRIVE_API_TOKEN` - 可选的首次运行 API Token 引导；当密钥存储为空时，运行时会通过 `keytar` 存储此值，然后从密钥存储中读取 Token
- `SKILLDRIVE_POLL_INTERVAL_MS` - 可选的轮询间隔（毫秒），默认为 `30000`
- `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` - 可选的当前会话下载解密密钥；仅当后端 `ENABLE_SKILL_DOWNLOAD_ENCRYPTION=true` 时，将它设置为后端 `SECRET_KEY`
- `SKILLDRIVE_CODEX_SKILLS_PATH` - 可选的 Codex 技能目录覆盖
- `SKILLDRIVE_CLAUDE_CODE_SKILLS_PATH` - 可选的 Claude Code 技能目录覆盖
- `SKILLDRIVE_GEMINI_CLI_SKILLS_PATH` - 可选的 Gemini CLI 技能目录覆盖

**关于技能下载的加密说明**：当 `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` 存在于 Electron 主进程环境变量中，并且与后端用于下载加密的 `SECRET_KEY` 一致时，桌面运行时可以分发加密下载包。该密钥不会写入 JSON 配置、渲染器状态或日志。如果后端开启了加密下载，但该密钥缺失或不匹配，分发会在解压或写入 Agent 目录前安全失败。

如果 `keytar` 不可用，`SKILLDRIVE_API_TOKEN` 仍可用于当前会话，但不会持久化。API Token 不得存储在明文配置、渲染器状态或日志中。

窗口关闭后，系统托盘保持驻留，以便后台刷新继续进行。

## 打包

Windows 安装包打包通过 `electron-builder` 配置。v1 发布目标是 Windows 安装包路径；macOS 构建配置可能存在用于探索性构建，但在非 Windows 包提取和冒烟测试实现之前，macOS 运行时分发不能作为发布声明。

```bash
cd desktop-client
npm install
npm run build
npm run dist:win
```

Windows 发布产物写入 `dist/` 目录，包括 `.exe` NSIS 安装程序和 `win-unpacked/` 用于冒烟测试。`dist/` 是生成的本地输出，不应提交。

其他已配置的打包脚本：

- `npm run pack` - 构建当前平台的解压输出
- `npm run dist` - 构建当前平台的安装包输出
- `npm run dist:mac` - macOS 打包命令；发布使用需要 macOS 操作手册、Developer ID 签名、公证、装订、Gatekeeper 和冒烟验证

macOS 发布准备位于 `docs/product-specs/2026-05-03-macos-release-packaging.md`，操作手册位于 `docs/references/macos-release-runbook.md`（[中文版](docs/references/macos-release-runbook-zh.md)）。

## 当前功能范围

- 轮询后端以获取可审核的技能更新
- 显示托盘工具提示状态和桌面通知，不自动分发
- 将已审核的技能下载并分发到所有检测到的 Agent 目标
- 保持渲染器隔离在 Electron preload 桥接层之后
- 提供 Vitest 测试路径和生产构建路径

## 核心文档

- 桌面客户端核心文档位于 `desktop-client/docs/`
- 之前存放在 `docs/superpowers/` 的历史头脑风暴和实施计划草案已废弃

---

## 手动测试指南

本节引导你完成本地手动测试桌面客户端的完整端到端体验，从首次启动到技能分发。

### 前置条件

1. **后端运行中**：SkillDrive 后端必须可访问。启动方式：
   ```bash
   uv run uvicorn backend.api_app:app --host 0.0.0.0 --port 8001
   ```
   或通过 Docker：
   ```bash
   docker compose up -d api
   ```

2. **API Token**：需要从后端获取有效的 Bearer Token。可通过 Web 控制台登录或后端 API 获取。

3. **Node.js**：确保已安装 Node.js 18+。

4. **依赖已安装**：在 `desktop-client/` 目录下运行 `npm install`。

### 步骤 1：首次启动

打开终端并启动完整的桌面端运行时：

```bash
cd desktop-client
npm run start:electron
```

Electron 窗口将打开。首次启动时你会看到：

- **主页视图**，标题为 "Review updates"（审核更新）
- 一条警告提示：**"API token needed"**（需要 API Token）—— 审核同步已暂停，直到保存配置
- 三个指标卡片显示：待处理更新 (0)、本地记录 (0)、最后刷新（"Not refreshed yet"）
- "Needs review"（需要审核）区域显示 "No pending updates are waiting for review."（没有待审核的更新）
- Windows 任务栏出现系统托盘图标

### 步骤 2：配置 API 连接

1. 点击标题栏中的 **"Settings"** 按钮（或警告提示中的 "Configure API" 按钮）。

2. 设置面板从右侧滑出。你会看到：
   - **Bridge status**（桥接状态）卡片，显示连接状态
   - **Configuration**（配置）卡片，包含两个字段：
     - **API Base URL**：预填 `http://127.0.0.1:8001`
     - **API Token**：空的密码输入框

3. 填写字段：
   - **API Base URL**：输入你的后端 URL（如 `http://127.0.0.1:8001`）
   - **API Token**：粘贴你的 Bearer Token

4. **测试连接**（可选但推荐）：
   - 点击 **"Test connection"**
   - 表单下方会显示成功或错误消息
   - 成功表示 URL 可达且 Token 已被接受

5. **保存配置**：
   - 点击 **"Save configuration"**
   - 面板中会显示 "Configuration saved" 的活动记录
   - 应用会在保存后自动触发一次审核同步

6. 点击关闭按钮或面板外部来关闭设置面板。

### 步骤 3：验证同步状态

保存配置后，主页视图会自动刷新：

- **Pending updates**（待处理更新）指标显示等待审核的技能数量
- **Local records**（本地记录）指标显示之前已分发的技能
- **Last refresh**（最后刷新）显示最新同步的时间戳
- 标题栏徽章更新为 `N pending`
- **Activity panel**（活动面板，在设置中）记录 "Review snapshot loaded"

如果有待处理的更新，它们会出现在 **"Needs review"** 卡片中：
- 技能名称和 ID
- 本地版本 vs 远程版本徽章
- 原因徽章（如 "new"、"version update"）
- 每个项目一个 **"Distribute"** 按钮

### 步骤 4：审核并分发技能

1. 在主页视图中，在 "Needs review" 卡片中找到一个待处理更新。

2. 点击你想安装的技能旁边的 **"Distribute"**。

3. 按钮变为 **"Distributing..."**，操作正在运行。

4. 分发完成后：
   - 该技能从待处理列表中移除
   - 活动面板记录 "Distribution completed"（成功）或 "Distribution completed with warnings"（部分失败）
   - 本地记录指标增加
   - 待处理更新指标减少

5. 要查看所有待处理更新（不仅仅是前 3 个），点击 **"View all updates"** 或切换到标题导航中的 **Updates** 标签。

### 步骤 5：导航视图

标题栏包含两个导航按钮：

- **Home**（主页）：概览仪表板，显示待处理更新预览和快捷操作
- **Updates**（更新）：所有待处理更新的完整队列，每个都有单独的分发按钮

在两个视图之间切换，验证两者都能正确渲染。

### 步骤 6：检查 Agent 目标

打开设置面板并滚动到 **Agents** 面板：

- 列出支持的分发目标：**Claude Code**、**Codex**、**Gemini CLI**
- 显示每个 Agent 技能目录的检测状态
- 此面板仅用于信息展示，没有交互控件

### 步骤 7：查看活动历史

在设置面板中，**Activity** 面板显示最近的事件：

- **Neutral**（中性）条目：信息消息（如 "Console ready"、"Review snapshot loaded"）
- **Success**（成功）条目：已完成的操作（如 "Configuration saved"、"Distribution completed"）
- **Warning**（警告）条目：问题或失败（如 "Refresh failed"、"Distribution failed"）

每个条目显示标题、详情文本和时间戳。

### 步骤 8：手动刷新状态

- 点击标题栏中的 **"Refresh"** 按钮
- 或点击主页视图中的 **"Refresh state"**
- 应用会重新轮询后端并更新待处理队列
- 最后刷新时间戳会更新

### 步骤 9：清除配置（重置）

要将客户端重置为未配置状态：

1. 打开设置面板
2. 滚动到 **Configuration status**（配置状态）部分
3. 点击 **"Clear configuration"**
4. Token 从密钥存储中移除
5. 应用返回到 "API token needed" 状态
6. 设置面板自动打开以便重新配置

### 步骤 10：窗口关闭与托盘行为

- **关闭窗口**（点击 X 按钮）：窗口关闭，但应用保留在系统托盘中
- **后台轮询继续**：托盘图标保持活跃并继续轮询后端
- **重新打开窗口**：点击托盘图标恢复窗口
- **完全退出应用**：右键点击托盘图标并选择 Quit（或使用上下文菜单）

### 步骤 11：环境变量引导（可选）

使用环境变量进行自动化的首次运行设置：

```powershell
$env:SKILLDRIVE_API_BASE_URL = "http://127.0.0.1:8001"
$env:SKILLDRIVE_API_TOKEN = "your-token-here"
$env:SKILLDRIVE_POLL_INTERVAL_MS = "15000"
npm run start:electron
```

Token 在首次启动时存储在 `keytar` 密钥存储中。后续启动从密钥存储中读取，因此无需重新输入凭据。

### 步骤 12：纯渲染器开发（可选）

在不启动完整 Electron 运行时的情况下进行更快的 UI 迭代：

```bash
cd desktop-client
npm run dev
```

这仅启动 React 渲染器的 Vite 开发服务器。桌面桥接将不可用，因此 UI 会显示 "Desktop bridge unavailable" 警告。这是预期行为 —— 完整集成测试请使用 `npm run start:electron`。

### 故障排查

| 症状 | 可能原因 | 解决方法 |
|------|---------|---------|
| "Desktop bridge unavailable" | 运行了 `npm run dev` 而非 `npm run start:electron` | 使用 `npm run start:electron` 启动完整运行时 |
| 保存配置后仍显示 "API token needed" | 后端不可达或 Token 无效 | 点击 "Test connection" 诊断 |
| "Refresh failed" 错误 | 后端未运行或网络问题 | 验证后端在配置的 URL 上运行 |
| 所有 Agent 分发失败 | 未检测到 Agent 技能目录 | 检查本地是否安装了 Codex/Claude Code/Gemini CLI |
| 加密包解密失败 | `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` 缺失，或与后端 `SECRET_KEY` 不一致 | 为当前 Electron 会话设置该环境变量，或在本地开发时关闭后端下载加密 |
| 托盘图标缺失 | Electron 启动失败 | 检查终端输出中的错误信息 |
| `keytar` 在 Windows 上构建错误 | 缺少原生模块的构建工具 | 安装 Visual Studio Build Tools 并包含 C++ 工作负载 |

### 验证命令

```bash
# 运行测试
npm test

# 以监视模式运行测试
npm run test:watch

# 类型检查 Electron 代码
npm run typecheck:electron

# 完整构建（渲染器 + Electron）
npm run build

# 后端 API 测试（从仓库根目录）
uv run pytest tests/test_client_skills_api.py -q
```
