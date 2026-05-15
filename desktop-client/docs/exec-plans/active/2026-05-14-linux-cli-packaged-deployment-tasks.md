# Linux CLI Packaged Deployment Task Checklist

Status: active

## Documentation Gate

- [x] Review root `WORKFLOW.md` and desktop `AGENTS.md`.
- [x] Review desktop architecture, design, security, task tracker, product
  specs index, design docs index, references index, and active ExecPlan index.
- [x] Inspect existing Linux CLI distribution product spec and technical design.
- [x] Inspect current Linux CLI deployment reference.
- [x] Inspect `package.json`, `vite.cli.config.ts`, built CLI imports, and
  runtime dependency usage.
- [x] Add packaged deployment product spec.
- [x] Add packaged deployment technical design.
- [x] Replace the Chinese Linux CLI deployment reference with a packaged
  deployment target runbook.
- [x] Add active ExecPlan.
- [x] Add this task checklist.
- [x] Update indexes, architecture, and task tracker.
- [x] Run documentation validation.
- [x] Run whitespace diff validation.

## Future Implementation Gate

- [x] Add `package:linux-cli` script to `package.json`.
- [x] Add `scripts/package-linux-cli.mjs`.
- [x] Add package staging smoke validation from outside the repository root.
- [x] Add release `install.sh`.
- [x] Add release `uninstall.sh`.
- [x] Add tests for package script metadata and forbidden package contents.
- [x] Add regression tests for symlink-safe wrapper generation, tar executable
  modes, and install-time executable-bit hardening.
- [x] Normalize release tar file modes and make the installer reapply executable
  bits after copying a release into place.
- [x] Decide whether source maps ship in the public tarball or as separate debug
  artifacts.
- [x] Update README docs after the package script exists.
- [x] Run `npm test`.
- [x] Run `npm run package:linux-cli`.

## Future Linux Validation Gate

- [ ] Copy generated tarball and sha256 file to a clean Linux target.
- [ ] Verify sha256.
- [ ] Install with `./install.sh --user`.
- [ ] Verify `skilldrive-cli --help`.
- [ ] Verify `skilldrive-cli config paths`.
- [ ] Verify `skilldrive-cli detect --global --json`.
- [ ] Reinstall the same version with `--force` and confirm managed-path
  behavior.
- [ ] Install a newer tarball and confirm XDG config/state/cache are preserved.
- [ ] Uninstall without `--purge-data` and confirm user data remains.
- [ ] Uninstall with `--purge-data` on a disposable target and confirm listed
  XDG paths are removed.
- [ ] Record Linux validation evidence in the active ExecPlan.

## Archive Gate

- [ ] Move this checklist and the plan to `docs/exec-plans/completed/` after
  package implementation and Linux validation complete, or document why the
  plan was superseded.
