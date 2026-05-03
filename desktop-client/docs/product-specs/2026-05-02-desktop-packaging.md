# Desktop Client Windows Packaging

Status: canonical local product spec; packaging configuration exists, Windows installer validation pending

## Purpose

Enable the desktop client to ship as a Windows distributable installer without
changing the review-first sync and distribution runtime. Operators should be
able to build a Windows `.exe` installer and an unpacked portable directory from
the current Electron app, install it locally, and confirm that the installed app
preserves single-instance locking, tray persistence, API configuration, skill
review, and explicit distribution behavior.

The current v1 release target is Windows. macOS packaging commands and icon
assets may exist in the repository, but macOS is not a v1 release claim until
non-Windows runtime behavior, signing, notarization, stapling, and smoke
testing are validated on a macOS release machine.

## Goals

- Use the existing `electron-builder` packaging toolchain.
- Keep Windows NSIS installer output and the unpacked Windows directory output.
- Preserve the existing `npm run build` verification workflow unchanged.
- Preserve single-instance locking, taskbar visibility, close-to-tray behavior,
  tray toggling, and explicit distribution approval.
- Use `resources/icons/icon.ico` as the Windows installer/application icon.
- Document the packaging workflow in `README.md`.
- Make installer outputs easy to recognize under `dist/`.
- Keep generated packaging artifacts out of source control.

## Non-Goals

- No code signing, certificate management, or publisher trust workflow in v1.
- No auto-update server, auto-update UI, or automatic upgrade behavior in v1.
- No Linux packaging target in v1.
- No macOS release support in v1. Existing macOS builder settings are
  exploratory until macOS runtime distribution is made and validated as a
  first-class target.
- No runtime functionality, UI, agent detection, skill distribution, or local
  skills management changes as part of documentation-only planning.

## Current Implementation Facts

- `package.json` already includes `electron-builder` and packaging scripts:
  `pack`, `dist`, `dist:win`, and `dist:mac`.
- `package.json` already defines a builder `appId`,
  `productName`, Windows `nsis` and `portable` targets, macOS `dmg` and `zip`
  targets, and output directory `dist/`.
- `resources/icons/` already contains `icon.ico`, `icon.icns`, `icon.png`, and
  `icon.svg`.
- `electron/main.ts` prefers `resources/icons/icon.ico` on Windows and falls
  back to the embedded SVG icon elsewhere.
- Runtime package extraction uses the shared `extractZipArchive()` helper and
  no longer shells out to Windows PowerShell.

## Packaging Output

### V1 Release Artifacts

| Platform | Artifact | Path | Purpose |
|----------|----------|------|---------|
| Windows | NSIS installer | `dist/*.exe` | Single-file Windows installer |
| Windows | Portable build | `dist/win-unpacked/` | Unpacked Windows app directory for smoke testing |

### Exploratory Artifacts

| Platform | Artifact | Path | Status |
|----------|----------|------|--------|
| macOS | DMG installer | `dist/*.dmg` | Configured, not a v1 release gate |
| macOS | ZIP archive | `dist/*.zip` | Configured, not an auto-update commitment |
| macOS | App bundle | `dist/mac*/` | Configured, release support not validated |

## Application Metadata

- Product name: `SkillDrive Desktop`
- Builder appId: `com.openskillhub.skilldrive-desktop`
- Runtime Windows AppUserModelID: `com.openskillhub.skilldrive-desktop`
- Package name: `skilldrive-desktop`
- Version: from `package.json`
- Description: `Open SkillHub desktop sync client`
- Author metadata: `Open SkillHub contributors`
- Windows icon: `resources/icons/icon.ico`
- macOS icon: `resources/icons/icon.icns` for exploratory builds

## Installation Behavior

### Windows Installer

- Build through `npm run dist:win` from `desktop-client/`.
- Produce a standard NSIS installer with an install wizard.
- Allow the operator to change the installation directory.
- Install to Electron Builder's normal per-user Windows application location by
  default.
- Preserve the app's existing single-instance behavior on launch.
- Preserve close-to-tray behavior and tray click toggling after install.

### Runtime After Install

- Application behavior should match `npm run start:electron` for the same
  runtime environment.
- API URL, locale, theme, sync snapshot, and cache data continue to use the
  runtime app paths from `src/core/storage/app-paths.ts`:
  - Windows: `%LOCALAPPDATA%/SkillDrive` or `%APPDATA%/SkillDrive`
  - macOS exploratory runtime: `~/Library/Application Support/SkillDrive`
  - Override: `SKILLDRIVE_DESKTOP_DATA_DIR`
- Existing `SKILLDRIVE_*` environment variables still work when supplied to the
  installed process environment.
- API tokens and download decryption secrets must not be packaged into the app
  or written to plaintext config.

## Build Workflow

### Existing npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Existing verification build: typecheck, renderer build, Electron main/preload build |
| `npm run pack` | Build unpacked directories for the current platform |
| `npm run dist` | Build full installer artifacts for the current platform |
| `npm run dist:win` | Build Windows installer artifacts |
| `npm run dist:mac` | Exploratory macOS packaging; requires macOS for reliable validation |

### Windows Release Workflow

```bash
cd desktop-client
npm install
npm run build
npm run dist:win
```

Generated artifacts in `desktop-client/dist/` are local build outputs and should
not be committed.

## Acceptance Criteria

- `npm run build` still passes.
- `npm run dist:win` completes without errors on a Windows release machine.
- `dist/` contains a Windows `.exe` installer.
- `dist/win-unpacked/` exists and launches for smoke testing.
- The installed Windows app launches correctly.
- Single-instance locking works after install.
- Closing the window keeps the app resident in the tray.
- The tray icon opens or hides the installed window.
- API configuration, background refresh, pending review, explicit distribution,
  local skills inventory, and theme/locale persistence behave the same as the
  development runtime.
- No secrets or generated `dist/` artifacts are committed.
- `python scripts/validate_agents_docs.py --level ERROR` passes after docs are
  updated.

## References

- Existing architecture: `../ARCHITECTURE.md`
- Technical design: `../design-docs/desktop-packaging.md`
- Runtime and storage surface: `../references/runtime-and-storage-surface.md`
- Electron main process: `../../electron/main.ts`
- Packaging configuration: `../../package.json`
- Runtime app paths: `../../src/core/storage/app-paths.ts`
- Packaging workflow: `../../README.md`
