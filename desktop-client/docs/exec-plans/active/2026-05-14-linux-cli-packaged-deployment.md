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
`npm run build` also passed as the desktop-client execution gate.

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
