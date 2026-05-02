# 桌面客户端打包

状态：规范本地产品文档，待实现

## 目的

使桌面客户端能够打包成分发用的 Windows 和 macOS 安装包。操作者应该能够为 Windows 构建 `.exe` 安装包，为 macOS 构建 `.dmg` 安装包，两者安装的应用都具备正确的图标、启动行为和系统托盘驻留，支持后续自动升级。

## 目标

- 添加 `electron-builder` 作为打包工具链。
- 配置针对 Windows x64 的 NSIS 安装程序输出。
- 配置针对 macOS 的 DMG 安装程序输出（x64 + arm64 通用）。
- 配置正确的应用元数据：应用名称、版本、描述、发布者、版权信息。
- 使用现有的 `resources/icons/icon.ico` 作为 Windows 应用图标，并添加 macOS 图标。
- 配置单实例锁定（已实现，保留）。
- 配置系统托盘驻留和启动行为。
- 添加用于两个平台构建安装包的 npm 脚本。
- 在 `README.md` 中记录打包工作流程。
- 保持所有现有运行时行为不变。

## 非目标

- v1 不包含自动更新服务器或自动更新 UI（后续范围）。
- v1 不包含 Linux 打包目标（仅 Windows + macOS）。
- v1 不包含代码签名或证书管理。
- 不改变运行时功能或 UI。
- 不改变现有的构建工作流程（`npm run build` 继续按原样工作）。
- 不改变代理检测、技能分发或本地技能管理。

## 打包输出

### 安装包产物

| 平台 | 产物 | 路径 | 用途 |
|------|------|------|------|
| Windows | NSIS 安装包 | `dist/*.exe` | 单文件 Windows 安装包 |
| Windows | 便携版构建 | `dist/win-unpacked/` | 解压缩的便携目录 |
| macOS | DMG 安装包 | `dist/*.dmg` | macOS 磁盘镜像安装包 |
| macOS | ZIP 归档 | `dist/*.zip` | 用于自动更新的 macOS ZIP 归档 |
| macOS | App 包 | `dist/mac/` | 解压缩的 macOS `.app` 包 |

### 应用元数据

- 名称：`SkillDrive Desktop`
- AppId：`com.openskillhub.skilldrive-desktop`
- 版本：来自 `package.json`
- 描述：Open SkillHub 桌面同步客户端
- 发布者：Open SkillHub
- 版权：Open SkillHub contributors

## 安装行为

### Windows 安装程序

- 带有默认安装向导的标准 NSIS 安装程序。
- 默认安装到 `%LOCALAPPDATA%/Programs/SkillDrive Desktop`。
- 创建桌面快捷方式。
- 创建开始菜单项。
- 在添加/删除程序中添加卸载条目。
- 在首次运行时保持单实例锁定。

### macOS 安装程序

- 带有拖放安装到应用程序的标准 DMG 磁盘镜像。
- `.app` 包安装到 `/Applications/SkillDrive Desktop.app`。
- 首次启动时将应用添加到 Dock（可选，用户可配置）。
- 在首次运行时保持单实例锁定。

### 安装后的运行时

- 应用程序在两个平台上的行为与开发模式完全相同。
- 系统托盘驻留保持不变。
- 配置和状态存储在特定于平台的用户数据目录中：
  - Windows：`%APPDATA%/skilldrive-desktop`
  - macOS：`~/Library/Application Support/skilldrive-desktop`
- 现有的 `SKILLDRIVE_*` 环境变量仍然可以用于配置。

## 构建工作流程

### 新增 npm 脚本

| 脚本 | 用途 |
|------|------|
| `npm run build` | 现有构建（不变） |
| `npm run pack` | 为当前平台构建未打包目录 |
| `npm run dist` | 为当前平台构建完整安装包 |
| `npm run dist:win` | 构建 Windows 安装包（在 Windows 或跨平台） |
| `npm run dist:mac` | 构建 macOS 安装包（需要 macOS） |

### 打包配置

- `electron-builder` 配置在 `package.json` 中。
- 使用现有的 `resources/icons/icon.ico` 作为 Windows 应用图标。
- 在 `resources/icons/icon.icns` 添加 macOS 图标。
- 为 Windows x64 配置 `nsis` 目标。
- 为 macOS 配置 `dmg` 和 `zip` 目标（通用 x64 + arm64）。
- 配置 `directories.output` 为 `dist/`。
- 配置 `files` 包含构建的渲染器和 Electron 主进程产物。
- 如需图标配置 `extraResources`。
- 为 Windows 和 macOS 配置平台特定的设置。

## 验收标准

- `npm run dist:win` 在 Windows 上无错误完成。
- `dist/` 目录包含 Windows `.exe` 安装包。
- Windows 安装程序运行并正确安装。
- 安装的 Windows 应用正确启动。
- `npm run dist:mac` 在 macOS 上无错误完成。
- `dist/` 目录包含 macOS `.dmg` 安装包。
- macOS DMG 打开并拖放安装正常工作。
- 安装的 macOS 应用正确启动。
- 单实例锁定在两个平台上正常工作。
- 系统托盘驻留在两个平台上正常工作。
- 所有现有功能在两个平台上保持不变。
- `npm run build` 仍然适用于开发。
- `npm run start:electron` 仍然适用于开发。
- `npm test` 仍然通过。

## 参考

- 现有架构：`../ARCHITECTURE.md`
- Electron 主进程：`../../electron/main.ts`
- 运行时配置：`src/core/storage/config-store.ts`
