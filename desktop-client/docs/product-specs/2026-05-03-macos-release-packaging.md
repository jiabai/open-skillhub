# macOS Release Packaging

Status: canonical local product spec; documentation and release runbook prepared, implementation and macOS validation pending

## Purpose

Promote macOS packaging from exploratory builder configuration to a releaseable
direct-download artifact for SkillDrive Desktop. The desired output is a
Developer ID-signed, Apple-notarized, stapled `.dmg` that operators can publish
outside the Mac App Store after running the macOS smoke checklist.

This spec does not claim macOS support is already ready. It defines the release
bar and the work still required before `npm run dist:mac` output can be treated
as a public macOS installer.

## Goals

- Preserve the existing review-first sync and explicit distribution model on
  macOS.
- Replace the current Windows-only package extraction dependency before macOS is
  considered releaseable.
- Configure macOS release signing inputs for `electron-builder`.
- Use Developer ID signing for distribution outside the Mac App Store.
- Use Apple notarization and stapling for the final DMG.
- Keep Apple certificates, API keys, app-specific passwords, and keychain
  profiles out of source control.
- Provide an operator runbook that can be executed later on a macOS build
  machine.
- Keep Windows packaging behavior unchanged.

## Non-Goals

- No Mac App Store distribution in this release path.
- No auto-update server or update UI.
- No Linux packaging.
- No unsigned public macOS builds.
- No storage of Apple signing or notarization credentials in repository files.
- No macOS build execution on the current Windows machine.

## Affected Surfaces

- Electron main-process package extraction and distribution runtime.
- `electron-builder` macOS configuration in `package.json`.
- macOS entitlements files under a future build-resource path.
- Release credentials configured in the macOS operator environment or keychain.
- Documentation under product specs, design docs, references, ExecPlans, and
  task tracker.

## Current State

- `package.json` already exposes `npm run dist:mac` and configures `dmg` plus
  `zip` targets with `resources/icons/icon.icns`.
- The current runtime package extraction path in `electron/main.ts` uses
  Windows PowerShell `Expand-Archive` and fails closed on non-Windows platforms.
- The repository does not yet include macOS entitlements files.
- The repository does not yet include a notarization helper script or explicit
  electron-builder notarization configuration.
- The current Windows environment cannot produce the final signed and notarized
  DMG; that final validation must run on macOS with Xcode tooling and Apple
  credentials.

## Release Requirements

Before a macOS DMG is publishable, all of the following must be true:

- `npm test` passes on the macOS build machine.
- `npm run build` passes on the macOS build machine.
- Runtime package extraction no longer depends on Windows PowerShell.
- `npm run dist:mac` produces a signed `.app`, `.dmg`, and `.zip`.
- The app is signed with a Developer ID Application identity.
- Hardened Runtime is enabled.
- Entitlements are explicit and minimal for the Electron runtime.
- The DMG is submitted to Apple notarization with `notarytool`.
- The notarization ticket is stapled to the DMG.
- Gatekeeper assessment passes on the stapled DMG or installed app.
- Manual smoke testing confirms first launch, bridge availability, API
  configuration, sync review state, explicit distribution, Local Skills,
  theme/locale persistence, and clean quit/relaunch behavior.

## Acceptance Criteria

- A future implementation plan replaces Windows-only extraction with a safe
  cross-platform ZIP extraction path and adds focused regression coverage.
- macOS signing entitlements are documented and committed without secrets.
- The macOS runbook can be followed on a clean macOS build machine without
  relying on chat history.
- Apple signing and notarization credentials are referenced only as operator
  environment/keychain inputs.
- `python scripts/validate_agents_docs.py --level ERROR` passes after the docs
  are updated.
- The final release remains blocked until macOS machine validation records
  `npm test`, `npm run build`, `npm run dist:mac`, notarization, stapling, and
  smoke-test results.

## References

- Technical design: `../design-docs/macos-release-packaging.md`
- Operator runbook: `../references/macos-release-runbook.md`
- Windows packaging spec: `2026-05-02-desktop-packaging.md`
- Runtime and storage surface: `../references/runtime-and-storage-surface.md`
- Apple Developer ID: https://developer.apple.com/developer-id/
- Apple notarization: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple notarization workflow: https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- electron-builder macOS signing: https://www.electron.build/code-signing-mac
