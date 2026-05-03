# macOS Release Packaging Technical Design

Status: active design; cross-platform extraction implemented, macOS signing configuration and validation pending

## Goal

Define the technical route from exploratory macOS builder output to a
publishable SkillDrive Desktop DMG. The design separates work that can be done
on Windows now from work that must happen on a macOS build machine later.

## Source Requirements

- Apple Developer ID signing is required for direct distribution outside the Mac
  App Store.
- Apple notarization should be part of the direct distribution release path.
- Apple no longer accepts notarization uploads through `altool`; use
  `notarytool` through current Xcode tooling.
- electron-builder can sign macOS apps when a valid identity is available and
  supports notarization when the required Apple credential environment variables
  or keychain profile are present.
- electron-builder macOS builds should use Hardened Runtime and explicit
  entitlements for Electron.

## Current Blockers

1. macOS entitlements are not present in the repository.
2. `package.json` does not yet include explicit macOS signing/notarization
   release configuration.
3. The current machine is Windows, so the final signed DMG, notarization,
   stapling, Gatekeeper checks, and macOS runtime smoke test cannot be
   completed here.

Resolved in the Windows implementation pass:

- `electron/main.ts` no longer shells out to Windows PowerShell for downloaded
  skill package extraction.
- `src/__tests__/archive-extraction.test.ts` covers safe ZIP extraction,
  traversal rejection, symlink rejection, and absolute extraction destinations.

## Proposed Implementation Shape

### Cross-Platform Extraction

The Windows-only `extractArchive()` dependency has been replaced with
`extractZipArchive()` in `src/core/distribution/archive-extraction.ts`:

- ZIP path traversal rejection is provided by `extract-zip`.
- Symlink entries are rejected before materialization.
- Archive and extraction destination paths must be absolute.
- Extract into the existing package-service temporary directory.
- Preserve existing checksum and expiry checks before extraction.
- Keep package-service cleanup ownership unchanged.

The implementation is covered by Windows-side Vitest coverage that does not
require macOS. macOS runtime smoke testing remains required before release.

### macOS Builder Configuration

After extraction is cross-platform, update `package.json` macOS config to make
release intent explicit:

- `target`: keep `dmg` and `zip`.
- `icon`: keep `resources/icons/icon.icns`.
- `hardenedRuntime`: `true`.
- `entitlements`: add an explicit app entitlements file.
- `entitlementsInherit`: add an explicit inherited entitlements file.
- `notarize`: leave enabled by default for release builds once credentials are
  supplied.

The concrete entitlement set should be minimal. Electron commonly needs JIT
support for renderer/framework execution; avoid broad file, network, or sandbox
entitlements unless a failing macOS smoke test proves they are required.

### Credential Handling

Do not commit Apple credentials. The release operator must configure one of the
electron-builder supported notarization credential paths on the macOS machine:

- App Store Connect API key triplet:
  `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.
- Apple ID path:
  `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
- Keychain profile path:
  `APPLE_KEYCHAIN`, `APPLE_KEYCHAIN_PROFILE`.

For signing, prefer the Developer ID Application certificate installed in the
macOS login keychain. CI-style `.p12` import through `CSC_LINK` and
`CSC_KEY_PASSWORD` is allowed only as local/CI secret configuration, never as
repository content.

## File Plan

| File | Responsibility |
|------|----------------|
| `package.json` | Remaining: add explicit macOS release signing/notarization config |
| `electron/main.ts` | Implemented: call cross-platform extraction helper |
| `src/core/distribution/archive-extraction.ts` | Implemented: own safe ZIP extraction rules |
| `src/__tests__/archive-extraction.test.ts` | Implemented: cover safe extraction and unsafe archive rejection |
| `build/entitlements.mac.plist` | Remaining: app entitlements for Developer ID macOS build |
| `build/entitlements.mac.inherit.plist` | Remaining: inherited entitlements for Electron helpers/frameworks |
| `docs/references/macos-release-runbook.md` | Operator release checklist and command transcript |

## Windows-Side Documentation Deliverables

Completed in this documentation phase:

- Product spec in English and Chinese.
- Technical design.
- macOS release runbook.
- Active ExecPlan and task checklist for implementation and validation.
- Security documentation for Apple release secrets.
- Index and tracker updates.

## macOS Validation Gates

On a macOS build machine:

```bash
cd desktop-client
npm install
npm test
npm run build
npm run dist:mac
```

Then verify signing, notarization, stapling, and Gatekeeper:

```bash
codesign --verify --deep --strict --verbose=2 "dist/mac*/SkillDrive Desktop.app"
spctl --assess --type execute --verbose "dist/mac*/SkillDrive Desktop.app"
xcrun stapler validate "dist/SkillDrive Desktop 0.1.0.dmg"
spctl --assess --type open --context context:primary-signature --verbose "dist/SkillDrive Desktop 0.1.0.dmg"
```

Manual smoke testing remains required after the app is installed from the DMG.

## References

- Product spec: `../product-specs/2026-05-03-macos-release-packaging.md`
- Operator runbook: `../references/macos-release-runbook.md`
- Apple Developer ID: https://developer.apple.com/developer-id/
- Apple notarization: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple notarization workflow: https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- electron-builder macOS signing: https://www.electron.build/code-signing-mac
- electron-builder macOS configuration: https://www.electron.build/electron-builder.Interface.MacConfiguration.html
