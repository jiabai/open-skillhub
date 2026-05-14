# Linux CLI Distribution - Technical Design

Status: implemented
Last updated: 2026-05-13
Scope: `desktop-client/`

## Problem Statement

Linux users need a SkillDrive distribution path that works without the desktop
app. The existing desktop runtime owns Electron UI state, desktop config files,
and a desktop sync database. Reusing that runtime directly would couple Linux
automation to desktop-only assumptions.

The CLI should instead reuse domain code while owning a separate Linux command,
storage surface, package source handling, and sync state model.

## Architecture Decision

Build a Node ESM CLI entry point inside `desktop-client/`, but keep it out of
Electron main/preload/renderer code.

```text
skilldrive-cli command
  -> CLI parser and runtime config
  -> package source preparation or server sync source
  -> global/project target resolver
  -> distribution planner
  -> shared distribution write engine
  -> CLI sync state update when command is sync
```

The desktop app and CLI share agent/domain services where those services have
no UI dependency. They do not share persisted config or state.

## Runtime Boundaries

CLI-specific responsibilities:

- command parsing
- Linux XDG app paths
- CLI config and agent path loading
- stdout/stderr formatting
- dry-run planning
- local package source preparation
- server sync orchestration
- scoped CLI sync state
- exit code mapping

Shared core responsibilities:

- agent catalog definitions
- agent adapters
- skill layout resolver, including Hermes categorized paths
- global agent detection primitives
- project target resolution
- package extraction helpers
- filesystem write and verification behavior

Desktop-only responsibilities remain desktop-only:

- Electron IPC
- renderer state
- tray notifications
- keytar token storage
- desktop `config/config.json`
- desktop `projects.json`
- desktop `state.sqlite3`

## File Map

Create:

| File | Responsibility |
|------|----------------|
| `src/cli/main.ts` | CLI process entry, command registration, top-level error handling, exit code mapping |
| `src/cli/commands/install.ts` | Local install command parser binding and execution |
| `src/cli/commands/sync.ts` | Server sync command parser binding and execution |
| `src/cli/commands/detect.ts` | Target detection command |
| `src/cli/commands/config.ts` | Non-secret config display and API base URL mutation |
| `src/cli/services/cli-app-paths.ts` | Linux XDG path resolution and fallback handling |
| `src/cli/services/cli-config-store.ts` | CLI `config.json` and `agent-paths.json` loading/writing |
| `src/cli/services/cli-output.ts` | Human and JSON output rendering |
| `src/cli/services/cli-package-source.ts` | Local directory and zip source validation/preparation |
| `src/cli/services/cli-targets.ts` | Global/project target resolution and `--agents` filtering |
| `src/cli/services/cli-distribution-planner.ts` | Dry-run/action planning, conflict classification, shared target dedupe |
| `src/cli/services/cli-sync-state.ts` | Scoped SQLite state for server-backed installs |
| `src/cli/services/cli-sync-service.ts` | Server listing/download orchestration and encrypted-download fail-closed behavior |
| `src/core/distribution/distribution-write-service.ts` | Shared adapter write/verify engine with no state updates |
| `src/core/distribution/distribution-conflicts.ts` | Destination conflict and overwrite helpers |
| `vite.cli.config.ts` | Vite build config for the Node CLI bundle |

Modify:

| File | Change |
|------|--------|
| `package.json` | Add `bin`, `build:cli`, `start:cli`, and `dist:linux-cli`; add `commander` dependency |
| `src/core/distribution/distribution-service.ts` | Wrap the shared write engine and keep desktop state update behavior in the desktop service |
| `src/core/distribution/package-service.ts` | Reuse extraction validation from CLI package source where possible |
| `src/core/storage/agent-paths-config.ts` | Reuse validation helpers without binding to desktop config paths |
| `src/types/index.ts` | Add shared CLI-safe plan/result types if cross-service types are needed |
| `vitest.config.ts` | Include CLI tests if current include rules miss `src/cli/**` |
| `README.md` and `README-zh.md` | Document Linux CLI commands after implementation |
| `docs/ARCHITECTURE.md` | Record CLI as separate runtime sharing core domain code |
| `docs/SECURITY.md` | Record token, overwrite, package extraction, and encrypted-download behavior |
| `docs/references/runtime-and-storage-surface.md` | Add CLI XDG config/state/cache locations after implementation |
| `task-tracker.md` | Track active/completed status |

## Command Model

Use `commander` for parsing. The CLI package remains private in v1, but exposes
a local binary:

```json
{
  "bin": {
    "skilldrive-cli": "dist-cli/skilldrive-cli.js"
  },
  "scripts": {
    "build:cli": "vite build --config vite.cli.config.ts",
    "start:cli": "node dist-cli/skilldrive-cli.js",
    "dist:linux-cli": "npm run build:cli"
  }
}
```

The built entry must include a Node shebang:

```typescript
#!/usr/bin/env node
```

V1 does not package a single executable. Users run the Node-built CLI artifact
or install the package in an environment that links the `bin` entry.

## Storage Model

`cli-app-paths.ts` resolves:

```text
configDir = $XDG_CONFIG_HOME/skilldrive-cli || ~/.config/skilldrive-cli
stateDir  = $XDG_STATE_HOME/skilldrive-cli  || ~/.local/state/skilldrive-cli
cacheDir  = $XDG_CACHE_HOME/skilldrive-cli  || ~/.cache/skilldrive-cli
```

Files:

```text
configDir/config.json
configDir/agent-paths.json
stateDir/state.sqlite3
cacheDir/package-*
```

`config.json` stores only non-secret settings:

```json
{
  "apiBaseUrl": "http://127.0.0.1:8001"
}
```

`agent-paths.json` should use the same conceptual schema as the desktop agent
path config, but must be loaded from the CLI config directory.

## Scoped Sync State

Desktop sync state uses `remote_skill_id` as a primary key. That is not enough
for CLI v1 because the same server skill can be installed globally and into
multiple projects.

CLI state should store one row per scoped target skill:

```sql
CREATE TABLE IF NOT EXISTS cli_distributed_skills (
  record_key TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  target_key TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  remote_skill_id TEXT NOT NULL,
  name TEXT NOT NULL,
  installed_version TEXT,
  installed_content_hash TEXT,
  remote_version TEXT,
  remote_content_hash TEXT,
  last_synced_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS cli_distributed_scope_skill_idx
ON cli_distributed_skills(scope_type, scope_key, target_key, remote_skill_id);
```

Definitions:

- `scope_type`: `global` or `project`
- `scope_key`: `global` for global scope, normalized absolute project path for
  project scope
- `target_key`: stable physical target key, preferably a normalized target path
  plus primary agent ID
- `record_key`: deterministic hash or joined normalized key generated from the
  unique index fields

Pending updates can be computed during `sync` by comparing server records with
these rows. V1 does not need to persist a separate pending table unless command
UX later requires offline review.

## Target Resolution

`cli-targets.ts` resolves a `CliDistributionScope`:

```typescript
type CliDistributionScope =
  | { type: "global" }
  | { type: "project"; projectPath: string }
```

Global flow:

1. Load CLI `agent-paths.json`.
2. Run the existing agent detection service with CLI path config.
3. Keep writable global targets.
4. Apply `--agents`.
5. Dedupe shared physical targets.

Project flow:

1. Normalize and validate `--project <path>`.
2. Resolve project agent targets for that path.
3. Keep writable project targets.
4. Apply `--agents`.
5. Dedupe shared physical targets.

The target objects must carry `skillLayout` so Hermes categorized destinations
are resolved by the same layout resolver used by the desktop app.

## Package Sources

Local install source:

```typescript
type CliLocalPackageSource =
  | { kind: "directory"; path: string }
  | { kind: "zip"; path: string }
```

Directory validation:

- root must contain `SKILL.md`
- every file must stay under package root after realpath checks
- symlinks are rejected
- file count limit is 1000
- total size limit is 50 MB

Zip validation:

- extract under `cacheDir/package-*`
- reject path traversal before writing entries
- reject escaped real paths after extraction
- root must contain `SKILL.md`
- cleanup always runs after plan or write

Server sync source:

- list visible skills through the existing Client API contract or a small
  CLI-safe API client
- choose pending records unless `--all` is supplied
- before download/write, reject `encryption_enabled=true` with exit code `5`
- download unencrypted packages into cache and validate like zip packages

## Distribution Planning

The planner produces one immutable plan before writing:

```typescript
interface CliDistributionPlan {
  scope: CliDistributionScope
  dryRun: boolean
  source: "local" | "server"
  packageName: string
  targets: CliDistributionPlanTarget[]
  hasWrites: boolean
  hasBlockingConflicts: boolean
}
```

Target statuses:

- `ready`
- `skipped-compatible-read`
- `skipped-agent-filter`
- `conflict-existing`
- `conflict-local-existing`
- `unsupported-encrypted-download`
- `failed-validation`

Dry-run renders this plan and exits without writes.

When `--yes` is present, only `ready` targets are passed to the write engine.
If the plan contains blocking conflicts, no write starts unless the relevant
overwrite flag changes those conflicts to `ready`.

## Write Engine Refactor

The current desktop distribution service prepares a package, installs it to
targets, verifies the install, and updates desktop state when all targets
succeed. CLI local installs must reuse the write behavior without updating
desktop state.

Extract a shared write engine:

```typescript
interface DistributionWriteService {
  write(request: DistributionWriteRequest): Promise<DistributionWriteResult>
}
```

Responsibilities:

- accept an already prepared package
- call the correct agent adapter
- pass `skillLayout` into `AgentInstallContextV1`
- verify installed package
- return per-target success/failure results
- never update desktop or CLI state

Desktop `createDistributionService()` keeps its public API. It should call the
write engine, then update desktop state exactly as it does today when the full
desktop distribution succeeds.

CLI `install` calls the write engine and does not update sync state.

CLI `sync` calls the write engine and then updates CLI scoped sync state for
successful scoped target records.

## Conflict And Overwrite Behavior

Before writes, resolve the destination skill root with the skill layout
resolver.

`install`:

- existing destination is `conflict-existing`
- `--overwrite` allows replacement

`sync`:

- existing destination with matching CLI scoped sync state can be overwritten
  during a confirmed pending update
- existing destination without matching CLI scoped sync state is
  `conflict-local-existing`
- `--overwrite-untracked` allows replacement of untracked same-name local
  skills

Overwrite execution should remove only the resolved destination skill root
after containment checks confirm it is inside the target root. Parent category
directories are preserved.

## Output And Exit Codes

`cli-output.ts` owns both human and JSON rendering. Command services should
return typed results and avoid writing directly to stdout.

Exit code mapping:

| Code | Condition |
|------|-----------|
| `0` | successful write, successful detect, or dry-run plan |
| `1` | invalid arguments, invalid package, invalid config |
| `2` | partial write failure |
| `3` | no writable targets or no matching agents |
| `4` | server API/auth/network failure |
| `5` | encrypted server download unsupported |

## Testing Strategy

Add tests before implementation for:

- CLI app path fallback and XDG overrides.
- parser behavior for scope exclusivity and token/base URL precedence.
- local directory package validation and safety limits.
- local zip package validation, zip slip rejection, and cleanup.
- target resolution for global, project, agent filter, compatible-read skip,
  and shared physical target dedupe.
- Hermes categorized destination planning.
- dry-run no-write behavior.
- install existing destination conflict and `--overwrite`.
- sync scoped state key separation for global and project installs of the same
  remote skill.
- sync untracked local conflict and `--overwrite-untracked`.
- encrypted server package exit code `5`.
- JSON output schema stability.
- desktop distribution service still updates desktop state through the wrapper.

## Security Notes

- Tokens are accepted only from args or environment variables and are never
  persisted.
- Package extraction rejects symlinks, path traversal, and escaped real paths.
- Deletes for overwrite are limited to the resolved destination skill root and
  guarded by containment checks.
- Dry-run is the default for write commands.
- Encrypted downloads fail before filesystem writes.
- Renderer and Electron IPC receive no new privileges from the CLI work.

## Documentation Updates

Implementation updated:

- `README.md`
- `README-zh.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/references/runtime-and-storage-surface.md`
- completed ExecPlan and task checklist
