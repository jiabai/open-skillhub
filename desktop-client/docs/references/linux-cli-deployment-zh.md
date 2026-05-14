# Linux CLI 包化部署方案

状态：打包脚本已实施；Linux 目标机安装验证待执行（2026-05-14）
适用范围：`desktop-client/`

## 目的

本文档设计 Linux 系统下 `skilldrive-cli` CLI 的部署方式。目标是从当前
"拷贝 `desktop-client/`、在目标机器安装 npm 依赖、重新构建、再 `npm link`"
的开发流程，收敛为更适合运维的"发布包 + 部署脚本"流程。

该方案不改变 CLI 的命令能力。`install`、`sync`、`detect`、`config` 的运行时
语义、安全规则、XDG 存储路径和 API token 处理方式仍以现有 Linux CLI
规格为准。

## 相关文档

- CLI 运行时规格：`../product-specs/2026-05-13-linux-cli-distribution.md`
- CLI 运行时设计：`../design-docs/linux-cli-distribution.md`
- 包化部署规格：`../product-specs/2026-05-14-linux-cli-packaged-deployment.md`
- 包化部署技术设计：`../design-docs/linux-cli-packaged-deployment.md`
- 包化部署实施计划：`../exec-plans/active/2026-05-14-linux-cli-packaged-deployment.md`
- 运行时与存储面：`runtime-and-storage-surface.md`

## 设计结论

推荐部署方式：

1. 在发布/构建机器上生成 Linux CLI tarball。
2. tarball 内置 CLI 构建产物、运行时依赖闭包、安装脚本、卸载脚本、manifest
   和 sha256 校验信息。
3. Linux 目标机器只负责校验、解压和执行安装脚本。
4. 安装后通过 PATH 中的 `skilldrive-cli` 使用 CLI。

目标机器不再需要：

- 克隆 SkillDrive 仓库
- 拷贝完整 `desktop-client/`
- 安装 npm 依赖
- 运行 TypeScript/Vite 构建
- 执行 `npm link`

## 前置条件

### 构建机器

- Node.js 20+
- npm
- 已克隆的 SkillDrive 仓库
- 可执行 `desktop-client` 测试和 CLI 构建

### Linux 目标机器

- Linux x86_64 或 arm64
- Node.js 20+
- POSIX shell
- `tar`
- `sha256sum`

验证 Node.js：

```bash
node --version
```

当前 CLI 构建目标是 `node20`，因此目标部署方案默认要求 Node.js 20+。如果未来
要恢复 Node.js 18 支持，必须先调整构建目标并完成对应验证。

## 发布包形态

目标产物：

```text
dist/linux-cli/
  skilldrive-cli-<version>-linux-node20.tar.gz
  skilldrive-cli-<version>-linux-node20.tar.gz.sha256
```

解压后的目录：

```text
skilldrive-cli-<version>-linux-node20/
  manifest.json
  runtime-dependencies.json
  SHA256SUMS
  install.sh
  uninstall.sh
  bin/
    skilldrive-cli
  lib/
    skilldrive-cli.js
    skilldrive-cli.js.map
  node_modules/
    ...
  docs/
    README-zh.md
```

说明：

- `bin/skilldrive-cli` 是同包内 CLI 的轻量启动 wrapper。
- `lib/skilldrive-cli.js` 是 Vite 构建后的 Node ESM CLI 入口。
- `node_modules/` 只包含 CLI 运行所需依赖闭包，例如 `commander`、
  `extract-zip`、`sql.js` 和 `sql.js/dist/sql-wasm.wasm` 所需文件。
- `runtime-dependencies.json` 记录发布包包含的运行时依赖闭包及版本。
- 发布包不得包含 Electron、React、renderer 构建、测试框架、TypeScript 或
  Vite 构建工具。

## 构建发布包

目标命令：

```bash
cd desktop-client
npm ci
npm test
npm run package:linux-cli
```

`package:linux-cli` 是已实施的发布包构建命令，职责包括：

- 运行或校验 `npm run build:cli` 的最新产物。
- 生成 staging 目录。
- 复制 CLI JS 入口和必要 runtime assets。
- 收集 CLI 运行时依赖闭包。
- 生成 `manifest.json` 和 `SHA256SUMS`。
- 从 staging 目录执行冒烟验证。
- 输出 `.tar.gz` 和 `.tar.gz.sha256`。

## 安装流程

下载发布包和校验文件后：

```bash
sha256sum -c skilldrive-cli-<version>-linux-node20.tar.gz.sha256
tar -xzf skilldrive-cli-<version>-linux-node20.tar.gz
cd skilldrive-cli-<version>-linux-node20
```

用户级安装：

```bash
./install.sh --user
```

系统级安装：

```bash
sudo ./install.sh --system
```

安装脚本应打印实际安装路径、命令链接路径和后续验证命令。

## 安装位置

用户级安装：

```text
$XDG_DATA_HOME/skilldrive-cli/releases/<version>/
$XDG_DATA_HOME/skilldrive-cli/current -> releases/<version>
~/.local/bin/skilldrive-cli -> current/bin/skilldrive-cli
```

当 `$XDG_DATA_HOME` 未设置时，回退到：

```text
~/.local/share/skilldrive-cli/releases/<version>/
~/.local/share/skilldrive-cli/current
~/.local/bin/skilldrive-cli
```

系统级安装：

```text
/opt/skilldrive-cli/releases/<version>/
/opt/skilldrive-cli/current -> releases/<version>
/usr/local/bin/skilldrive-cli -> /opt/skilldrive-cli/current/bin/skilldrive-cli
```

程序安装目录与 CLI 数据目录分离。CLI 数据仍使用：

```text
$XDG_CONFIG_HOME/skilldrive-cli/
$XDG_STATE_HOME/skilldrive-cli/
$XDG_CACHE_HOME/skilldrive-cli/
```

默认回退路径仍是：

```text
~/.config/skilldrive-cli
~/.local/state/skilldrive-cli
~/.cache/skilldrive-cli
```

## 安装后验证

```bash
skilldrive-cli --help
skilldrive-cli config paths
skilldrive-cli detect --global
```

如果需要配置 API 地址：

```bash
skilldrive-cli config set api-base-url http://your-server:8001
skilldrive-cli config show
```

API token 不应通过配置文件持久化。同步时通过当前命令参数或环境变量传入：

```bash
SKILLDRIVE_API_TOKEN=your-token skilldrive-cli sync --global --yes
```

## 使用 CLI

检测 Agent 目标：

```bash
skilldrive-cli detect --global
skilldrive-cli detect --global --json
```

本地安装技能：

```bash
skilldrive-cli install /path/to/skill-directory --global
skilldrive-cli install /path/to/skill-directory --global --yes

skilldrive-cli install /path/to/skill.zip --project /path/to/project
skilldrive-cli install /path/to/skill.zip --project /path/to/project --yes
```

建议先不加 `--yes` 预览计划，确认目标和冲突处理无误后再执行写入。

服务端同步：

```bash
SKILLDRIVE_API_TOKEN=your-token skilldrive-cli sync --global
SKILLDRIVE_API_TOKEN=your-token skilldrive-cli sync --global --yes
```

Linux CLI v1 不支持加密服务端下载。服务端返回加密包时，CLI 会在写入文件系统前
以退出码 `5` 安全失败。

## 升级

下载并校验新版本发布包后，重复安装：

```bash
sha256sum -c skilldrive-cli-<new-version>-linux-node20.tar.gz.sha256
tar -xzf skilldrive-cli-<new-version>-linux-node20.tar.gz
cd skilldrive-cli-<new-version>-linux-node20
./install.sh --user
```

系统级安装使用：

```bash
sudo ./install.sh --system
```

升级只切换程序版本，不删除：

- `~/.config/skilldrive-cli/config.json`
- `~/.config/skilldrive-cli/agent-paths.json`
- `~/.local/state/skilldrive-cli/state.sqlite3`
- `~/.cache/skilldrive-cli/`

## 卸载

用户级卸载：

```bash
./uninstall.sh --user
```

系统级卸载：

```bash
sudo ./uninstall.sh --system
```

默认卸载只移除程序文件和 `skilldrive-cli` 命令链接，不删除 CLI 数据。

如需在一次性测试环境中清理 CLI 数据，显式使用：

```bash
./uninstall.sh --user --purge-data
```

`--purge-data` 必须在删除前列出将清理的 XDG 配置、状态和缓存路径。

## 安全规则

- 不推荐 `curl | sh`。
- 先下载发布包和 sha256 文件，校验后再解压执行本地脚本。
- 安装脚本不得读取、接收、打印或保存 API token。
- 安装脚本不得写入任何 Agent 技能目录。
- Agent 技能目录写入只能由 `skilldrive-cli install|sync --yes` 触发。
- 系统级安装必须由操作者显式选择 `sudo ./install.sh --system`。
- 删除路径前必须确认路径位于受管理的安装目录或 CLI XDG 数据目录内。

## 故障排除

### `node` 版本过低

安装脚本应在复制文件前失败，并提示当前版本和最低要求：

```bash
node --version
```

安装脚本不负责安装 Node.js。请使用发行版包管理器、NodeSource、nvm 或组织内部
标准方式安装 Node.js 20+。

### `skilldrive-cli: command not found`

用户级安装时确认 `~/.local/bin` 在 PATH 中：

```bash
echo "$PATH"
ls -l ~/.local/bin/skilldrive-cli
```

如果缺失，将以下内容加入 shell 配置：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### 运行时报缺少 Node 模块

这说明发布包的依赖闭包不完整。不要在目标机器上临时 `npm install` 修复。
应回到构建机器修复 `package:linux-cli` 的打包逻辑，并重新发布 tarball。

### 权限不足

系统级安装需要：

```bash
sudo ./install.sh --system
```

CLI 分发技能时还需要当前运行用户对目标 Agent 技能目录有写入权限。

### 加密下载返回退出码 5

CLI v1 不支持加密服务端下载。如果服务端启用了技能包加密，CLI 会在写入文件系统
前以退出码 `5` 失败关闭。请联系管理员确认服务端加密配置。
