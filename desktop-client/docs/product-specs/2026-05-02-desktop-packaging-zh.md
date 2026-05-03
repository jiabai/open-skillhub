# 桌面客户端 Windows 打包

状态：规范本地产品文档；打包配置已存在，Windows 安装包验证待完成

## 目的

让桌面客户端能够在不改变“先审核、再分发”运行时行为的前提下，产出
Windows 可分发安装包。操作者应该能够从当前 Electron 应用构建 Windows
`.exe` 安装包和未打包目录，完成本地安装，并确认安装后的应用仍然保留单
实例锁定、托盘驻留、API 配置、技能审核和显式分发行为。

当前 v1 发布目标是 Windows。仓库中可以保留 macOS 打包脚本和图标资源，
但在 macOS 发布机器上完成非 Windows 运行时、签名、公证、stapling 和冒烟
测试验证前，macOS 不作为 v1 发布承诺。

## 目标

- 使用现有的 `electron-builder` 打包工具链。
- 保留 Windows NSIS 安装包输出和 Windows 未打包目录输出。
- 保持现有 `npm run build` 验证流程不变。
- 保留单实例锁定、任务栏可见、关闭到托盘、托盘点击切换窗口，以及显式分
  发审批行为。
- 使用 `resources/icons/icon.ico` 作为 Windows 安装包和应用图标。
- 在 `README.md` 中记录打包工作流程。
- 让 `dist/` 下的安装包产物易于识别。
- 不把生成的打包产物提交到源码仓库。

## 非目标

- v1 不包含代码签名、证书管理或发布者信任流程。
- v1 不包含自动更新服务器、自动更新 UI 或自动升级行为。
- v1 不包含 Linux 打包目标。
- v1 不承诺 macOS 发布支持。现有 macOS builder 设置属于探索性配置，直到
  macOS 运行时分发成为一等目标并完成验证。
- 本次文档规划不改变运行时功能、UI、代理检测、技能分发或本地技能管理。

## 当前实现事实

- `package.json` 已包含 `electron-builder` 以及 `pack`、`dist`、
  `dist:win`、`dist:mac` 打包脚本。
- `package.json` 已定义 builder `appId`、`productName`、Windows `nsis`
  和 `portable` 目标、macOS `dmg` 和 `zip` 目标，以及输出目录 `dist/`。
- `resources/icons/` 已包含 `icon.ico`、`icon.icns`、`icon.png` 和
  `icon.svg`。
- `electron/main.ts` 在 Windows 上优先使用 `resources/icons/icon.ico`，
  其他平台回退到内嵌 SVG 图标。
- 当前技能包解压使用共享的 `extractZipArchive()` helper，不再调用 Windows
  PowerShell。

## 打包输出

### v1 发布产物

| 平台 | 产物 | 路径 | 用途 |
|------|------|------|------|
| Windows | NSIS 安装包 | `dist/*.exe` | 单文件 Windows 安装包 |
| Windows | 便携/未打包构建 | `dist/win-unpacked/` | 用于冒烟测试的未打包 Windows 应用目录 |

### 探索性产物

| 平台 | 产物 | 路径 | 状态 |
|------|------|------|------|
| macOS | DMG 安装包 | `dist/*.dmg` | 已配置，但不是 v1 发布门禁 |
| macOS | ZIP 归档 | `dist/*.zip` | 已配置，但不代表自动更新承诺 |
| macOS | App 包 | `dist/mac*/` | 已配置，发布支持未验证 |

## 应用元数据

- 产品名：`SkillDrive Desktop`
- Builder appId：`com.openskillhub.skilldrive-desktop`
- 运行时 Windows AppUserModelID：`com.openskillhub.skilldrive-desktop`
- 包名：`skilldrive-desktop`
- 版本：来自 `package.json`
- 描述：`Open SkillHub desktop sync client`
- 作者元数据：`Open SkillHub contributors`
- Windows 图标：`resources/icons/icon.ico`
- macOS 图标：`resources/icons/icon.icns`，仅用于探索性构建

## 安装行为

### Windows 安装程序

- 在 `desktop-client/` 下通过 `npm run dist:win` 构建。
- 产出带安装向导的标准 NSIS 安装包。
- 允许操作者更改安装目录。
- 默认安装到 Electron Builder 常规的 Windows 单用户应用位置。
- 安装后启动时保留现有单实例行为。
- 安装后保留关闭到托盘和托盘点击切换窗口行为。

### 安装后的运行时

- 在同一运行环境下，应用行为应与 `npm run start:electron` 保持一致。
- API URL、语言、主题、同步快照和缓存数据继续使用
  `src/core/storage/app-paths.ts` 中的运行时路径：
  - Windows：`%LOCALAPPDATA%/SkillDrive` 或 `%APPDATA%/SkillDrive`
  - macOS 探索性运行时：`~/Library/Application Support/SkillDrive`
  - 覆盖路径：`SKILLDRIVE_DESKTOP_DATA_DIR`
- 当安装后的进程环境提供现有 `SKILLDRIVE_*` 环境变量时，它们仍然生效。
- API Token 和下载解密密钥不得被打包进应用，也不得写入明文配置。

## 构建工作流程

### 现有 npm 脚本

| 脚本 | 用途 |
|------|------|
| `npm run build` | 现有验证构建：类型检查、renderer 构建、Electron main/preload 构建 |
| `npm run pack` | 为当前平台构建未打包目录 |
| `npm run dist` | 为当前平台构建完整安装包产物 |
| `npm run dist:win` | 构建 Windows 安装包产物 |
| `npm run dist:mac` | 探索性 macOS 打包；可靠验证需要在 macOS 上执行 |

### Windows 发布流程

```bash
cd desktop-client
npm install
npm run build
npm run dist:win
```

`desktop-client/dist/` 中生成的产物属于本地构建输出，不应提交到仓库。

## 验收标准

- `npm run build` 仍然通过。
- `npm run dist:win` 在 Windows 发布机器上无错误完成。
- `dist/` 包含 Windows `.exe` 安装包。
- `dist/win-unpacked/` 存在，并可用于冒烟测试启动。
- 安装后的 Windows 应用能够正确启动。
- 安装后单实例锁定正常工作。
- 关闭窗口后应用仍驻留系统托盘。
- 托盘图标可以打开或隐藏已安装窗口。
- API 配置、后台刷新、待审核列表、显式分发、本地技能库存，以及主题/语言
  持久化行为与开发运行时一致。
- 没有提交 secrets 或生成的 `dist/` 产物。
- 文档更新后 `python scripts/validate_agents_docs.py --level ERROR` 通过。

## 参考

- 现有架构：`../ARCHITECTURE.md`
- 技术设计：`../design-docs/desktop-packaging.md`
- 运行时与存储表面：`../references/runtime-and-storage-surface.md`
- Electron 主进程：`../../electron/main.ts`
- 打包配置：`../../package.json`
- 运行时应用路径：`../../src/core/storage/app-paths.ts`
- 打包工作流：`../../README.md`
