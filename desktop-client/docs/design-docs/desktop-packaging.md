# Desktop Packaging Technical Design

Status: active design; documentation/planning phase complete, installer validation pending

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
- `electron/main.ts` currently extracts downloaded skill packages through
  Windows PowerShell `Expand-Archive`; non-Windows distribution fails closed.
- Runtime data paths are owned by `src/core/storage/app-paths.ts`, not by the
  installer configuration.
- The builder `appId` is `com.openskillhub.skilldrive-desktop`; the runtime
  Windows AppUserModelID is currently `com.skilldrive.desktop-client`.

## Design Decisions

- Treat Windows as the v1 release packaging target.
- Keep macOS builder settings documented as exploratory until macOS runtime
  distribution has an implementation and validation plan.
- Keep `npm run build` as the normal development verification command; installer
  generation is an additional release validation step, not a replacement.
- Keep code signing and auto-update out of v1.
- Keep generated `dist/` artifacts local and uncommitted.
- Preserve runtime secret handling: API tokens remain in `keytar`, and download
  decryption secrets remain current-session environment input only.
- Audit AppUserModelID alignment before declaring the Windows installer
  release-ready.

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

`npm run dist:mac` may remain available for exploratory packaging, but it is not
a v1 acceptance gate. Before macOS is promoted to release scope, a future plan
must address at least:

- cross-platform package extraction instead of Windows PowerShell
- macOS tray/menu-bar expectations
- macOS install smoke tests
- macOS distribution smoke tests against supported local agent paths
- platform-specific signing/notarization policy if release distribution needs it

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

- Decide whether to align `APP_USER_MODEL_ID` with the builder `appId`.
- Decide whether package metadata needs description, author, publisher, or
  copyright fields before release.
- Decide whether Windows code signing is still intentionally out of scope after
  the first installer validation pass.
