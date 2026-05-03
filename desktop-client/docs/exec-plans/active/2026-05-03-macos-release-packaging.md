# macOS Release Packaging Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SkillDrive Desktop produce a publishable macOS DMG after a future macOS-machine validation pass.

**Architecture:** Keep packaging as an `electron-builder` wrapper around the existing Vite renderer and Electron main/preload outputs. Before macOS can be released, replace Windows-only package extraction with a safe cross-platform ZIP extraction path, add explicit macOS entitlements and signing configuration, then validate Developer ID signing, Apple notarization, stapling, Gatekeeper, and app behavior on macOS.

**Tech Stack:** Electron, Vite, TypeScript, electron-builder, Developer ID signing, Apple notarytool/stapler, Vitest, repository documentation gates.

---

## Scope

- Prepare macOS release packaging product specs in English and Chinese.
- Add technical design for macOS release packaging, signing, notarization, and
  runtime blockers.
- Add a macOS release operation runbook that can be executed later on a macOS
  build machine.
- Track future implementation tasks for cross-platform extraction, entitlements,
  electron-builder config, and macOS validation.
- Update indexes, architecture, security, references, and task tracker.

## Non-Goals

- No macOS build execution on the current Windows machine.
- No Apple credential creation or storage in this repository.
- No code change in this documentation-only preparation phase.
- No Mac App Store distribution.
- No auto-update work.
- No Windows packaging regression scope beyond preserving existing behavior.

## Progress

- [x] 2026-05-03: Reviewed repository workflow, execution gates, desktop
  guidance, task tracker, product/design/reference indexes, current packaging
  docs, current package configuration, electron-builder local schema, and Apple
  Developer ID/notarization documentation.
- [x] 2026-05-03: Confirmed macOS remains blocked by Windows-only archive
  extraction and lack of macOS signing/notarization release validation.
- [x] 2026-05-03: Added English and Chinese macOS release product specs.
- [x] 2026-05-03: Added macOS release packaging technical design.
- [x] 2026-05-03: Added macOS release runbook for the future macOS build
  machine.
- [x] 2026-05-03: Added active ExecPlan and task checklist.
- [ ] Future implementation: cross-platform extraction and macOS signing config.
- [ ] Future macOS validation: signed DMG, notarization, stapling, Gatekeeper,
  and manual smoke test.

## Decisions

- The macOS DMG is not releaseable until runtime distribution works on macOS.
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

Future implementation files:

| File | Possible Change |
|------|-----------------|
| `package.json` | Add explicit macOS entitlements/signing/notarization config |
| `electron/main.ts` | Remove Windows-only extraction dependency |
| `src/core/distribution/archive-extraction.ts` | Add safe cross-platform ZIP extraction helper if split out |
| `src/__tests__/archive-extraction.test.ts` | Cover safe extraction and traversal rejection |
| `build/entitlements.mac.plist` | App entitlements |
| `build/entitlements.mac.inherit.plist` | Inherited Electron helper entitlements |

## Implementation Tasks

See `2026-05-03-macos-release-packaging-tasks.md`.

## Validation Plan

Windows documentation phase:

```bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Future implementation phase:

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

## Outcome

Pending. This plan remains active until macOS runtime support, release
configuration, notarization, and manual smoke validation are complete or the
release path is superseded.
