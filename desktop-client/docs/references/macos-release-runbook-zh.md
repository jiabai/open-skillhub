# macOS 发布操作手册

状态：本手册在 Windows 上编写；需在 macOS 机器上使用发布签名凭据执行

## 目的

本手册用于在 macOS 机器上构建、签名、公证、装订和冒烟测试可发布的 SkillDrive Desktop macOS DMG。

请勿将此手册视为 macOS 已具备发布条件的证明。执行发布命令前，必须先满足下方的首个门禁要求。

## 相关文档

- 产品规格：`docs/product-specs/2026-05-03-macos-release-packaging.md`
- 技术设计：`docs/design-docs/macos-release-packaging.md`
- 执行计划：`docs/exec-plans/active/2026-05-03-macos-release-packaging.md`
- 任务清单：`docs/exec-plans/active/2026-05-03-macos-release-packaging-tasks.md`
- 打包配置：`package.json`（build.mac、build.dmg 部分）

## 发布准备门禁

除非以下所有条件均满足，否则请勿进行发布打包：

- 当前 macOS 发布执行计划记录了跨平台归档提取测试通过。
- `electron/main.ts` 使用 `extractZipArchive()` 而非 Windows PowerShell 进行包提取。
- macOS 权限文件已提交且不包含密钥。
- `package.json` macOS 发布配置指向这些权限文件，启用 Hardened Runtime，要求代码签名，并启用 electron-builder 公证。
- macOS 机器已安装 Xcode 命令行工具和最新版本的 `notarytool`。
- 发布操作者拥有 Developer ID Application 证书和 Apple 公证凭据（存储在仓库之外）。

## 官方参考

- Apple Developer ID：https://developer.apple.com/developer-id/
- Apple 公证：https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple 自定义公证工作流：https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- electron-builder macOS 签名：https://www.electron.build/code-signing-mac
- electron-builder macOS 配置：https://www.electron.build/electron-builder.Interface.MacConfiguration.html

## macOS 机器前置条件

安装或验证：

```bash
xcode-select -p
xcodebuild -version
xcrun notarytool --version
xcrun stapler --version
node --version
npm --version
git --version
```

预期：

- Xcode 命令行工具已安装并选中。
- `notarytool` 和 `stapler` 可通过 `xcrun` 使用。
- Node/npm 版本与桌面客户端兼容。

## 签名证书设置

macOS 发布机器需要在登录钥匙串中安装 Developer ID Application 证书。

检查可用身份：

```bash
security find-identity -v -p codesigning
```

预期：

- 输出包含 `Developer ID Application: ... (TEAMID)` 身份。
- 请勿将证书私钥或密码粘贴到仓库文件中。

如果证书以 `.p12` 形式提供给临时构建机器，请将其导入仓库之外的本地钥匙串，并在发布完成后删除 `.p12`。如果使用 electron-builder 的 `CSC_LINK` 和 `CSC_KEY_PASSWORD`，请仅在 shell 或 CI 密钥存储中设置。

## 公证凭据设置

使用 electron-builder 支持的凭据路径之一。

### 推荐：App Store Connect API 密钥

将 `.p8` 密钥存储在仓库之外，然后导出：

```bash
export APPLE_API_KEY="/absolute/path/outside/repo/AuthKey_KEYID.p8"
export APPLE_API_KEY_ID="KEYID"
export APPLE_API_ISSUER="issuer-uuid"
```

### 备选：钥匙串配置文件

创建一次钥匙串配置文件：

```bash
xcrun notarytool store-credentials "skilldrive-notary" \
  --apple-id "release@example.com" \
  --team-id "TEAMID" \
  --password "app-specific-password"
```

然后为 electron-builder 导出：

```bash
export APPLE_KEYCHAIN_PROFILE="skilldrive-notary"
```

如果构建使用非默认钥匙串，还需设置：

```bash
export APPLE_KEYCHAIN="/absolute/path/to/login.keychain-db"
```

### 备选：Apple ID 环境变量

仅用于本地操作者 shell 或 CI 密钥：

```bash
export APPLE_ID="release@example.com"
export APPLE_TEAM_ID="TEAMID"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

切勿提交这些值。

## 清理检出

使用包含 macOS 实现代码的发布分支：

```bash
git clone <repo-url> skilldrive-macos-release
cd skilldrive-macos-release
git checkout <release-branch>
cd desktop-client
```

如果使用现有检出：

```bash
git status --short
git pull --ff-only
cd desktop-client
```

预期：

- 没有无关的工作树更改。
- 检出的分支包含 macOS 发布实现和文档。

## 安装依赖

```bash
npm install
```

预期：

- 依赖安装不会意外修改已提交的源文件。
- 如果 `package-lock.json` 发生变化，请在发布前停止并检查原因。

## 自动化验证

打包前运行桌面门禁：

```bash
npm test
npm run build
```

预期：

- 所有 Vitest 测试通过。
- TypeScript/Electron 构建完成。
- `dist/` 和 `dist-electron/` 仅为生成的输出。

## 清理构建产物

打包前移除旧的构建产物：

```bash
npm run clean
```

预期：

- `dist/` 和 `dist-electron/` 被移除。
- 不影响源文件。

如果 `clean` 脚本失败，手动移除：

```bash
rm -rf dist dist-electron
```

## 构建已签名的 macOS 产物

确认签名身份：

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

构建：

```bash
npm run dist:mac
```

预期产物：

- `dist/*.dmg`
- `dist/*.zip`
- `dist/mac*/SkillDrive Desktop.app`

如果 electron-builder 提示使用了 ad-hoc 身份，请停止。公开发布必须使用 Developer ID 签名。

## 构建失败排查

如果 `npm run dist:mac` 失败：

1. 检查签名身份可用性：
   ```bash
   security find-identity -v -p codesigning
   ```

2. 验证权限文件语法：
   ```bash
   plutil -lint build/entitlements.mac.plist
   plutil -lint build/entitlements.mac.inherit.plist
   ```

3. 如果 electron-builder 报告权限文件错误，验证 XML：
   ```bash
   xmllint --noout build/entitlements.mac.plist
   ```

4. 检查是否有过时的构建产物：
   ```bash
   npm run clean
   npm run build
   npm run dist:mac
   ```

5. 记录完整的错误输出并附加到当前执行计划中。

## 验证代码签名

如果 electron-builder 使用 `mac-arm64`、`mac-x64` 或 `mac`，请调整路径：

```bash
APP_PATH="$(find dist -maxdepth 3 -name 'SkillDrive Desktop.app' -print -quit)"
echo "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -E "Authority|TeamIdentifier|Runtime"
spctl --assess --type execute --verbose "$APP_PATH"
```

预期：

- `codesign --verify` 退出码为 0。
- Authority 包含 `Developer ID Application`。
- 存在 Hardened Runtime。
- `spctl --assess --type execute` 接受应用或仅给出公证警告（装订后将解决）。

## 公证与装订

查找 DMG：

```bash
DMG_PATH="$(find dist -maxdepth 1 -name '*.dmg' -print -quit)"
echo "$DMG_PATH"
```

如果 electron-builder 尚未公证产物，手动提交：

```bash
xcrun notarytool submit "$DMG_PATH" \
  --keychain-profile "skilldrive-notary" \
  --wait
```

如果使用 API 密钥环境变量而非钥匙串配置文件，请使用 Apple 文档中对应的 `notarytool` 认证标志。

装订：

```bash
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
```

预期：

- 公证状态为 `Accepted`。
- `stapler validate` 退出码为 0。

如果公证失败：

```bash
xcrun notarytool log <submission-id> --keychain-profile "skilldrive-notary" notarization-log.json
```

将日志附加到当前执行计划，不要发布 DMG。

## Gatekeeper 评估

评估已装订的 DMG：

```bash
spctl --assess --type open --context context:primary-signature --verbose "$DMG_PATH"
```

挂载 DMG：

```bash
hdiutil attach "$DMG_PATH"
```

将 `SkillDrive Desktop.app` 拖到 `/Applications`，然后评估已安装的应用：

```bash
spctl --assess --type execute --verbose "/Applications/SkillDrive Desktop.app"
```

预期：

- Gatekeeper 接受 DMG 和已安装的应用。
- DMG 打开干净，显示应用和 Applications 链接。

检查后卸载。挂载的卷名可能包含应用版本；使用 `hdiutil attach` 打印的 `/Volumes/...` 路径：

```bash
hdiutil detach "/Volumes/SkillDrive Desktop 0.1.0" || hdiutil detach "/Volumes/SkillDrive Desktop" || true
```

## 手动冒烟测试

除非这是最终生产发布候选版本，否则请使用非生产环境的 SkillDrive 后端。

1. 启动 `/Applications/SkillDrive Desktop.app`。
2. 确认应用打开时无 Gatekeeper 警告。
3. 确认渲染器加载正常且桌面桥接可用。
4. 确认未配置 token 时显示缺失 token 状态。
5. 配置 API URL 和 token，或使用启动环境中的 `SKILLDRIVE_API_BASE_URL` 和 `SKILLDRIVE_API_TOKEN`。
6. 运行连接测试。
7. 刷新同步状态。
8. 确认待审核状态渲染正常。
9. 对安全的测试目标运行分发前检查。
10. 分发一个测试技能到临时或一次性代理技能目录。
11. 确认分发前需要显式批准。
12. 确认本地技能清单渲染正常且不会在没有显式行操作时上传。
13. 切换主题和语言，退出后重新启动，确认持久化正常。
14. 完全退出后重新启动，确认无重复实例行为。

如果任何步骤失败，请记录：

- macOS 版本
- 芯片架构
- 确切的产物名称
- 失败的命令或 UI 步骤
- 终端输出或截图
- 该失败是否阻止发布

## 发布证据模板

运行 macOS 发布后，将此内容复制到当前执行计划中：

```text
macOS 发布验证：
- 机器：<Mac 型号、芯片、macOS 版本>
- Xcode：<xcodebuild -version>
- Node/npm：<版本>
- 分支/提交：<sha>
- npm run clean：<通过/失败>
- npm test：<通过/失败，数量>
- npm run build：<通过/失败>
- npm run dist:mac：<通过/失败>
- 构建耗时：<分钟>
- DMG：<文件名，大小>
- ZIP：<文件名，大小>
- codesign verify：<通过/失败>
- 公证：<Accepted/提交 ID>
- stapler validate：<通过/失败>
- spctl DMG：<接受/拒绝>
- spctl 已安装应用：<接受/拒绝>
- 手动冒烟：<通过/失败，备注>
- 残余风险：<无或明确风险>
```

## 清理

发布完成后：

```bash
rm -f notarization-log.json
unset APPLE_ID APPLE_TEAM_ID APPLE_APP_SPECIFIC_PASSWORD
unset APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER
unset APPLE_KEYCHAIN APPLE_KEYCHAIN_PROFILE
unset CSC_LINK CSC_KEY_PASSWORD
```

仅将发布产物保存在批准的发布存储位置。不要提交 `dist/`、`.p12`、`.p8`、钥匙串文件、包含团队元数据的公证日志或生成的应用包。
