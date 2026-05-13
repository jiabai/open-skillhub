# Linux CLI 部署指南

状态：已实施（2026-05-13）
适用范围：`desktop-client/`

## 目的

本文档描述如何将 `skilldrive-agent` CLI 工具通过 npm 全局安装方式部署到 Linux 目标机器上。

`skilldrive-agent` 是一个纯 Node.js ESM 命令行工具，用于在 Linux 上将 SkillDrive 技能分发到各 AI Agent 的技能目录中。它不依赖 Electron，与桌面应用共享核心领域代码，但使用独立的 XDG 配置、状态和缓存目录。

## 相关文档

- 产品规格：`docs/product-specs/2026-05-13-linux-cli-distribution.md`
- 技术设计：`docs/design-docs/linux-cli-distribution.md`
- 实施计划：`docs/exec-plans/completed/2026-05-13-linux-cli-distribution.md`
- 运行时与存储面：`docs/references/runtime-and-storage-surface.md`

## 前置条件

### 构建机器（开发机）

- Node.js 18+
- npm 9+
- 已克隆的 SkillDrive 仓库

### Linux 目标机器

- Linux 发行版（x86_64 或 arm64）
- Node.js 18+
- npm 9+

验证 Node.js 版本：

```bash
node --version
npm --version
```

## 部署步骤

### 步骤 1：构建 CLI 产物

在开发机上执行构建：

```bash
cd desktop-client
npm install
npm run build:cli
```

构建完成后，产物位于 `dist-cli/skilldrive-agent.js`。该文件是 Vite 打包后的独立 Node.js ESM 脚本，包含 shebang（`#!/usr/bin/env node`），所有运行时依赖已内联。

### 步骤 2：将 desktop-client 目录传输到 Linux 目标机器

将整个 `desktop-client/` 目录拷贝到目标机器。由于 npm 全局安装需要 `package.json`，因此不能只拷贝 `dist-cli/` 单个文件。

```bash
# 示例：通过 scp 传输
scp -r desktop-client/ user@linux-host:/opt/skilldrive/

# 或通过 rsync（排除不需要的目录）
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude 'dist-electron' \
  desktop-client/ user@linux-host:/opt/skilldrive/
```

### 步骤 3：在 Linux 目标机器上安装依赖并构建

```bash
cd /opt/skilldrive
npm install --production
npm run build:cli
```

`--production` 标志跳过 devDependencies（测试框架、TypeScript 类型检查等），仅安装运行时必需的依赖。CLI 运行时依赖为 `commander`、`sql.js` 和 `extract-zip`，这些已在 Vite 构建时内联到产物中，因此 `--production` 安装主要用于满足 npm 的包完整性检查。

### 步骤 4：npm 全局链接

```bash
cd /opt/skilldrive
npm link
```

`npm link` 会创建一个全局符号链接，将 `skilldrive-agent` 命令注册到系统 PATH 中。此后可以在任意目录直接使用 `skilldrive-agent` 命令。

验证安装：

```bash
which skilldrive-agent
skilldrive-agent --help
```

预期输出应显示命令名称、描述和可用子命令（`detect`、`install`、`sync`、`config`）。

### 步骤 5（可选）：配置 API 地址

如果使用 `sync` 命令从 SkillDrive 服务器同步技能，需要配置后端 API 地址：

```bash
skilldrive-agent config set api-base-url http://your-server:8001
```

验证配置：

```bash
skilldrive-agent config show
```

API token 不应通过 `config` 持久化，每次调用 `sync` 时通过 `--api-token` 选项或 `SKILLDRIVE_API_TOKEN` 环境变量传入。

## 验证部署

### 检测 Agent 目标

```bash
skilldrive-agent detect --global
```

该命令会扫描系统中已安装的 AI Agent（如 Claude Code、Cursor、Gemini CLI 等），报告可写入的技能目标目录。加上 `--json` 可获得机器可读输出：

```bash
skilldrive-agent detect --global --json
```

### 本地安装技能

```bash
# 从目录安装（全局）
skilldrive-agent install /path/to/skill-directory --global --yes

# 从 zip 安装（项目级）
skilldrive-agent install /path/to/skill.zip --project /path/to/project --yes
```

建议先不加 `--yes` 执行一次 dry-run 预览计划，确认无误后再加 `--yes` 实际写入。

### 服务器同步

```bash
SKILLDRIVE_API_TOKEN=your-token skilldrive-agent sync --global --yes
```

## CLI 存储路径

CLI 使用 XDG 基础目录规范，与桌面应用完全隔离：

| 用途 | 路径 |
|------|------|
| 配置文件 | `$XDG_CONFIG_HOME/skilldrive-cli/config.json` |
| Agent 路径覆盖 | `$XDG_CONFIG_HOME/skilldrive-cli/agent-paths.json` |
| 同步状态数据库 | `$XDG_STATE_HOME/skilldrive-cli/state.sqlite3` |
| 包缓存 | `$XDG_CACHE_HOME/skilldrive-cli/package-*` |

默认回退路径（当 XDG 环境变量未设置时）：

| XDG 变量 | 默认值 |
|----------|--------|
| `$XDG_CONFIG_HOME` | `~/.config` |
| `$XDG_STATE_HOME` | `~/.local/state` |
| `$XDG_CACHE_HOME` | `~/.cache` |

查看当前解析的路径：

```bash
skilldrive-agent config paths
```

## 环境变量

CLI 运行时读取以下环境变量：

| 变量 | 用途 |
|------|------|
| `SKILLDRIVE_API_BASE_URL` | API 基础 URL 覆盖（优先级低于 `config set`） |
| `SKILLDRIVE_API_TOKEN` | 当前调用的 API token（不会被持久化） |

## 升级

当 SkillDrive 仓库有新版本时，在开发机上重新构建并传输到目标机器：

```bash
# 开发机
cd desktop-client
git pull
npm install
npm run build:cli

# 传输到目标机器
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude 'dist-electron' \
  desktop-client/ user@linux-host:/opt/skilldrive/

# 目标机器
cd /opt/skilldrive
npm install --production
npm run build:cli
```

由于 `npm link` 创建的是符号链接，重新构建 `dist-cli/skilldrive-agent.js` 后无需重新 link。

## 卸载

```bash
cd /opt/skilldrive
npm unlink -g
```

此命令会移除全局的 `skilldrive-agent` 符号链接。如需清理 CLI 产生的数据：

```bash
rm -rf ~/.config/skilldrive-cli
rm -rf ~/.local/state/skilldrive-cli
rm -rf ~/.cache/skilldrive-cli
```

## 故障排除

### `skilldrive-agent: command not found`

确认 npm 全局 bin 目录在 PATH 中：

```bash
npm bin -g
echo $PATH
```

如果不在 PATH 中，将 npm 全局 bin 目录添加到 shell 配置文件（`~/.bashrc` 或 `~/.zshrc`）：

```bash
export PATH="$(npm bin -g):$PATH"
```

### `Error: Cannot find module`

确认已执行 `npm install --production` 和 `npm run build:cli`。如果问题仍然存在，尝试完整安装：

```bash
cd /opt/skilldrive
rm -rf node_modules
npm install
npm run build:cli
```

### 加密下载返回退出码 5

CLI v1 不支持加密的服务器下载。如果服务端启用了技能包加密，CLI 会在写入文件系统前以退出码 5 失败关闭。请联系管理员确认服务端加密配置。

### 权限不足

CLI 需要对 Agent 技能目录的写入权限。确保运行 CLI 的用户对目标目录（如 `~/.claude/skills`、`~/.cursor/skills` 等）有读写权限。