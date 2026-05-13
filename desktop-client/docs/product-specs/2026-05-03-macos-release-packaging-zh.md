# macOS 发布打包

状态：规范本地产品文档；跨平台解压已实现，初期保留未签名 macOS 打包，付费发布签名暂缓

## 目的

保留 macOS 探索性 builder 配置，同时记录未来升级为 SkillDrive Desktop
可对外发布直接下载产物的路径。初期产物使用当前未签名的 `package.json`
`build.mac` 配置，因为付费 Developer ID 签名和 Apple 公证暂缓。

本规格不声称 macOS 现在已经可发布。它定义当前未签名打包姿态，以及在
`npm run dist:mac` 产物可作为公开 macOS 安装包前仍必须完成的工作。

## 目标

- 在 macOS 上保留现有“先审核、再显式分发”的同步模型。
- 在 macOS 可发布前，保持运行时技能包解压不依赖 Windows shell 工具。
- 让当前 `electron-builder` macOS 配置明确表达：付费签名和公证已暂缓。
- 将 Developer ID 签名、notarization 和 stapling 记录为未来公开发布路径，
  而不是当前要求。
- 不把 Apple 证书、API key、app-specific password 或 keychain profile 写入源码仓库。
- 提供后续可在 macOS 构建机器执行的操作手册。
- 保持 Windows 打包行为不变。

## 非目标

- 不做 Mac App Store 分发。
- 不做自动更新服务器或自动更新 UI。
- 不做 Linux 打包。
- 初期 macOS 打包阶段不购买 Apple Developer Program，也不做 Developer ID
  签名。
- 不发布 unsigned macOS 构建。
- 不在仓库文件中保存 Apple 签名或公证凭据。
- 不在当前 Windows 机器上执行最终 macOS 构建。

## 影响面

- Electron 主进程中的技能包解压和分发运行时。
- `package.json` 中的 `electron-builder` macOS 配置。
- `build/` 下为未来准备的 macOS entitlements 文件。
- macOS 操作者环境或 keychain 中的发布凭据。
- 产品规格、设计文档、references、ExecPlan 和 task tracker。

## 当前状态

- `package.json` 已暴露 `npm run dist:mac`，配置了 `dmg` 和 `zip` 目标，
  使用 `resources/icons/icon.icns`，将 `identity` 设为 `null`，启用
  Hardened Runtime，并有意将 `forceCodeSigning` 和 `notarize` 设为
  `false`。
- 当前运行时技能包解压使用
  `src/core/distribution/archive-extraction.ts` 中的 `extractZipArchive()`；
  聚焦测试已覆盖正常解压、路径穿越拒绝、symlink 拒绝和绝对输出目录要求。
- 仓库已包含为未来准备的 `build/entitlements.mac.plist` 和
  `build/entitlements.mac.inherit.plist`；它们只包含 Electron hardened
  runtime code-signing entitlements，不包含 release secrets，但当前
  `build.mac` 配置不会引用它们。
- 仓库没有单独的 notarization helper 脚本，因为初期打包配置没有启用公证。
- 当前 Windows 环境无法产出或验证最终 macOS 产物；验证必须在 macOS 上完成。
  未来签名并公证的公开发布还需要 Apple 凭据。

## 发布要求

初期探索性 macOS 打包阶段必须满足：

- `npm test` 在 macOS 构建机器上通过。
- `npm run build` 在 macOS 构建机器上通过。
- 运行时技能包解压不再依赖 Windows PowerShell，并已有 Windows 侧自动化覆盖。
- `npm run dist:mac` 使用当前未签名 `build.mac` 配置产出本地 macOS 产物。
- 手动冒烟测试确认首次启动、bridge 可用、API 配置、同步审核状态、显式分发、
  Local Skills、主题/语言持久化，以及退出/重启行为。

macOS DMG 可作为公开直接下载产物发布前，还必须满足：

- 付费 Developer ID 发布路径已获批。
- `package.json` 已更新为要求 code signing 和 notarization。
- `npm run dist:mac` 产出 signed `.app`、`.dmg` 和 `.zip`。
- 应用使用 Developer ID Application identity 签名。
- Hardened Runtime 已启用。
- Electron runtime 所需 entitlements 明确且最小化。
- DMG 使用 `notarytool` 提交 Apple notarization。
- notarization ticket 已 staple 到 DMG。
- stapled DMG 或安装后的 app 通过 Gatekeeper assessment。

## 验收标准

- 安全的跨平台 ZIP 解压已实现，不依赖 Windows PowerShell，并已有聚焦回归测试。
- 未来 macOS 签名 entitlements 已文档化、提交并有测试覆盖，且不包含 secrets。
- `package.json` 保持 macOS `dmg` 和 `zip` 构建，启用 Hardened Runtime，
  并明确记录初期已禁用 code signing 和 notarization。
- macOS 操作手册可以在干净 macOS 构建机器上执行，不依赖聊天历史。
- Apple 签名和公证凭据只作为未来操作者环境变量或 keychain 输入出现。
- 文档更新后 `python scripts/validate_agents_docs.py --level ERROR` 通过。
- 最终公开 release 仍然阻塞，直到付费 Developer ID 路径恢复，并在 macOS
  机器记录 `npm test`、`npm run build`、`npm run dist:mac`、notarization、
  stapling 和冒烟测试结果。

## 参考

- 技术设计：`../design-docs/macos-release-packaging.md`
- 操作手册：`../references/macos-release-runbook.md`
- Windows 打包规格：`2026-05-02-desktop-packaging.md`
- 运行时与存储表面：`../references/runtime-and-storage-surface.md`
- Apple Developer ID: https://developer.apple.com/developer-id/
- Apple notarization: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple notarization workflow: https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- electron-builder macOS signing: https://www.electron.build/code-signing-mac
