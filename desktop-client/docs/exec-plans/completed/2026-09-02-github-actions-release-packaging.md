# GitHub Actions Release Packaging Plan

**Goal:** Build and publish desktop client release artifacts (Windows
installer, macOS dmg/zip, Linux CLI tarball) through a GitHub Actions
workflow triggered by version tags, replacing local-machine release builds.

**Spec:** `docs/product-specs/2026-09-02-github-actions-release-packaging.md`

**Architecture:** A single workflow file `.github/workflows/desktop-release.yml`
with three independent build jobs (Windows installer, macOS package, Linux CLI
package). All jobs reuse the already-validated local commands so CI packaging
cannot drift from the documented packaging runbook. macOS artifacts are
unsigned (Developer ID signing and notarization stay deferred per
`2026-05-03-macos-release-packaging`). Release publication happens only for
tag pushes; manual dispatch builds and uploads workflow artifacts only.

**Tech Stack:** GitHub Actions (windows-latest, macos-latest, ubuntu-latest),
Node 20, npm, electron-builder, existing `package:linux-cli` assembly script,
GitHub Releases API.

---

## Progress

- [x] 2026-09-02: Spec approved; workflow implemented, docs updated,
      documentation gates passed.
- [x] 2026-09-02: Manual `workflow_dispatch` run 33637864542 passed both
      build jobs, uploaded `windows-installer` and `linux-cli` artifacts, and
      correctly skipped the draft-release job.
- [x] 2026-09-02: Scope extended by owner request to include unsigned macOS
      dmg/zip artifacts; spec updated, macOS job added to the workflow.
- [x] 2026-09-02: First dispatch with the macOS job failed at the Test step:
      the desktop suite has Windows-path assumptions (hardcoded `C:\...`
      paths, Windows absolute-path validation). Removed the Test step from
      the macOS job; tests gate the release through the Windows job.
- [x] 2026-09-02: Second dispatch failed at the universal merge: the
      renderer build output directory (`dist/`) collides with
      electron-builder's output directory, so the x64 temp app
      (`dist/mac-universal-x64-temp/`) leaked into the arm64 asar via the
      `files: ["dist/**/*"]` glob. Fixed by adding `!dist/mac-*/**/*` to the
      builder `files` exclusion list in `desktop-client/package.json` (the
      first real macOS packaging validation — this config had never run on
      macOS before). Also added `--publish never` to CI `dist:win`/`dist:mac`
      invocations to suppress electron-builder's implicit CI auto-publish.
- [x] 2026-09-03: Owner reviewed artifact sizes versus v0.1.4 and decided to
      slim the release: dropped the Windows `portable` target (NSIS only),
      dropped the macOS `zip` target, and replaced the universal build with
      per-architecture dmg files (Intel + Apple Silicon). Added
      `!dist/*.dmg` and `!dist/*.exe` to the `files` exclusion list so the
      second sequential macOS build does not package the first build's dmg
      into its asar.
- [x] Tag-path validation (2026-09-03, run 33663896024): a `v0.1.5` tag
      push produced a draft GitHub Release with all five assets (Windows
      NSIS installer, Intel dmg, Apple Silicon dmg, Linux CLI tarball +
      sha256). One workflow fix was needed: `GH_REPO` env for
      `gh release create` in a job without checkout.

---

## Files to Change

| File | Change |
|------|--------|
| `.github/workflows/desktop-release.yml` | New workflow: tag `v*` + `workflow_dispatch` triggers, two build jobs, artifact upload, conditional release step |
| `desktop-client/docs/references/README.md` or release runbook reference | Document the CI release flow alongside local packaging |
| `desktop-client/docs/exec-plans/active/github-actions-release-packaging-plan.md` | This plan |
| `desktop-client/docs/exec-plans/active/github-actions-release-packaging-tasks.md` | Task checklist |
| `desktop-client/docs/exec-plans/active/index.md` | List the new plan and checklist |
| `docs/product-specs/index.md` | List the new spec |

## Order of Work

1. Create the workflow YAML with both jobs and the conditional release step.
2. Validate workflow syntax (actionlint if available, otherwise YAML parse and
   careful review of action versions against official docs).
3. Update reference docs and indexes.
4. Run documentation gates.
5. Trigger a manual dispatch on a branch or the default branch to verify both
   jobs pass end-to-end.
6. On the next release tag, verify the GitHub Release contains all artifacts.

## Validation

```bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Plus a manual `workflow_dispatch` run confirming:

- Windows job completes `npm test`, `npm run build`, `npm run dist:win`.
- macOS job completes `npm run build`, `npm run dist:mac -- --x64`,
  `npm run dist:mac -- --arm64` and uploads `dist/*.dmg`.
- Linux job completes `npm run package:linux-cli` and uploads
  `dist/linux-cli/*` (tarball + `.sha256`).
- No release is created for the dispatch run.

## Decisions to Track

- **Node version:** 20, matching `@types/node` in `desktop-client/package.json`.
- **macOS architecture:** per-architecture builds (`npm run dist:mac --
  --x64` then `--arm64`) on one `macos-latest` runner, producing an Intel
  dmg and an Apple Silicon dmg. Dropped the universal build and the zip
  target on 2026-09-03 to keep artifact sizes close to the v0.1.4 baseline.
  Unsigned; Gatekeeper requires right-click Open or `xattr -cr` override —
  documented in the CI release runbook.
- **Windows targets:** NSIS only. The `portable` target was dropped on
  2026-09-03; v0.1.4 never shipped a portable build either.
- **Release creation:** `softprops/action-gh-release` (or `gh release create`)
  gated on tag push only; draft release first so a human reviews assets before
  publishing.
- **Native modules:** `keytar` ships prebuilds and electron-builder rebuilds
  for Electron; if the Windows job fails on native rebuild, fall back to
  documenting `npm_config_build_from_source` or pinned toolchain versions.
- **Executable bits:** the Linux CLI tarball is assembled on `ubuntu-latest`
  so `bin/`, `install.sh`, and `uninstall.sh` keep executable permissions
  without Git index tricks.
- **Artifact naming:** keep builder defaults (`SkillDrive Desktop Setup
  <version>.exe`, portable exe) and the CLI tarball name produced by
  `package:linux-cli`; spaces in artifact names are accepted for v1.

## Risks

- Windows runner may hit native build issues (`keytar`) that did not appear on
  the developer machine — mitigation: prebuilds plus electron-builder rebuild;
  if it fails, capture the log and pin the Python/Visual Studio toolchain.
- Release asset upload requires the default `GITHUB_TOKEN` with `contents:
  write` permission — must be declared explicitly in the workflow.
