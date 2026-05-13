# Desktop Windows Packaging Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task after human review. Steps use checkbox
> (`- [ ]`) syntax in the sibling task file for progress tracking.

**Goal:** Make the desktop client Windows installer story release-ready without
over-claiming macOS runtime support.

**Architecture:** Treat `electron-builder` as a packaging wrapper around the
existing Vite renderer and Electron main/preload build outputs. Windows is the
v1 release target; macOS packaging remains exploratory until non-Windows
distribution is implemented and validated.

**Tech Stack:** Electron, Vite, TypeScript, electron-builder, NSIS, Vitest,
repository documentation gates.

---

## Scope

- Correct product specs so they distinguish current implementation facts,
  Windows v1 release scope, and exploratory macOS builder settings.
- Add a technical design for installer packaging boundaries and validation.
- Document the Windows packaging workflow in `README.md`.
- Record configured packaging commands and app path reality in runtime
  references.
- Create this active ExecPlan and a sibling task checklist for future code or
  release validation work.
- Implementation aligns package metadata and AppUserModelID before installer
  validation.

## Non-Goals

- No code edits in the documentation/planning phase requested on 2026-05-03.
- No installer artifact generation in the documentation/planning phase.
- No macOS runtime release claim.
- No code signing, auto-update, or Linux packaging.
- No changes to sync, distribution, local skills, backend API contracts, or UI
  behavior unless a future implementation phase explicitly approves them.

## Progress

- [x] 2026-05-03: Reviewed root workflow, execution gates, root constitution
  docs, desktop local AGENTS guidance, desktop architecture/design/security,
  task tracker, indexes, current packaging specs, `package.json`,
  `electron/main.ts`, resources, README, and app-path code.
- [x] 2026-05-03: Found documentation issues: specs said implementation was
  pending even though builder configuration exists, promised macOS as a v1
  release target despite the then-current Windows-only archive extraction, and
  listed incorrect runtime data paths.
- [x] 2026-05-03: Updated English and Chinese product specs to describe Windows
  v1 packaging, current implementation facts, exploratory macOS scope, and
  accurate runtime paths.
- [x] 2026-05-03: Added technical design, active plan, task checklist, README
  packaging workflow, and supporting index/reference updates.
- [x] 2026-05-03: Human approved proceeding to the implementation/validation
  phase.
- [x] 2026-05-03: Added package description and author metadata, aligned runtime
  Windows AppUserModelID with builder appId, and added regression coverage.
- [x] Windows installer generation completed.
- [x] Human confirmed installer install and app launch work.
- [x] Diagnosed and fixed packaged tray icon not visible: added `extraResources`
  for `icon.ico` and `resolveWindowsIconPath()` using `process.resourcesPath`
  when `app.isPackaged`.
- [x] Re-test installed app tray icon visibility after fix.
- [ ] Manual installed-app smoke validation (remaining items).

## Decisions

- Windows is the only v1 release packaging target.
- Existing macOS builder configuration is exploratory and should not be treated
  as a release gate yet.
- `npm run build` remains the standard development verification command.
- `npm run dist:win` is the Windows release packaging command.
- Generated `dist/` artifacts are local build output and must not be committed.
- Runtime Windows AppUserModelID must match the builder `appId`.
- Package description and author metadata are sufficient for v1 installer
  resource metadata; publisher trust remains out of scope without code signing.
- Packaged Windows icon must be in `extraResources` (outside the asar) because
  `import.meta.url`-relative paths resolve inside the asar where
  `resources/icons/icon.ico` does not exist.
- `resolveWindowsIconPath()` uses `process.resourcesPath` when
  `app.isPackaged` and falls back to the `import.meta.url`-relative path in
  development.

## File Map

Created:

| File | Responsibility |
|------|----------------|
| `docs/design-docs/desktop-packaging.md` | Durable technical packaging boundary and validation design |
| `docs/exec-plans/active/2026-05-03-desktop-windows-packaging.md` | Active packaging execution plan |
| `docs/exec-plans/active/2026-05-03-desktop-windows-packaging-tasks.md` | Reviewable task checklist |

Modified:

| File | Change |
|------|--------|
| `docs/product-specs/2026-05-02-desktop-packaging.md` | Correct scope to Windows v1 and current implementation facts |
| `docs/product-specs/2026-05-02-desktop-packaging-zh.md` | Chinese version of corrected product scope |
| `docs/product-specs/index.md` | Update packaging spec summaries |
| `docs/design-docs/index.md` | Add packaging technical design |
| `docs/references/runtime-and-storage-surface.md` | Add configured packaging commands and accurate release boundary |
| `docs/ARCHITECTURE.md` | Record packaging configuration and Windows release boundary |
| `README.md` | Document packaging workflow and generated artifact policy |
| `task-tracker.md` | Track active packaging documentation/validation work |
| `docs/exec-plans/active/index.md` | List this active plan and checklist |

Future implementation may modify:

| File | Possible Change |
|------|-----------------|
| `package.json` | Align metadata, target architecture, or package scripts after review |
| `electron/main.ts` | Align Windows AppUserModelID after review |
| `src/__tests__/package-scripts.test.ts` | Cover package metadata and AppUserModelID alignment |

Implemented:

| File | Change |
|------|--------|
| `package.json` | Added `extraResources` for `resources/icons/icon.ico` |
| `electron/main.ts` | Added `resolveWindowsIconPath()` using `process.resourcesPath` when packaged |
| `src/__tests__/electron-icon.test.ts` | Assert `resolveWindowsIconPath`, `app.isPackaged`, `process.resourcesPath` |
| `src/__tests__/package-scripts.test.ts` | Assert `extraResources` configuration |

## Implementation Tasks

See `2026-05-03-desktop-windows-packaging-tasks.md`.

## Validation Plan

Docs phase:

```bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Future Windows packaging validation:

```bash
cd desktop-client
npm test
npm run build
npm run dist:win
```

Manual smoke test after installer generation:

- Install from the generated `.exe`.
- Launch the installed app.
- Verify repeat launch focuses the existing instance.
- Close the window and reopen it through the tray.
- Verify API configuration, missing-token state or authenticated sync,
  explicit distribution, Local Skills, theme, and locale behavior.

## Validation Results

- `python scripts/validate_agents_docs.py --level ERROR` - first run failed
  because the active `task-tracker.md` item lacked the repository-required
  validation marker; fixed by adding the docs-phase validation condition to the
  tracker item.
- `python scripts/validate_agents_docs.py --level ERROR` - passed with 0 errors
  and 0 warnings after the tracker fix.
- `git diff --check` - passed with exit code 0; Git reported expected Windows
  LF-to-CRLF working-copy warnings only.
- `npm test -- src/__tests__/package-scripts.test.ts` - passed after package
  metadata and AppUserModelID alignment changes.
- `npm test` - passed after current implementation: 19 test files and 106
  tests.
- `npm run build` - passed after implementation, including Electron
  typecheck, renderer build, main build, and preload build.
- `npm run dist:win` - passed after adding the runtime ZIP extraction
  dependency and again after the macOS packaging configuration update; it
  generated Windows artifacts:
  `dist/SkillDrive Desktop Setup 0.1.0.exe`,
  `dist/SkillDrive Desktop 0.1.0.exe`, and `dist/win-unpacked/`.
- `node -e "const asar=require('@electron/asar'); ..."` - confirmed
  packaged `app.asar` includes `node_modules/extract-zip`.
- `git status --short --ignored=matching desktop-client\dist` - confirmed
  `dist/` and `dist-electron/` are ignored generated outputs.
- Error note: a PowerShell inspection attempt using
  `Select-Object -Index 90..150` failed because the range was parsed as a
  string; reran the inspection with `-Skip` and `-First`.
- Human smoke test: installer install and app launch confirmed working.
- Human smoke test: tray icon not visible in installed app.
- Root cause: `windowsIconPath` used `import.meta.url`-relative path which
  resolves inside `app.asar` where `resources/icons/icon.ico` does not exist;
  the embedded SVG fallback renders as invisible in the Windows tray.
- Fix: added `extraResources` in `package.json` and `resolveWindowsIconPath()`
  in `electron/main.ts` that uses `process.resourcesPath` when packaged.
- `npm test` - passed after tray icon fix: 19 test files and 107 tests.
- `npm run build` - passed after tray icon fix.
- `npm run dist:win` - passed after tray icon fix; confirmed
  `dist/win-unpacked/resources/icons/icon.ico` exists.
- Pending: re-test installed app tray icon visibility with the new build.
- Human confirmed: tray icon visible, single-instance locking works,
  close-to-tray and tray click toggling work.

## Outcome

Windows installer generation is working. This plan should remain active until
the generated installer is installed and smoke-tested, or until the owner
accepts the remaining manual validation risk.
