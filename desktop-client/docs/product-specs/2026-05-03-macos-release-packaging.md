# macOS Release Packaging

Status: canonical local product spec; cross-platform extraction implemented, initial unsigned macOS packaging retained, paid release signing deferred

## Purpose

Keep macOS packaging available as an exploratory builder configuration while
documenting the future path to a releaseable direct-download artifact for
SkillDrive Desktop. The initial output uses the current unsigned
`package.json` `build.mac` settings because paid Developer ID signing and Apple
notarization are deferred.

This spec does not claim macOS support is already ready. It defines the current
unsigned packaging posture and the work still required before `npm run dist:mac`
output can be treated as a public macOS installer.

## Goals

- Preserve the existing review-first sync and explicit distribution model on
  macOS.
- Keep runtime package extraction independent of Windows shell tooling before
  macOS is considered releaseable.
- Keep the current `electron-builder` macOS config explicit about deferring paid
  signing and notarization.
- Document Developer ID signing, notarization, and stapling as a future public
  release path instead of a current requirement.
- Keep Apple certificates, API keys, app-specific passwords, and keychain
  profiles out of source control.
- Provide an operator runbook that can be executed later on a macOS build
  machine.
- Keep Windows packaging behavior unchanged.

## Non-Goals

- No Mac App Store distribution in this release path.
- No auto-update server or update UI.
- No Linux packaging.
- No Apple Developer Program purchase or Developer ID signing in the initial
  macOS packaging phase.
- No unsigned public macOS builds.
- No storage of Apple signing or notarization credentials in repository files.
- No macOS build execution on the current Windows machine.

## Affected Surfaces

- Electron main-process package extraction and distribution runtime.
- `electron-builder` macOS configuration in `package.json`.
- Future macOS entitlements files under `build/`.
- Release credentials configured in the macOS operator environment or keychain.
- Documentation under product specs, design docs, references, ExecPlans, and
  task tracker.

## Current State

- `package.json` exposes `npm run dist:mac`, configures `dmg` plus `zip`
  targets with `resources/icons/icon.icns`, sets `identity` to `null`, keeps
  Hardened Runtime enabled, and intentionally sets `forceCodeSigning` and
  `notarize` to `false`.
- Runtime package extraction now uses `extractZipArchive()` from
  `src/core/distribution/archive-extraction.ts`; focused tests cover valid
  extraction, traversal rejection, symlink rejection, and absolute destination
  enforcement.
- The repository includes future-ready `build/entitlements.mac.plist` and
  `build/entitlements.mac.inherit.plist`; they contain Electron hardened
  runtime code-signing entitlements only and no release secrets, but the current
  `build.mac` config does not reference them.
- The repository does not include a separate notarization helper script because
  notarization is not enabled in the initial package configuration.
- The current Windows environment cannot produce or validate the final macOS
  artifact; validation must run on macOS. A signed and notarized public release
  additionally requires future Apple credentials.

## Release Requirements

For the initial exploratory macOS packaging phase, all of the following must be
true:

- `npm test` passes on the macOS build machine.
- `npm run build` passes on the macOS build machine.
- Runtime package extraction no longer depends on Windows PowerShell and has
  Windows-side automated coverage.
- `npm run dist:mac` produces local macOS artifacts using the current unsigned
  `build.mac` configuration.
- Manual smoke testing confirms first launch, bridge availability, API
  configuration, sync review state, explicit distribution, Local Skills,
  theme/locale persistence, and clean quit/relaunch behavior.

Before a macOS DMG is publishable as a public direct-download artifact, all of
the following must also be true:

- The paid Developer ID release path is approved.
- `package.json` is updated to require code signing and notarization.
- `npm run dist:mac` produces a signed `.app`, `.dmg`, and `.zip`.
- The app is signed with a Developer ID Application identity.
- Hardened Runtime is enabled.
- Entitlements are explicit and minimal for the Electron runtime.
- The DMG is submitted to Apple notarization with `notarytool`.
- The notarization ticket is stapled to the DMG.
- Gatekeeper assessment passes on the stapled DMG or installed app.

## Acceptance Criteria

- Safe cross-platform ZIP extraction is implemented without Windows PowerShell
  and has focused regression coverage.
- Future macOS signing entitlements are documented, committed, and covered by
  tests without secrets.
- `package.json` keeps macOS builds on `dmg` and `zip`, enables Hardened
  Runtime, and explicitly documents that code signing and notarization are
  disabled for the initial phase.
- The macOS runbook can be followed on a clean macOS build machine without
  relying on chat history.
- Apple signing and notarization credentials are referenced only as future
  operator environment/keychain inputs.
- `python scripts/validate_agents_docs.py --level ERROR` passes after the docs
  are updated.
- The final public release remains blocked until the paid Developer ID path is
  resumed and macOS machine validation records `npm test`, `npm run build`,
  `npm run dist:mac`, notarization, stapling, and smoke-test results.

## References

- Technical design: `../design-docs/macos-release-packaging.md`
- Operator runbook: `../references/macos-release-runbook.md`
- Windows packaging spec: `2026-05-02-desktop-packaging.md`
- Runtime and storage surface: `../references/runtime-and-storage-surface.md`
- Apple Developer ID: https://developer.apple.com/developer-id/
- Apple notarization: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple notarization workflow: https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- electron-builder macOS signing: https://www.electron.build/code-signing-mac
