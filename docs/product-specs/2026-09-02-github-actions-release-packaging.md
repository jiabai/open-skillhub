# GitHub Actions Release Packaging

## User-Visible Goal

Desktop client release artifacts (Windows installer, macOS dmg/zip, and Linux
CLI tarball) are built and published by GitHub Actions instead of a local
developer machine, so that pushing a version tag (for example `v0.1.5`)
produces a reviewable GitHub Release with attached, checksummed artifacts.

## Scope

- Add a GitHub Actions workflow that triggers on `v*` tag push and on manual
  dispatch (`workflow_dispatch`).

- Windows job (`windows-latest`, Node 20): install dependencies, run the
  desktop test suite, build, run `npm run dist:win` (NSIS installer), upload
  installer artifacts.

- macOS job (`macos-latest`, Node 20): install dependencies, build, run
  `npm run dist:mac -- --x64` and `npm run dist:mac -- --arm64` (unsigned
  per-architecture dmg files for Intel and Apple Silicon), upload the dmg
  artifacts. The desktop test suite is not run here because it contains
  Windows-path assumptions; tests gate the release through the Windows job.

- Linux CLI job (`ubuntu-latest`, Node 20): install dependencies, run
  `npm run package:linux-cli`, upload the tarball and `.sha256` artifacts.

- On tag push, create a GitHub Release for the tag and attach the artifacts
  from all jobs. On manual dispatch, upload workflow artifacts only (no
  release), so the pipeline can be tested safely.

- Document the new release flow in the desktop client references and this
  spec's companion execution plan.

## Non-Goals

- No macOS code signing or notarization; macOS artifacts are unsigned and
  Gatekeeper will require an explicit override to launch. Paid Developer ID
  signing stays deferred per `2026-05-03-macos-release-packaging`.

- No code signing or auto-update infrastructure on any platform.

- No backend or frontend console CI changes.

- No changes to packaging commands beyond the builder configuration fixes
  required by CI reality: adding `!dist/mac-*/**/*`, `!dist/*.dmg`, and
  `!dist/*.exe` to the electron-builder `files` exclusion list so sequential
  macOS builds do not leak earlier build outputs into the asar (the renderer
  output directory and the builder output directory are both `dist/`),
  narrowing `win.target` to `nsis` only (dropping the portable target), and
  narrowing `mac.target` to `dmg` only (dropping the zip target).

- No release-branch or nightly build channels.

## Affected Surfaces

- New: `.github/workflows/desktop-release.yml`

- Docs: `desktop-client/docs/exec-plans/` (new active plan + checklist),
  `desktop-client/docs/references/` release runbook note,
  `docs/product-specs/index.md`, `desktop-client/docs/exec-plans/active/index.md`

- No application code, contracts, or data model changes.

## Acceptance Criteria

- Pushing a `v*` tag runs all jobs; a draft or published GitHub Release for
  the tag contains the Windows `.exe` installer, the macOS `.dmg` files (one
  per architecture), and the Linux CLI tarball with its `.sha256`.

- Manual dispatch runs the same build steps and exposes artifacts on the
  workflow run page without creating a release.

- The Windows job fails if the desktop test suite fails (tests gate the
  package step). The macOS job gates on successful build and packaging.

- Artifact names derive from the package version and remain stable across
  runs.

- Repository documentation gates pass
  (`python scripts/validate_agents_docs.py --level ERROR`).

