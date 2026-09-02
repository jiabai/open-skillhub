# GitHub Actions Release Packaging Tasks

> Companion to `github-actions-release-packaging-plan.md`.

- [x] Create `.github/workflows/desktop-release.yml` with `v*` tag push and
      `workflow_dispatch` triggers.
- [x] Add Windows installer job (`windows-latest`, Node 20): `npm ci`,
      `npm test`, `npm run build`, `npm run dist:win`, upload `dist/*.exe`.
- [x] Add macOS package job (`macos-latest`, Node 20): `npm ci`, `npm test`,
      `npm run build`, `npm run dist:mac -- --universal`, upload
      `dist/*.dmg` and `dist/*.zip` (unsigned; signing deferred).
- [x] Add Linux CLI job (`ubuntu-latest`, Node 20): `npm ci`,
      `npm run package:linux-cli`, upload `dist/linux-cli/*`.
- [x] Add conditional release step (tag push only): create draft GitHub
      Release and attach all artifacts; declare `contents: write` permission.
- [x] Verify workflow YAML syntax (YAML parse check).
- [x] Update desktop-client release runbook reference with the CI flow
      (`docs/references/ci-release-runbook.md`).
- [x] Update `desktop-client/docs/exec-plans/active/index.md` and
      `docs/product-specs/index.md`.
- [x] Run `python scripts/validate_agents_docs.py --level ERROR` and
      `git diff --check`.
- [x] Trigger a manual `workflow_dispatch` run and confirm both jobs pass with
      artifacts attached and no release created.
      (Run 33637864542 on 2026-09-02: Windows installer and Linux CLI jobs
      passed; `windows-installer` and `linux-cli` artifacts uploaded; the
      draft-release job was correctly skipped.)
- [x] Re-run dispatch after adding the macOS job (run 33641041370 on
      2026-09-02): Windows, macOS, and Linux CLI jobs all passed;
      `windows-installer`, `macos-package`, and `linux-cli` artifacts
      uploaded; the draft-release job was correctly skipped.
- [ ] On the next tag, confirm the draft release contains the Windows
      installers, the macOS dmg/zip, and the Linux CLI tarball with
      checksum, then publish.
