# Linux CLI Skill Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Linux-only `skilldrive-agent` CLI that can distribute skills globally or to an explicit project path from either local packages or server-backed sync.

**Architecture:** Add a separate Node ESM CLI runtime inside `desktop-client/` while reusing core agent catalog, layout, adapter, package, target, and distribution-write services. Keep CLI config/state under Linux XDG paths and keep Electron desktop config/state untouched.

**Tech Stack:** TypeScript, Node ESM, Vite, Vitest, commander, sql.js, existing SkillDrive desktop-client core services.

---

## Scope

- Add a Linux CLI entry point and command parser.
- Add local `install`, server-backed `sync`, target `detect`, and non-secret
  `config` commands.
- Add CLI-specific XDG config/state/cache handling.
- Add scoped CLI sync state for global and project installs.
- Add local directory and zip source validation.
- Add server sync orchestration with encrypted-download fail-closed behavior.
- Reuse Hermes categorized layout handling through existing target layout
  metadata.
- Refactor desktop distribution writes so CLI can reuse writes without desktop
  state updates.
- Add tests and docs for the new runtime.

## Non-Goals

- No Windows or macOS CLI support in v1.
- No Electron dependency in CLI runtime.
- No persisted project list.
- No local install history.
- No encrypted package downloads.
- No server category feature.
- No single-file binary.

## Progress

- [x] 2026-05-13: Reviewed root workflow, desktop-client guidance, current
  docs indexes, task tracker, package scripts, Vite config, distribution
  service, and state database shape.
- [x] 2026-05-13: Used grill-me review to settle v1 product boundaries:
  separate Linux CLI runtime, local `install` versus server `sync`, no
  persisted project list, dry-run by default, no encrypted download support,
  and no token persistence.
- [x] 2026-05-13: Added product spec, technical design, active ExecPlan, and
  task checklist for review.
- [x] 2026-05-13: Planning documentation validation passed.
- [x] Implementation approved by human reviewer.
- [x] CLI implementation complete.
- [x] Validation gates passed.
- [x] Plan archived after implementation acceptance.

## Decisions

- Build the CLI as a separate Node ESM runtime in `desktop-client/`, not as an
  Electron feature.
- Store CLI config, agent paths, state, and cache under
  `skilldrive-cli` Linux XDG locations.
- Do not reuse desktop app `config/config.json`, `projects.json`, or
  `state.sqlite3`.
- `install` means local directory or local zip only. It never calls the server
  and never updates remote sync state.
- `sync` means server-backed download and distribution. It updates scoped CLI
  sync state after successful writes.
- V1 project commands require `--project <path>` every time; there is no
  persisted project registry.
- Commands are dry-run by default; `--yes` is required for filesystem writes.
- Default target selection is all writable detected/configured targets, with
  `--agents` as an optional narrowing filter.
- Existing local install destinations fail closed. Local install requires
  `--overwrite`; sync requires `--overwrite-untracked` for untracked
  same-name local skills.
- CLI v1 fails closed on encrypted server downloads with exit code `5`.
- Hermes categories remain local target layout behavior and do not require a
  backend category schema for v1.

## File Map

Create:

| File | Responsibility |
|------|----------------|
| `src/cli/main.ts` | Process entry point, command registration, top-level error handling |
| `src/cli/commands/install.ts` | Local package install command |
| `src/cli/commands/sync.ts` | Server-backed sync command |
| `src/cli/commands/detect.ts` | Global/project target detection command |
| `src/cli/commands/config.ts` | Non-secret CLI config command |
| `src/cli/services/cli-app-paths.ts` | Linux XDG path resolution |
| `src/cli/services/cli-config-store.ts` | CLI config and agent paths loading |
| `src/cli/services/cli-output.ts` | Human and JSON result rendering |
| `src/cli/services/cli-package-source.ts` | Directory and zip package preparation |
| `src/cli/services/cli-targets.ts` | Global/project target resolution and filtering |
| `src/cli/services/cli-distribution-planner.ts` | Dry-run plans and conflict classification |
| `src/cli/services/cli-sync-state.ts` | Scoped CLI SQLite state |
| `src/cli/services/cli-sync-service.ts` | Server list/download orchestration |
| `src/core/distribution/distribution-write-service.ts` | Shared adapter write/verify engine with no state updates |
| `src/core/distribution/distribution-conflicts.ts` | Destination conflict and overwrite helpers |
| `vite.cli.config.ts` | CLI build config |
| `src/__tests__/cli-app-paths.test.ts` | XDG and fallback path coverage |
| `src/__tests__/cli-package-source.test.ts` | Directory and zip package validation |
| `src/__tests__/cli-targets.test.ts` | Global/project target selection coverage |
| `src/__tests__/cli-distribution-planner.test.ts` | Dry-run, conflict, Hermes layout, and overwrite planning coverage |
| `src/__tests__/cli-sync-state.test.ts` | Scoped state key and persistence coverage |
| `src/__tests__/cli-sync-service.test.ts` | Server sync, pending/all, auth/base URL, encrypted failure coverage |
| `src/__tests__/distribution-write-service.test.ts` | Shared write engine coverage |

Modify:

| File | Change |
|------|--------|
| `package.json` | Add `commander`, `bin`, and CLI scripts |
| `src/core/distribution/distribution-service.ts` | Delegate writes to shared write engine and keep desktop state update behavior |
| `src/core/distribution/package-service.ts` | Reuse extraction helpers where practical |
| `src/core/storage/agent-paths-config.ts` | Expose reusable validation without binding to desktop path locations |
| `src/types/index.ts` | Add shared CLI-safe result/plan types only if needed |
| `vitest.config.ts` | Include CLI tests if current config misses them |
| `README.md` | Document Linux CLI after implementation |
| `README-zh.md` | Document Linux CLI after implementation |
| `docs/ARCHITECTURE.md` | Record CLI runtime boundary after implementation |
| `docs/SECURITY.md` | Record CLI safety rules after implementation |
| `docs/references/runtime-and-storage-surface.md` | Record CLI XDG storage after implementation |
| `task-tracker.md` | Move work through active and done states |

## Implementation Steps

### Task 1: CLI Build Skeleton

**Files:**
- Create: `src/cli/main.ts`
- Create: `vite.cli.config.ts`
- Modify: `package.json`
- Test: `src/__tests__/cli-main.test.ts`

- [ ] Add `commander` to `dependencies` and add CLI scripts:

```json
"bin": {
  "skilldrive-agent": "dist-cli/skilldrive-agent.js"
},
"scripts": {
  "build:cli": "vite build --config vite.cli.config.ts",
  "start:cli": "node dist-cli/skilldrive-agent.js",
  "dist:linux-cli": "npm run build:cli"
}
```

- [ ] Create `vite.cli.config.ts` with a Node library build that outputs
  `dist-cli/skilldrive-agent.js`, preserves the shebang, and reuses the `@`
  alias.
- [ ] Create `src/cli/main.ts` with `#!/usr/bin/env node`, command
  registration placeholders, and top-level error-to-exit-code handling.
- [ ] Add a smoke test that invokes the parser with `--help` or `detect
  --help` without requiring Electron.
- [ ] Run:

```bash
cd desktop-client && npm test -- src/__tests__/cli-main.test.ts
cd desktop-client && npm run build:cli
```

Expected: CLI build succeeds and no Electron import is required.

### Task 2: CLI App Paths And Config

**Files:**
- Create: `src/cli/services/cli-app-paths.ts`
- Create: `src/cli/services/cli-config-store.ts`
- Create: `src/cli/commands/config.ts`
- Test: `src/__tests__/cli-app-paths.test.ts`

- [ ] Write tests for XDG override paths, fallback paths, and API base URL
  precedence: `--api-base-url`, `SKILLDRIVE_API_BASE_URL`, config file, then
  `http://127.0.0.1:8001`.
- [ ] Implement Linux XDG path resolution for config, state, and cache.
- [ ] Implement non-secret config loading and writing for `apiBaseUrl`.
- [ ] Implement `config show`, `config set api-base-url <url>`, and
  `config paths`.
- [ ] Confirm API tokens are read only from args or `SKILLDRIVE_API_TOKEN`.
- [ ] Run:

```bash
cd desktop-client && npm test -- src/__tests__/cli-app-paths.test.ts
```

Expected: all path and precedence tests pass.

### Task 3: Scoped CLI Sync State

**Files:**
- Create: `src/cli/services/cli-sync-state.ts`
- Test: `src/__tests__/cli-sync-state.test.ts`

- [ ] Write tests proving global and project installs of the same
  `remoteSkillId` create different records.
- [ ] Write tests proving two different project paths create different records.
- [ ] Implement `cli_distributed_skills` schema with a unique index on
  `(scope_type, scope_key, target_key, remote_skill_id)`.
- [ ] Implement read/upsert/delete helpers needed by sync planning.
- [ ] Run:

```bash
cd desktop-client && npm test -- src/__tests__/cli-sync-state.test.ts
```

Expected: scoped state persists and reloads without crossing scopes.

### Task 4: Local Package Source Preparation

**Files:**
- Create: `src/cli/services/cli-package-source.ts`
- Modify: `src/core/distribution/package-service.ts`
- Test: `src/__tests__/cli-package-source.test.ts`

- [ ] Write tests for valid directory, missing `SKILL.md`, symlink rejection,
  path escape rejection, file count limit, and 50 MB size limit.
- [ ] Write tests for valid zip, zip slip rejection, missing root `SKILL.md`,
  empty archive rejection, and cleanup after validation failure.
- [ ] Implement directory validation with realpath containment checks.
- [ ] Implement zip extraction under CLI cache using existing archive helpers
  where practical.
- [ ] Return a prepared package object compatible with the shared write engine.
- [ ] Run:

```bash
cd desktop-client && npm test -- src/__tests__/cli-package-source.test.ts
```

Expected: unsafe local sources are rejected before any distribution plan writes.

### Task 5: Target Resolution And Planning

**Files:**
- Create: `src/cli/services/cli-targets.ts`
- Create: `src/cli/services/cli-distribution-planner.ts`
- Create: `src/core/distribution/distribution-conflicts.ts`
- Create: `src/cli/commands/detect.ts`
- Test: `src/__tests__/cli-targets.test.ts`
- Test: `src/__tests__/cli-distribution-planner.test.ts`

- [ ] Write tests for global targets from detected/configured CLI agent paths.
- [ ] Write tests for project targets using explicit `--project <path>`.
- [ ] Write tests for `--agents` filtering and exit code `3` when no targets
  remain.
- [ ] Write tests proving compatible-read targets are not write targets.
- [ ] Write tests proving shared physical paths produce one planned write with
  all covered agents.
- [ ] Write tests proving Hermes categorized target destinations use the
  layout resolver default category.
- [ ] Write tests for `install` conflict, `--overwrite`, `sync`
  `conflict-local-existing`, and `--overwrite-untracked`.
- [ ] Implement target resolution and planning.
- [ ] Implement `detect` human and JSON output.
- [ ] Run:

```bash
cd desktop-client && npm test -- src/__tests__/cli-targets.test.ts src/__tests__/cli-distribution-planner.test.ts
```

Expected: target and conflict planning is deterministic before writes.

### Task 6: Shared Distribution Write Engine

**Files:**
- Create: `src/core/distribution/distribution-write-service.ts`
- Modify: `src/core/distribution/distribution-service.ts`
- Test: `src/__tests__/distribution-write-service.test.ts`
- Test: `src/__tests__/distribution-service.test.ts`

- [ ] Write tests for successful writes, adapter lookup failure, verification
  failure, shared target result reporting, and layout propagation to adapter
  context.
- [ ] Extract adapter install/verify loop into `distribution-write-service.ts`.
- [ ] Keep desktop `createDistributionService()` behavior unchanged by calling
  the write engine and then updating desktop sync state on all-success.
- [ ] Run:

```bash
cd desktop-client && npm test -- src/__tests__/distribution-write-service.test.ts src/__tests__/distribution-service.test.ts
```

Expected: desktop distribution behavior remains green while CLI gains a
state-free write primitive.

### Task 7: Install Command

**Files:**
- Create: `src/cli/commands/install.ts`
- Create: `src/cli/services/cli-output.ts`
- Test: `src/__tests__/cli-install-command.test.ts`

- [ ] Write tests for local directory dry-run, local zip dry-run, `--yes`
  writes, `--agents`, project scope, conflict exit behavior, and JSON output.
- [ ] Implement install command orchestration:
  source prepare -> target resolve -> plan -> dry-run output or write.
- [ ] Ensure install does not update CLI sync state.
- [ ] Run:

```bash
cd desktop-client && npm test -- src/__tests__/cli-install-command.test.ts
```

Expected: local install is fully usable without server config.

### Task 8: Sync Command

**Files:**
- Create: `src/cli/commands/sync.ts`
- Create: `src/cli/services/cli-sync-service.ts`
- Test: `src/__tests__/cli-sync-service.test.ts`

- [ ] Write tests for API base URL precedence and token precedence.
- [ ] Write tests for default pending-only sync and `--all`.
- [ ] Write tests for server API/auth/network failure mapping to exit code
  `4`.
- [ ] Write tests for `encryption_enabled=true` mapping to exit code `5`
  before writes.
- [ ] Write tests proving successful sync updates scoped CLI sync state.
- [ ] Implement server list/download orchestration and unencrypted package
  preparation.
- [ ] Implement sync command orchestration:
  remote records -> scoped compare -> download -> plan -> dry-run or write ->
  state update.
- [ ] Run:

```bash
cd desktop-client && npm test -- src/__tests__/cli-sync-service.test.ts
```

Expected: server sync obeys pending state, scope boundaries, and encrypted
download refusal.

### Task 9: Documentation And Full Validation

**Files:**
- Modify: `README.md`
- Modify: `README-zh.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/references/runtime-and-storage-surface.md`
- Modify: `docs/exec-plans/completed/2026-05-13-linux-cli-distribution.md`
- Modify: `docs/exec-plans/completed/2026-05-13-linux-cli-distribution-tasks.md`
- Modify: `task-tracker.md`

- [ ] Document command usage, Linux-only scope, XDG storage, token handling,
  dry-run default, overwrite flags, and encrypted-download limitation.
- [ ] Update architecture/security/runtime references with implemented
  behavior.
- [ ] Update plan progress and validation results.
- [ ] Run focused CLI tests:

```bash
cd desktop-client && npm test -- src/__tests__/cli-main.test.ts src/__tests__/cli-app-paths.test.ts src/__tests__/cli-package-source.test.ts src/__tests__/cli-targets.test.ts src/__tests__/cli-distribution-planner.test.ts src/__tests__/cli-sync-state.test.ts src/__tests__/cli-sync-service.test.ts src/__tests__/distribution-write-service.test.ts
```

- [ ] Run completion gates:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build:cli
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Expected: all tests and docs gates pass before implementation is called done.

## Validation Plan

Focused iteration commands are listed per task. Completion gates are:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build:cli
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Backend gates are not required unless implementation changes backend Client API
contracts.

## Validation Results

- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors
  and 0 warnings on 2026-05-13.
- `git diff --check` exited 0 on 2026-05-13. PowerShell reported CRLF
  normalization warnings only for touched Markdown files.
- `cd desktop-client && npm test -- src/__tests__/cli-main.test.ts src/__tests__/cli-app-paths.test.ts src/__tests__/cli-package-source.test.ts src/__tests__/cli-targets.test.ts src/__tests__/cli-distribution-planner.test.ts src/__tests__/cli-sync-state.test.ts src/__tests__/cli-sync-service.test.ts src/__tests__/distribution-write-service.test.ts src/__tests__/cli-install-command.test.ts` passed with 9 files and 28 tests on 2026-05-13.
- `cd desktop-client && npm test -- src/__tests__/distribution-write-service.test.ts src/__tests__/distribution-service.test.ts` passed with 2 files and 9 tests on 2026-05-13.
- `cd desktop-client && npm test -- src/__tests__/package-scripts.test.ts` passed with 6 tests on 2026-05-13.
- `cd desktop-client && npm run typecheck:electron` passed on 2026-05-13.
- `cd desktop-client && npm test` passed with 33 files and 171 tests on 2026-05-13.
- `cd desktop-client && npm run build:cli` passed on 2026-05-13.
- `cd desktop-client && npm run build` passed on 2026-05-13.
- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors
  and 0 warnings on 2026-05-13 after implementation archival.
- `git diff --check` exited 0 on 2026-05-13 after implementation archival.
  PowerShell reported CRLF normalization warnings only.

## Handoff Notes

- Start implementation only after human review approves this plan.
- Keep local `install` and server `sync` separate in both code and docs.
- Do not persist API tokens.
- Do not add project registry persistence in v1.
- Do not add encrypted download support in v1.
- Keep all Hermes category behavior in local target layout resolution.

## Outcome

Implemented and archived. `desktop-client/` now builds a separate
`skilldrive-agent` Node CLI with Linux XDG config/state/cache handling, local
directory/zip install, server-backed sync, global and explicit project target
resolution, dry-run planning, overwrite conflict safety, scoped CLI sync state,
Hermes categorized layout support through shared target metadata, and
unencrypted-only server downloads for v1.
