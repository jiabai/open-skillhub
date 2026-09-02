# GitHub Actions Release Packaging

## User-Visible Goal

Desktop client release artifacts (Windows installer and Linux CLI tarball) are
built and published by GitHub Actions instead of a local developer machine, so
that pushing a version tag (for example `v0.1.5`) produces a reviewable GitHub
Release with attached, checksummed artifacts.

## Scope

- Add a GitHub Actions workflow that triggers on `v*` tag push and on manual
  dispatch (`workflow_dispatch`).
- Windows job (`windows-latest`, Node 20): install dependencies, run the
  desktop test suite, build, run `npm run dist:win` (NSIS + portable), upload
  installer artifacts.
- Linux CLI job (`ubuntu-latest`, Node 20): install dependencies, run
  `npm run package:linux-cli`, upload the tarball and `.sha256` artifacts.
- On tag push, create a GitHub Release for the tag and attach the artifacts
  from both jobs. On manual dispatch, upload workflow artifacts only (no
  release), so the pipeline can be tested safely.
- Document the new release flow in the desktop client references and this
  spec's companion execution plan.

## Non-Goals

- No macOS release builds; macOS packaging remains exploratory per
  `2026-05-03-macos-release-packaging`.
- No code signing, notarization, or auto-update infrastructure.
- No backend or frontend console CI changes.
- No changes to packaging commands, builder configuration, or artifact layout
  — the workflow invokes the existing validated commands
  (`npm test`, `npm run build`, `npm run dist:win`,
  `npm run package:linux-cli`).
- No release-branch or nightly build channels.

## Affected Surfaces

- New: `.github/workflows/desktop-release.yml`
- Docs: `desktop-client/docs/exec-plans/` (new active plan + checklist),
  `desktop-client/docs/references/` release runbook note,
  `docs/product-specs/index.md`, `desktop-client/docs/exec-plans/active/index.md`
- No application code, contracts, or data model changes.

## Acceptance Criteria

- Pushing a `v*` tag runs both jobs; a draft or published GitHub Release for
  the tag contains the Windows `.exe` artifacts and the Linux CLI tarball with
  its `.sha256`.
- Manual dispatch runs the same build steps and exposes artifacts on the
  workflow run page without creating a release.
- The Windows job fails if the desktop test suite fails (tests gate the
  package step).
- Artifact names derive from the package version and remain stable across
  runs.
- Repository documentation gates pass
  (`python scripts/validate_agents_docs.py --level ERROR`).
