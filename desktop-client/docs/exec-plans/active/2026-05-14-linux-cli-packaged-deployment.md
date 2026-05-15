# Linux CLI Packaged Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> or superpowers:subagent-driven-development to implement this plan task by
> task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Linux CLI deployment guidance based on copying
`desktop-client/`, rebuilding on the target machine, and `npm link` with a
reviewed package-and-install-script deployment path.

**Architecture:** Keep the existing `skilldrive-cli` Node ESM CLI runtime and
XDG storage model. Add a release assembly layer that creates a Linux tarball
containing the built CLI entry, the CLI runtime dependency closure, shell
install/uninstall scripts, manifest metadata, and checksums. Target machines
install the package without git, npm, TypeScript, Vite, or repository knowledge.

**Tech Stack:** Node.js, Vite CLI build, npm dependency metadata, POSIX shell,
tarball release artifact, sha256 checksums, Vitest, repository documentation
gates.

---

## Scope

- Add product spec for packaged Linux CLI deployment.
- Add technical design for package layout, dependency closure, install script,
  uninstall script, and validation gates.
- Replace the Chinese Linux CLI deployment reference with the simpler target
  package-and-script flow.
- Add active implementation plan and checklist.
- Update indexes, architecture notes, and task tracker.
- Future implementation will add package assembly script, shell scripts, tests,
  and Linux validation evidence.

## Non-Goals

- No `.deb`, `.rpm`, Homebrew, AUR, snap, or container image in this phase.
- No native single-file binary.
- No Node.js installer.
- No daemon, scheduled job, or auto-updater.
- No change to CLI command semantics or runtime XDG storage.
- No support expansion for encrypted server downloads in Linux CLI v1.

## Progress

- [x] 2026-05-14: Reviewed root workflow, desktop-client guidance, architecture,
  design, security, existing Linux CLI product spec, existing Linux CLI
  technical design, current deployment reference, package scripts, CLI Vite
  config, and runtime dependency imports.
- [x] 2026-05-14: Confirmed the current deployment reference is too
  development-oriented for target Linux machines because it requires copying
  `desktop-client/`, installing dependencies, rebuilding, and `npm link`.
- [x] 2026-05-14: Confirmed the current built CLI entry still resolves runtime
  dependencies (`commander`, `extract-zip`, `sql.js`, and
  `sql.js/dist/sql-wasm.wasm`), so the release package must include or bundle
  the dependency closure.
- [x] 2026-05-14: Added packaged deployment product spec.
- [x] 2026-05-14: Added packaged deployment technical design.
- [x] 2026-05-14: Reworked the Chinese Linux CLI deployment reference as a
  package-and-install-script target runbook.
- [x] 2026-05-14: Added active ExecPlan and task checklist.
- [x] 2026-05-14: Documentation validation passed with
  `python scripts/validate_agents_docs.py --level ERROR`.
- [x] 2026-05-14: Whitespace diff validation passed with `git diff --check`.
- [x] 2026-05-14: Added failing tests for `package:linux-cli`, runtime
  dependency closure calculation, manifest/wrapper generation, forbidden
  package rejection, and Windows npm command execution.
- [x] 2026-05-14: Implemented `package:linux-cli` through
  `scripts/package-linux-cli.mjs`; the script runs `build:cli`, copies the
  package-lock runtime dependency closure, writes manifest/checksum metadata,
  rejects desktop/runtime packages, smoke-tests the staged CLI, and creates a
  tarball plus `.sha256`.
- [x] 2026-05-14: Added Linux `install.sh` and `uninstall.sh` release scripts
  with user/system install modes, custom prefix/bin-dir support, dry-run,
  default data preservation, and explicit `--purge-data`.
- [x] 2026-05-14: `npm test -- src/__tests__/linux-cli-package.test.ts
  src/__tests__/package-scripts.test.ts` passed after the focused TDD cycle.
- [x] 2026-05-14: `npm run package:linux-cli` passed on Windows, produced
  `dist/linux-cli/skilldrive-cli-0.1.4-linux-node20.tar.gz` and `.sha256`,
  and verified the staged CLI with `--help` and `config paths`.
- [x] 2026-05-14: Full desktop test suite passed with `npm test`:
  36 test files and 185 tests.
- [x] 2026-05-14: Desktop production build passed with `npm run build`.
- [x] 2026-05-14: Addressed install script review feedback by verifying
  `$bin_dir` exists and is writable after creation, verifying the packaged CLI
  wrapper is executable before linking, and verifying `$command_link` is
  executable before running the smoke command.
- [x] 2026-05-14: Final validation after install-script hardening passed:
  `npm test` (36 test files, 186 tests), `npm run build`,
  `npm run package:linux-cli`, docs validation, diff check, tarball sha256
  verification, and packaged `install.sh` inspection.
- [x] 2026-05-15: Reproduced the packaged CLI wrapper and executable-mode
  regressions from the generated 0.1.4 tarball: `bin/skilldrive-cli`,
  `install.sh`, and `uninstall.sh` were emitted without executable bits, and
  the wrapper still derived `SCRIPT_DIR` from `dirname "$0"` instead of the
  symlink target.
- [x] 2026-05-15: Removed the package script shebang because `package:linux-cli`
  invokes it through `node scripts/package-linux-cli.mjs`; this lets Vitest
  import the package assembly module directly.
- [x] 2026-05-15: Added regression tests for symlink-safe wrapper generation,
  tar header executable modes, and install-time `chmod` hardening.
- [x] 2026-05-15: Hardened package assembly so the wrapper resolves symlinks,
  release tar headers normalize executable scripts to `0755` and regular files
  to `0644`, and `install.sh` reapplies executable bits after copying the
  release into the selected prefix.
- [x] 2026-05-15: Fixed non-encrypted Client API downloads so decoded ZIP
  payloads are staged with `.zip` cache filenames even when the backend
  compatibility filename ends in `.json`; this keeps `skilldrive-cli sync`
  aligned with CLI package-source detection.
- [x] 2026-05-16: Reproduced the Linux `./install.sh` failure as a Windows
  CRLF checkout issue: Linux reads the shebang interpreter as `sh\r`.
- [x] 2026-05-16: Added LF-only regression coverage for Linux-executed shebang
  files, added `desktop-client/.gitattributes` rules for shell scripts and the
  CLI entrypoint, and normalized release shell-script copying during package
  assembly so Windows-built tarballs do not inherit CRLF line endings.
- [x] 2026-05-16: Verified the generated tarball contents after CRLF hardening:
  `install.sh`, `uninstall.sh`, `bin/skilldrive-cli`, and
  `lib/skilldrive-cli.js` contain no CR bytes and their shebang lines contain no
  `\r`.
- [ ] Future Linux validation: install, upgrade, verify, and uninstall from the
  generated tarball on Linux.

## Decisions

- Target machines should not clone the repository or build the CLI.
- The release package is a tarball, not an npm global link workflow.
- Node.js remains a target-machine prerequisite; the installer does not install
  Node.
- The target Node.js lower bound is Node.js 20 because the current CLI Vite
  build targets `node20`.
- Package assembly copies only normal runtime `dependencies` from the
  package-lock dependency graph. It intentionally ignores optional type-only
  dependencies such as `@types/yauzl`.
- Source maps ship inside the v1 tarball alongside `skilldrive-cli.js` so
  operators can debug CLI stack traces from an offline package; the generated
  map contains source mappings, not runtime secrets.
- User installs write under XDG data plus `~/.local/bin`; system installs write
  under `/opt/skilldrive-cli` plus `/usr/local/bin`.
- Program files and CLI data remain separate. Installer upgrades must not delete
  `skilldrive-cli` config, state, or cache.
- The installer must not accept or persist API tokens.
- Package tar modes are normalized by the release assembler instead of trusting
  build-host filesystem modes. This keeps Windows-built tarballs executable on
  Linux and avoids world-writable regular files in release artifacts.
- The install script also runs `chmod 755` on the installed command wrapper and
  release shell scripts before linking as a defense-in-depth step.
- `scripts/package-linux-cli.mjs` is intentionally run through `node`, not as a
  directly executable script, so it does not carry a shebang that breaks
  Vitest/vite-node imports.
- Linux-executed shebang files must stay LF-only. The desktop client now uses a
  local `.gitattributes` file for checkout protection, and package assembly
  normalizes copied release shell scripts before archiving as a second guard.
- Documentation must say this is the target deployment design until the package
  script and Linux validation are implemented.

## File Map

Created:

| File | Responsibility |
|------|----------------|
| `docs/product-specs/2026-05-14-linux-cli-packaged-deployment.md` | Product spec for package-and-script Linux CLI deployment |
| `docs/design-docs/linux-cli-packaged-deployment.md` | Technical design for package layout, dependency closure, installer, and validation |
| `docs/exec-plans/active/2026-05-14-linux-cli-packaged-deployment.md` | Active implementation plan |
| `docs/exec-plans/active/2026-05-14-linux-cli-packaged-deployment-tasks.md` | Task checklist |

Modified:

| File | Change |
|------|--------|
| `docs/references/linux-cli-deployment-zh.md` | Replace npm-link deployment with packaged deployment target runbook |
| `docs/references/index.md` | Update Linux CLI deployment reference description |
| `docs/product-specs/index.md` | Add packaged deployment spec |
| `docs/design-docs/index.md` | Add packaged deployment design |
| `docs/exec-plans/active/index.md` | Add active plan and checklist |
| `docs/ARCHITECTURE.md` | Record target packaged deployment surface |
| `task-tracker.md` | Track active packaged deployment work |

Future implementation files:

| File | Change |
|------|--------|
| `.gitattributes` | Keep Linux CLI shell scripts and `src/cli/main.ts` checked out with LF line endings |
| `package.json` | Add `package:linux-cli` script |
| `scripts/package-linux-cli.mjs` | Assemble release staging directory and tarball |
| `scripts/linux-cli/install.sh` | Install release into user/system prefix |
| `scripts/linux-cli/uninstall.sh` | Remove installed program files, optional data purge |
| `src/__tests__/linux-cli-package.test.ts` | Guard package script metadata, forbidden contents, and staged smoke behavior where practical |

## Implementation Tasks

- [x] Add failing package-script tests for the new `package:linux-cli` command,
  required manifest fields, and forbidden package contents.
- [x] Implement `scripts/package-linux-cli.mjs`.
- [x] Add `install.sh` with user/system/prefix/bin-dir/dry-run/force handling.
- [x] Add `uninstall.sh` with default data preservation and explicit
  `--purge-data`.
- [x] Add staged smoke checks so package assembly fails when runtime dependency
  closure is incomplete.
- [x] Update README docs only after the package command exists.
- [x] Run `cd desktop-client && npm test`.
- [x] Run `cd desktop-client && npm run package:linux-cli`.
- [ ] Validate generated tarball on Linux and record evidence here.

## Validation

Documentation phase:

```bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Result on 2026-05-14: both commands passed on the current Windows workspace.

Implementation phase:

```bash
cd desktop-client && npm test
cd desktop-client && npm run package:linux-cli
```

Result on 2026-05-14: both commands passed on the current Windows workspace.
After install-script hardening, `npm test` reported 36 test files and 186 tests.
`npm run build` also passed as the desktop-client execution gate.

Regression fix validation on 2026-05-15:

- `npm test -- src/__tests__/linux-cli-package.test.ts
  src/__tests__/package-scripts.test.ts` passed with 2 test files and 12 tests.
- `npm run package:linux-cli` passed and regenerated
  `dist/linux-cli/skilldrive-cli-0.1.4-linux-node20.tar.gz`.
- Tar header inspection confirmed `bin/skilldrive-cli`, `install.sh`, and
  `uninstall.sh` are `-rwxr-xr-x`, while CLI JS files are `-rw-r--r--`.
- WSL fake-`node` symlink smoke check confirmed the installed command wrapper
  resolves through `current/bin/../lib/skilldrive-cli.js` instead of
  `bin/../lib/skilldrive-cli.js`; full Linux install validation remains open
  because the available WSL environment does not have Node.js installed.
- `npm test` passed with 36 test files and 187 tests.
- `npm run build` passed.
- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors.
- `git diff --check` passed.
- `npm test -- src/__tests__/client-skill-api.test.ts` passed with 1 test file
  and 6 tests after the decoded ZIP cache filename regression fix.
- The same decoded ZIP cache filename fix also passed
  `npm test -- src/__tests__/cli-sync-service.test.ts
  src/__tests__/cli-package-source.test.ts
  src/__tests__/cli-install-command.test.ts
  src/__tests__/client-skill-api.test.ts`, full `npm test`, `npm run build`,
  `npm run package:linux-cli`, docs validation, and diff check.

CRLF hardening validation on 2026-05-16:

- The new regression test first failed against the Windows CRLF checkout with
  `scripts/linux-cli/install.sh: expected ... not to contain '\r'`, and then
  passed after LF normalization and packaging hardening.
- `npm test -- src/__tests__/linux-cli-package.test.ts` passed with 1 test file
  and 8 tests.
- `npm test` passed with 36 test files and 190 tests.
- `npm run build` passed.
- `npm run package:linux-cli` passed and regenerated
  `dist/linux-cli/skilldrive-cli-0.1.4-linux-node20.tar.gz`.
- Extracted tarball inspection confirmed `install.sh`, `uninstall.sh`,
  `bin/skilldrive-cli`, and `lib/skilldrive-cli.js` contain no CR bytes and no
  shebang CR.
- WSL shell validation extracted the generated tarball under Linux and confirmed
  `./install.sh --help` and `./uninstall.sh --help` execute directly without
  the previous `sh\r` interpreter failure.
- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors
  and 0 warnings.
- `git diff --check` passed.

Linux validation phase:

```bash
tar -xzf skilldrive-cli-<version>-linux-node20.tar.gz
cd skilldrive-cli-<version>-linux-node20
./install.sh --user
skilldrive-cli --help
skilldrive-cli config paths
skilldrive-cli detect --global --json
./uninstall.sh --user
```

## Open Questions

- Whether the implementation should keep a source map in the public tarball or
  retain it only as a separate debug artifact.
- Whether package assembly should install CLI dependencies through a temporary
  manifest or bundle more dependencies through Vite first.
- Whether the first Linux validation target should cover both x86_64 and arm64
  or treat the package as architecture-neutral because the current CLI
  dependency set is pure JS plus wasm.
