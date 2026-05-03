# macOS Release Packaging Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SkillDrive Desktop produce a publishable macOS DMG after a future macOS-machine validation pass.

**Architecture:** Keep packaging as an `electron-builder` wrapper around the existing Vite renderer and Electron main/preload outputs. The Windows-only package extraction path has been replaced with a safe cross-platform ZIP extraction helper, and macOS signing/notarization configuration now points at explicit entitlements. Before macOS can be released, validate Developer ID signing, Apple notarization, stapling, Gatekeeper, and app behavior on macOS.

**Tech Stack:** Electron, Vite, TypeScript, electron-builder, Developer ID signing, Apple notarytool/stapler, Vitest, repository documentation gates.

---

## Scope

- Prepare macOS release packaging product specs in English and Chinese.
- Add technical design for macOS release packaging, signing, notarization, and
  runtime blockers.
- Add a macOS release operation runbook that can be executed later on a macOS
  build machine.
- Track implementation tasks for cross-platform extraction, entitlements,
  electron-builder config, and macOS validation.
- Update indexes, architecture, security, references, and task tracker.

## Non-Goals

- No macOS build execution on the current Windows machine.
- No Apple credential creation or storage in this repository.
- No Mac App Store distribution.
- No auto-update work.
- No Windows packaging regression scope beyond preserving existing behavior.

## Progress

- [x] 2026-05-03: Reviewed repository workflow, execution gates, desktop
  guidance, task tracker, product/design/reference indexes, current packaging
  docs, current package configuration, electron-builder local schema, and Apple
  Developer ID/notarization documentation.
- [x] 2026-05-03: Confirmed macOS was blocked by Windows-only archive
  extraction and remains blocked by lack of macOS signing/notarization release
  validation.
- [x] 2026-05-03: Added English and Chinese macOS release product specs.
- [x] 2026-05-03: Added macOS release packaging technical design.
- [x] 2026-05-03: Added macOS release runbook for the future macOS build
  machine.
- [x] 2026-05-03: Added active ExecPlan and task checklist.
- [x] 2026-05-03: Added failing tests for safe archive extraction and verified
  the RED state when the helper was missing.
- [x] 2026-05-03: Implemented `extractZipArchive()` with absolute-path
  enforcement and symlink rejection, wired `electron/main.ts` to use it instead
  of PowerShell, and added `extract-zip` as a runtime dependency.
- [x] 2026-05-03: Confirmed checksum, expiration, and cleanup ownership stay in
  the existing download/package-service flow.
- [x] 2026-05-03: Added RED tests for macOS release signing configuration and
  minimal entitlements, then added `build/entitlements.mac.plist`,
  `build/entitlements.mac.inherit.plist`, and explicit macOS
  `hardenedRuntime`, `forceCodeSigning`, `notarize`, `entitlements`, and
  `entitlementsInherit` configuration in `package.json`.
- [ ] Future macOS validation: signed DMG, notarization, stapling, Gatekeeper,
  and manual smoke test.

## Decisions

- The macOS DMG is not releaseable until runtime distribution is smoke-tested
  on macOS.
- Apple signing and notarization secrets must remain operator environment or
  keychain inputs, never committed files.
- Developer ID distribution outside the Mac App Store is the intended macOS
  release path.
- Use `notarytool`, not `altool`, for notarization.
- Keep the runbook executable from a clean macOS checkout without chat history.

## File Map

Created:

| File | Responsibility |
|------|----------------|
| `docs/product-specs/2026-05-03-macos-release-packaging.md` | English macOS release product spec |
| `docs/product-specs/2026-05-03-macos-release-packaging-zh.md` | Chinese macOS release product spec |
| `docs/design-docs/macos-release-packaging.md` | Technical design for macOS release packaging |
| `docs/references/macos-release-runbook.md` | macOS operator build/sign/notarize/smoke runbook |
| `docs/exec-plans/active/2026-05-03-macos-release-packaging.md` | Active macOS release packaging plan |
| `docs/exec-plans/active/2026-05-03-macos-release-packaging-tasks.md` | Task checklist for docs, future implementation, and future validation |

Modified:

| File | Change |
|------|--------|
| `docs/product-specs/index.md` | Add macOS release specs |
| `docs/design-docs/index.md` | Add macOS release technical design |
| `docs/references/index.md` | Add macOS release runbook |
| `docs/exec-plans/active/index.md` | Add macOS release plan and checklist |
| `docs/ARCHITECTURE.md` | Record macOS release blocker and runbook |
| `docs/SECURITY.md` | Record Apple signing/notarization secret handling |
| `docs/references/runtime-and-storage-surface.md` | Clarify macOS packaging command and release boundary |
| `README.md` | Point operators at the macOS release runbook |
| `task-tracker.md` | Track macOS release documentation and future validation |

Implemented release configuration files:

| File | Change |
|------|--------|
| `package.json` | Added explicit macOS entitlements/signing/notarization config |
| `.gitignore` | Allowed the committed desktop entitlements files under `desktop-client/build/` |
| `build/entitlements.mac.plist` | Added app entitlements |
| `build/entitlements.mac.inherit.plist` | Added inherited Electron helper entitlements |

Implemented files:

| File | Change |
|------|--------|
| `package.json` | Added runtime `extract-zip` dependency |
| `package-lock.json` | Locked direct runtime ZIP extraction dependency |
| `electron/main.ts` | Removed Windows PowerShell extraction and called `extractZipArchive()` |
| `src/core/distribution/archive-extraction.ts` | Added safe cross-platform ZIP extraction helper |
| `src/__tests__/archive-extraction.test.ts` | Covered valid extraction, traversal rejection, symlink rejection, and absolute destination enforcement |
| `src/__tests__/electron-shell.test.ts` | Guarded against reintroducing PowerShell extraction |
| `src/__tests__/package-scripts.test.ts` | Guarded macOS release signing config and minimal entitlements |

## Implementation Tasks

See `2026-05-03-macos-release-packaging-tasks.md`.

## Validation Plan

Windows documentation phase:

```bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Windows implementation validation phase:

```bash
cd desktop-client
npm test
npm run build
```

Future macOS release phase:

```bash
cd desktop-client
npm test
npm run build
npm run dist:mac
codesign --verify --deep --strict --verbose=2 "dist/mac*/SkillDrive Desktop.app"
xcrun stapler validate "dist/SkillDrive Desktop 0.1.0.dmg"
spctl --assess --type open --context context:primary-signature --verbose "dist/SkillDrive Desktop 0.1.0.dmg"
```

Manual smoke testing is defined in `../../references/macos-release-runbook.md`.

## Validation Results

- `python scripts\validate_agents_docs.py --level ERROR` - passed with 0
  errors and 0 warnings for the Windows documentation phase.
- `git diff --check` - passed with exit code 0; Git reported expected Windows
  LF-to-CRLF working-copy warnings only.
- `npm test -- src/__tests__/archive-extraction.test.ts` - RED before
  implementation because `@/core/distribution/archive-extraction` did not
  exist; passed after implementation and absolute-entry coverage with 6 tests.
- `npm test -- src/__tests__/electron-shell.test.ts` - RED before
  implementation because `electron/main.ts` did not call `extractZipArchive`;
  passed after implementation with 3 tests.
- `npm test` - passed after macOS release signing configuration with 19 test
  files and 106 tests.
- `npm run build` - first attempt failed while Vite tried to remove
  `dist/win-unpacked` because a previous packaged `SkillDrive Desktop.exe`
  process was still running from that generated directory. After stopping those
  generated build-output processes, the same command passed.
- `python scripts\validate_agents_docs.py --level ERROR` - passed after
  implementation documentation updates with 0 errors and 0 warnings.
- `git diff --check` - passed after implementation documentation updates; Git
  reported expected Windows LF-to-CRLF working-copy warnings only.
- `npm run dist:win` - passed after adding the runtime ZIP extraction
  dependency, preserving Windows installer generation.
- `node -e "const asar=require('@electron/asar'); ..."` - confirmed
  packaged `app.asar` includes `node_modules/extract-zip`.
- `npm test -- src/__tests__/package-scripts.test.ts` - RED before macOS
  signing config because `hardenedRuntime` was undefined and entitlements files
  were missing; passed after implementation with 4 tests.
- `npm run build` - passed after macOS release signing configuration.
- `npm run dist:win` - passed after macOS release signing configuration,
  preserving Windows installer generation.

## Outcome

Pending. Cross-platform archive extraction and macOS release signing
configuration are implemented and Windows-validated. This plan remains active
until macOS notarization, stapling, Gatekeeper, and manual smoke validation are
complete or the release path is superseded.
