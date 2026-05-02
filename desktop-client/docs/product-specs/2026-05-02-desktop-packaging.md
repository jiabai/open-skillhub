# Desktop Client Packaging

Status: canonical local product spec, implementation pending

## Purpose

Enable packaging the desktop client into distributable installers for Windows
and macOS distribution. Operators should be able to build `.exe` installers for
Windows and `.dmg` for macOS, each installing an auto-upgrade-ready Electron app
with proper icon, startup behavior, and tray persistence.

## Goals

- Add `electron-builder` as the packaging toolchain.
- Configure Windows NSIS installer output targeting Windows x64.
- Configure macOS DMG installer output targeting macOS (x64 + arm64 universal).
- Configure proper application metadata: app name, version, description, publisher, copyright.
- Configure application icon using existing `resources/icons/icon.ico` (Windows) and add macOS icon.
- Configure single-instance locking (already implemented, preserve).
- Configure tray persistence and startup behavior.
- Add npm scripts for building installers for both platforms.
- Document packaging workflow in `README.md`.
- Preserve all existing runtime behavior unchanged.

## Non-Goals

- No auto-update server or auto-update UI in v1 (future scope).
- No Linux packaging targets in v1 (Windows + macOS only).
- No code signing or certificate management in v1.
- No changes to runtime functionality or UI.
- No changes to existing build workflow (`npm run build` continues to work as before).
- No changes to agent detection, skill distribution, or local skills management.

## Packaging Output

### Installer Artifacts

| Platform | Artifact | Path | Purpose |
|----------|----------|------|---------|
| Windows | NSIS installer | `dist/*.exe` | Single-file Windows installer |
| Windows | Portable build | `dist/win-unpacked/` | Unpacked portable directory |
| macOS | DMG installer | `dist/*.dmg` | macOS disk image installer |
| macOS | ZIP archive | `dist/*.zip` | macOS ZIP archive for auto-update |
| macOS | App bundle | `dist/mac/` | Unpacked macOS `.app` bundle |

### Application Metadata

- Name: `SkillDrive Desktop`
- AppId: `com.openskillhub.skilldrive-desktop`
- Version: from `package.json`
- Description: Open SkillHub desktop sync client
- Publisher: Open SkillHub
- Copyright: Open SkillHub contributors

## Installation Behavior

### Windows Installer

- Standard NSIS installer with default install wizard.
- Install to `%LOCALAPPDATA%/Programs/SkillDrive Desktop` by default.
- Create desktop shortcut.
- Create Start Menu entry.
- Add uninstall entry in Add/Remove Programs.
- Preserve single-instance locking on first run.

### macOS Installer

- Standard DMG disk image with drag-drop install to Applications.
- `.app` bundle installed to `/Applications/SkillDrive Desktop.app`.
- Add app to Dock on first launch (optional, user-configurable).
- Preserve single-instance locking on first run.

### Runtime After Install

- Application behaves exactly as development mode on both platforms.
- Tray persistence remains.
- Configuration and state stored in platform-specific user data directories:
  - Windows: `%APPDATA%/skilldrive-desktop`
  - macOS: `~/Library/Application Support/skilldrive-desktop`
- Existing `SKILLDRIVE_*` environment variables still work for configuration.

## Build Workflow

### New npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Existing build (unchanged) |
| `npm run pack` | Build unpacked directories for current platform |
| `npm run dist` | Build full installers for current platform |
| `npm run dist:win` | Build Windows installers (on Windows or cross-platform) |
| `npm run dist:mac` | Build macOS installers (requires macOS) |

### Packaging Configuration

- `electron-builder` config in `package.json`.
- Use existing `resources/icons/icon.ico` as Windows app icon.
- Add macOS icon at `resources/icons/icon.icns`.
- Configure `nsis` target for Windows x64.
- Configure `dmg` and `zip` targets for macOS (universal x64 + arm64).
- Configure `directories.output` to `dist/`.
- Configure `files` to include built renderer and Electron main process artifacts.
- Configure `extraResources` for icons if needed.
- Configure platform-specific settings for Windows and macOS.

## Acceptance Criteria

- `npm run dist:win` completes without errors on Windows.
- `dist/` directory contains Windows `.exe` installer.
- Windows installer runs and installs correctly.
- Installed Windows app launches correctly.
- `npm run dist:mac` completes without errors on macOS.
- `dist/` directory contains macOS `.dmg` installer.
- macOS DMG opens and drag-drop install works correctly.
- Installed macOS app launches correctly.
- Single-instance locking works on both platforms.
- Tray persistence works on both platforms.
- All existing functionality works unchanged on both platforms.
- `npm run build` still works for development.
- `npm run start:electron` still works for development.
- `npm test` still passes.

## References

- Existing architecture: `../ARCHITECTURE.md`
- Electron main: `../../electron/main.ts`
- Runtime config: `src/core/storage/config-store.ts`
