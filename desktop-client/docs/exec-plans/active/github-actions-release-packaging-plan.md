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
- [ ] Tag-path validation: confirm a `v*` tag push produces a draft release
      with all artifacts including macOS dmg/zip.

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
- macOS job completes `npm test`, `npm run build`, `npm run dist:mac --
  --universal` and uploads `dist/*.dmg` and `dist/*.zip`.
- Linux job completes `npm run package:linux-cli` and uploads
  `dist/linux-cli/*` (tarball + `.sha256`).
- No release is created for the dispatch run.

## Decisions to Track

- **Node version:** 20, matching `@types/node` in `desktop-client/package.json`.
- **macOS architecture:** universal build (`npm run dist:mac -- --universal`)
  on `macos-latest`, producing one dmg + zip that runs on both Intel and
  Apple Silicon Macs. Unsigned; Gatekeeper requires right-click Open or
  `xattr -cr` override — documented in the CI release runbook.
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
