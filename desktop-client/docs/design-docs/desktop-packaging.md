# Desktop Packaging Technical Design

Status: active design; packaging implementation in progress, installer validation pending

## Goal

Define the packaging boundary for the desktop client so Windows installer work
can proceed without over-claiming unsupported runtime platforms. Packaging should
wrap the current Electron app and preserve existing review-first behavior; it
must not introduce automatic distribution, secret persistence changes, or
generated artifact churn in source control.

## Current Code Reality

- `package.json` already contains `electron-builder`, builder configuration,
  and `pack`, `dist`, `dist:win`, and `dist:mac` scripts.
- Windows builder targets are `nsis` and `portable`.
- macOS builder targets are `dmg` and `zip`, and `resources/icons/icon.icns`
  already exists.
- `electron/main.ts` prefers `resources/icons/icon.ico` on Windows and uses the
  embedded SVG fallback on other platforms.
- Downloaded skill package extraction uses
  `src/core/distribution/archive-extraction.ts`, which avoids shelling out to
  Windows PowerShell.
- Runtime data paths are owned by `src/core/storage/app-paths.ts`, not by the
  installer configuration.
- The builder `appId` and runtime Windows AppUserModelID are both
  `com.openskillhub.skilldrive-desktop`.
- `package.json` provides installer-visible package metadata:
  `description` is `SkillDrive desktop sync client`, and `author.name` is
  `SkillDrive contributors`.

## Design Decisions

- Treat Windows as the v1 release packaging target.
- Keep macOS builder settings documented as exploratory until macOS runtime
  distribution, signing, notarization, and smoke validation pass on macOS.
- Keep `npm run build` as the normal development verification command; installer
  generation is an additional release validation step, not a replacement.
- Keep code signing and auto-update out of v1.
- Keep generated `dist/` artifacts local and uncommitted.
- Preserve runtime secret handling: API tokens remain in `keytar`, and download
  decryption secrets remain current-session environment input only.
- Keep the runtime Windows AppUserModelID aligned with the builder `appId`.

## Packaging Boundary

`electron-builder` packages already-built renderer and Electron bundles:

```text
package.json build.files
  dist/**/*           # Vite renderer output
  dist-electron/**/*  # Electron main and preload output
  package.json
```

The release workflow should run `npm run build` before `npm run dist:win` so the
packaged files match the standard verified runtime build.

## Windows Installer Expectations

- Command: `cd desktop-client && npm run dist:win`
- Output directory: `desktop-client/dist/`
- Expected artifacts:
  - `*.exe` NSIS installer
  - `win-unpacked/` unpacked application directory
- Installer behavior:
  - wizard-style install
  - configurable install directory
  - installed app launches the packaged Electron main process
  - close-to-tray and tray click toggling still work
  - repeat launches focus the existing process through the single-instance lock

## macOS Boundary

`npm run dist:mac` remains available, but it is not a publishable release path
until the dedicated macOS release plan passes. That plan must address at least:

- macOS validation of the cross-platform package extraction path
- macOS tray/menu-bar expectations
- macOS install smoke tests
- macOS distribution smoke tests against supported local agent paths
- platform-specific signing/notarization policy if release distribution needs it

See `macos-release-packaging.md` and `../references/macos-release-runbook.md`
for the active macOS release path.

## Documentation Updates

The packaging work should keep these documents aligned:

- `docs/product-specs/2026-05-02-desktop-packaging.md`
- `docs/product-specs/2026-05-02-desktop-packaging-zh.md`
- `docs/references/runtime-and-storage-surface.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `task-tracker.md`
- active/completed ExecPlan indexes

## Validation Plan

Documentation phase:

```bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Release implementation/validation phase:

```bash
cd desktop-client
npm test
npm run build
npm run dist:win
```

Manual Windows smoke test:

- install from the generated `.exe`
- launch the installed app
- verify single-instance behavior
- close the window and reopen through the tray
- configure API URL/token or verify the expected missing-token state
- verify pending review, explicit distribution, local skills inventory, theme,
  and locale behavior against the same backend/environment used for development

## Open Follow-Ups

- Decide whether Windows code signing is still intentionally out of scope after
  the first installer validation pass.
