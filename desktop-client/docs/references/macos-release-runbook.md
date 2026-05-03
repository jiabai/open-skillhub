# macOS Release Runbook

Status: operator runbook prepared on Windows; execute on macOS after signing configuration gates are complete

## Purpose

This runbook is the handoff for building, signing, notarizing, stapling, and
smoke-testing a publishable SkillDrive Desktop macOS DMG on a macOS machine.

Do not treat this as proof that macOS is already release-ready. The first gate
below must be satisfied before running the release commands.

## Release Readiness Gate

Stop before release packaging unless all of these are true:

- The active macOS release ExecPlan records passing cross-platform archive
  extraction tests.
- `electron/main.ts` uses `extractZipArchive()` instead of Windows PowerShell
  for package extraction.
- macOS entitlements files are committed and do not contain secrets.
- `package.json` macOS release config points at those entitlements.
- The macOS machine has Xcode command line tools and current `notarytool`.
- The release operator has a Developer ID Application certificate and Apple
  notarization credentials available outside the repository.

## Official References

- Apple Developer ID: https://developer.apple.com/developer-id/
- Apple notarization: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple custom notarization workflow: https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- electron-builder macOS signing: https://www.electron.build/code-signing-mac
- electron-builder macOS config: https://www.electron.build/electron-builder.Interface.MacConfiguration.html

## macOS Machine Prerequisites

Install or verify:

```bash
xcode-select -p
xcodebuild -version
xcrun notarytool --version
xcrun stapler --version
node --version
npm --version
git --version
```

Expected:

- Xcode command line tooling is installed and selected.
- `notarytool` and `stapler` are available through `xcrun`.
- Node/npm versions are compatible with the desktop client.

## Signing Certificate Setup

The macOS release machine needs a Developer ID Application certificate in the
login keychain.

Check available identities:

```bash
security find-identity -v -p codesigning
```

Expected:

- Output includes a `Developer ID Application: ... (TEAMID)` identity.
- Do not paste certificate private keys or passwords into repository files.

If the certificate is supplied as a `.p12` for a temporary build machine, import
it into a local keychain outside the repository and delete the `.p12` after the
release is complete. If using electron-builder's `CSC_LINK` and
`CSC_KEY_PASSWORD`, set them only in the shell or CI secret store.

## Notarization Credential Setup

Use one of the credential paths supported by electron-builder.

### Preferred: App Store Connect API Key

Store the `.p8` key outside the repository, then export:

```bash
export APPLE_API_KEY="/absolute/path/outside/repo/AuthKey_KEYID.p8"
export APPLE_API_KEY_ID="KEYID"
export APPLE_API_ISSUER="issuer-uuid"
```

### Alternative: Keychain Profile

Create a keychain profile once:

```bash
xcrun notarytool store-credentials "skilldrive-notary" \
  --apple-id "release@example.com" \
  --team-id "TEAMID" \
  --password "app-specific-password"
```

Then export for electron-builder:

```bash
export APPLE_KEYCHAIN_PROFILE="skilldrive-notary"
```

If the build uses a non-default keychain, also set:

```bash
export APPLE_KEYCHAIN="/absolute/path/to/login.keychain-db"
```

### Alternative: Apple ID Environment Variables

Use only for local operator shells or CI secrets:

```bash
export APPLE_ID="release@example.com"
export APPLE_TEAM_ID="TEAMID"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

Never commit these values.

## Clean Checkout

Use the release branch that contains the macOS implementation:

```bash
git clone <repo-url> open-skillhub-macos-release
cd open-skillhub-macos-release
git checkout <release-branch>
cd desktop-client
```

If using an existing checkout:

```bash
git status --short
git pull --ff-only
cd desktop-client
```

Expected:

- No unrelated working tree changes.
- The checked-out branch contains the macOS release implementation and docs.

## Install Dependencies

```bash
npm install
```

Expected:

- Dependencies install without modifying committed source files unexpectedly.
- If `package-lock.json` changes, stop and inspect why before release.

## Automated Validation

Run the desktop gates before packaging:

```bash
npm test
npm run build
```

Expected:

- All Vitest files pass.
- TypeScript/Electron build completes.
- `dist/` and `dist-electron/` are generated outputs only.

## Build Signed macOS Artifacts

Confirm signing identity:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

Build:

```bash
npm run dist:mac
```

Expected artifacts:

- `dist/*.dmg`
- `dist/*.zip`
- `dist/mac*/SkillDrive Desktop.app`

If electron-builder says it used an ad-hoc identity, stop. A public release must
use Developer ID signing.

## Verify Code Signing

Adjust the path if electron-builder uses `mac-arm64`, `mac-x64`, or `mac`:

```bash
APP_PATH="$(find dist -maxdepth 3 -name 'SkillDrive Desktop.app' -print -quit)"
echo "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -E "Authority|TeamIdentifier|Runtime"
spctl --assess --type execute --verbose "$APP_PATH"
```

Expected:

- `codesign --verify` exits 0.
- Authority includes `Developer ID Application`.
- Hardened Runtime is present.
- `spctl --assess --type execute` accepts the app or gives only a notarization
  warning that will be resolved after stapling.

## Notarize And Staple

Find the DMG:

```bash
DMG_PATH="$(find dist -maxdepth 1 -name '*.dmg' -print -quit)"
echo "$DMG_PATH"
```

If electron-builder did not already notarize the artifact, submit manually:

```bash
xcrun notarytool submit "$DMG_PATH" \
  --keychain-profile "skilldrive-notary" \
  --wait
```

If using API key env vars instead of a keychain profile, use the matching
`notarytool` authentication flags from Apple's documentation.

Staple:

```bash
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
```

Expected:

- Notarization status is `Accepted`.
- `stapler validate` exits 0.

If notarization fails:

```bash
xcrun notarytool log <submission-id> --keychain-profile "skilldrive-notary" notarization-log.json
```

Attach the log to the active ExecPlan and do not publish the DMG.

## Gatekeeper Assessment

Assess the stapled DMG:

```bash
spctl --assess --type open --context context:primary-signature --verbose "$DMG_PATH"
```

Mount the DMG:

```bash
hdiutil attach "$DMG_PATH"
```

Drag `SkillDrive Desktop.app` to `/Applications`, then assess the installed app:

```bash
spctl --assess --type execute --verbose "/Applications/SkillDrive Desktop.app"
```

Expected:

- Gatekeeper accepts the DMG and installed app.
- The DMG opens cleanly and shows the app plus Applications link.

Detach after inspection. The mounted volume name may include the app version;
use the `/Volumes/...` path printed by `hdiutil attach`:

```bash
hdiutil detach "/Volumes/SkillDrive Desktop 0.1.0" || hdiutil detach "/Volumes/SkillDrive Desktop" || true
```

## Manual Smoke Test

Use a non-production SkillDrive backend unless this is a final production
release candidate.

1. Launch `/Applications/SkillDrive Desktop.app`.
2. Confirm the app opens without Gatekeeper warnings.
3. Confirm the renderer loads and the desktop bridge is available.
4. Confirm missing-token state appears if no token is configured.
5. Configure API URL and token, or use `SKILLDRIVE_API_BASE_URL` and
   `SKILLDRIVE_API_TOKEN` from the launch environment.
6. Run connection test.
7. Refresh sync state.
8. Confirm pending review state renders.
9. Run pre-distribution check on a safe test target.
10. Distribute one test skill to a temporary or disposable agent skills
    directory.
11. Confirm explicit approval is required before distribution.
12. Confirm Local Skills inventory renders and does not upload without explicit
    row action.
13. Toggle theme and language, quit, relaunch, and confirm persistence.
14. Quit fully and relaunch; confirm no duplicate instance behavior.

If any step fails, record:

- macOS version
- chip architecture
- exact artifact name
- failing command or UI step
- terminal output or screenshot
- whether the failure blocks release

## Release Evidence Template

Copy this into the active ExecPlan after running the macOS release:

```text
macOS release validation:
- Machine: <Mac model, chip, macOS version>
- Xcode: <xcodebuild -version>
- Node/npm: <versions>
- Branch/commit: <sha>
- npm test: <passed/failed, count>
- npm run build: <passed/failed>
- npm run dist:mac: <passed/failed>
- DMG: <filename, size>
- ZIP: <filename, size>
- codesign verify: <passed/failed>
- notarization: <Accepted/submission id>
- stapler validate: <passed/failed>
- spctl DMG: <accepted/rejected>
- spctl installed app: <accepted/rejected>
- manual smoke: <passed/failed, notes>
- residual risk: <none or explicit risk>
```

## Cleanup

After release:

```bash
rm -f notarization-log.json
unset APPLE_ID APPLE_TEAM_ID APPLE_APP_SPECIFIC_PASSWORD
unset APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER
unset APPLE_KEYCHAIN APPLE_KEYCHAIN_PROFILE
unset CSC_LINK CSC_KEY_PASSWORD
```

Keep release artifacts only in the approved release storage location. Do not
commit `dist/`, `.p12`, `.p8`, keychain files, notarization logs containing team
metadata, or generated app bundles.
