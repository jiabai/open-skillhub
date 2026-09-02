# CI Release Runbook

Desktop release artifacts are built by the GitHub Actions workflow
`.github/workflows/desktop-release.yml` instead of a local developer machine.

## Triggers

- **Tag push (`v*`)**: builds all artifacts and creates a draft GitHub
  Release for the tag with all artifacts attached. A human reviews the assets
  and publishes the draft.

- **Manual dispatch (`workflow_dispatch`)**: runs the same build jobs and
  exposes artifacts on the workflow run page only. No release is created.
  Use this to validate pipeline changes safely.

## Jobs

| Job                  | Runner           | Steps                                                                                 | Artifacts                                                                                                           |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Windows installer    | `windows-latest` | `npm ci`, `npm test`, `npm run build`, `npm run dist:win`                             | `SkillDrive Desktop Setup <version>.exe` (NSIS)                                                                     |
| macOS package        | `macos-latest`   | `npm ci`, `npm run build`, `npm run dist:mac -- --x64`, `npm run dist:mac -- --arm64` | `SkillDrive Desktop-<version>.dmg` (Intel), `SkillDrive Desktop-<version>-arm64.dmg` (Apple Silicon; both unsigned) |
| Linux CLI package    | `ubuntu-latest`  | `npm ci`, `npm run package:linux-cli`                                                 | `skilldrive-cli-<version>-linux-node20.tar.gz` + `.sha256`                                                          |
| Draft GitHub Release | `ubuntu-latest`  | download artifacts, `gh release create --draft --generate-notes`                      | (tag push only)                                                                                                     |

macOS artifact naming: the dmg without an arch suffix is the Intel (x64)
build; the `-arm64` suffix marks the Apple Silicon build. Both are produced
on the same runner in one job.

The Linux CLI tarball is assembled on Linux so `bin/skilldrive-cli`,
`install.sh`, and `uninstall.sh` keep executable permissions.

## Release Steps

1. Bump `desktop-client/package.json` version and commit
   (`chore: bump desktop client version to <version>`).
2. Tag and push: `git tag v<version> && git push origin v<version>`.
3. Wait for all build jobs and the release job to finish.
4. Review the draft GitHub Release assets (Windows installer, macOS dmg
   files, CLI tarball + `.sha256`), then publish it.
5. Smoke-test the installed Windows app per the checklist in
   `../exec-plans/active/2026-05-03-desktop-windows-packaging-tasks.md`.

## Notes

- The workflow requires `permissions: contents: write` for release creation;
  it uses the default `GITHUB_TOKEN`.

- The desktop test suite runs only in the Windows job; several tests contain
  Windows-path assumptions and do not pass on macOS runners.

- No code signing is configured; Windows SmartScreen warnings are expected
  for unsigned installers.

- macOS artifacts are unsigned and not notarized (Developer ID signing is
  deferred per `2026-05-03-macos-release-packaging`). Gatekeeper will block
  first launch: users must right-click the app and choose Open, or run
  `xattr -cr "/Applications/SkillDrive Desktop.app"`. Each dmg targets one
  architecture: plain name for Intel Macs, `-arm64` for Apple Silicon.

- Local packaging commands remain valid for development:
  `npm run dist:win`, `npm run dist:mac`, and `npm run package:linux-cli`
  in `desktop-client/`.

- macOS signing/notarization steps, when later approved, live in
  `macos-release-runbook.md`.
