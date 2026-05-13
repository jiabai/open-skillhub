# Linux CLI Skill Distribution

Status: implemented on 2026-05-13

## Purpose

Add a Linux-only command-line distribution tool for SkillDrive users who want
agent skill distribution without running the desktop application.

The CLI must support both:

- global distribution to configured or detected agent skill targets
- project-level distribution to agent targets inside an explicitly supplied
  project path

The CLI is shipped from `desktop-client/` for code reuse, but it is a separate
runtime surface from the Electron desktop app.

## Goals

- Provide a Linux command named `skilldrive-agent`.
- Support local install from a skill directory or `.zip` archive.
- Support server-backed sync from SkillDrive using an API base URL and token.
- Support global and project scopes.
- Reuse the existing agent catalog, agent adapters, target layout resolver,
  distribution write behavior, and project target resolver where practical.
- Respect Hermes Agent categorized skill layouts through existing target layout
  metadata.
- Keep desktop app config, desktop app state, and CLI config/state isolated.
- Default to dry-run planning; require `--yes` before writing files.
- Provide stable JSON output for automation through `--json`.

## Non-Goals

- No Windows or macOS CLI support in v1.
- No Electron dependency in the CLI runtime.
- No use of desktop app `config/config.json`, `projects.json`, or
  `state.sqlite3`.
- No persisted project list in v1.
- No local install history in v1.
- No encrypted package download support in v1.
- No server-side category schema changes.
- No UI for choosing Hermes categories.
- No single-file binary packaging in v1.
- No URL, tar, or gzip local install sources.

## Product Behavior

### Commands

`install` is local-only:

```bash
skilldrive-agent install <skill-dir-or-zip> --global
skilldrive-agent install <skill-dir-or-zip> --project <path>
```

`install` never calls the SkillDrive server and never updates remote sync
state. It installs a local package into selected agent targets after planning
and confirmation.

`sync` is server-backed:

```bash
skilldrive-agent sync --global
skilldrive-agent sync --project <path>
```

`sync` lists visible server skills, compares them with CLI sync state for the
selected scope and target agents, downloads needed packages, distributes them,
and updates CLI sync state only after successful writes.

`detect` reports targets without installing:

```bash
skilldrive-agent detect --global
skilldrive-agent detect --project <path>
```

`config` is limited to non-secret CLI settings:

```bash
skilldrive-agent config show
skilldrive-agent config set api-base-url <url>
skilldrive-agent config paths
```

API tokens must not be persisted by `config`.

### Scope

Exactly one scope must be selected:

- `--global` resolves global agent skill targets from detected agent homes and
  CLI agent path configuration.
- `--project <path>` resolves project-level agent targets for that specific
  project path.

Project targets are explicit per invocation. V1 does not provide
`project add`, `project list`, or `project remove`.

### Target Selection

By default, the CLI targets every detected or configured writable target for
the selected scope.

`--agents <id[,id...]>` limits writes to the listed agent IDs.

Compatible-read targets may be shown by `detect`, but they are not write
targets. Shared physical targets are written once and reported for every
covered agent.

If no writable targets remain after filtering, the CLI exits with code `3`.

### Dry Run And Confirmation

All write-capable commands default to dry-run.

Dry-run output must show:

- selected scope
- selected agents
- resolved write targets
- source package identity
- planned install paths
- conflicts or unsupported actions

The CLI writes files only when `--yes` is present.

### Local Install Sources

V1 supports:

- a directory containing root `SKILL.md`
- a `.zip` archive that extracts to a package root containing `SKILL.md`

Directory package rules:

- reject packages without root `SKILL.md`
- reject symlinks
- reject path traversal and escaped containment
- reject more than 1000 files
- reject package content larger than 50 MB

Zip package rules:

- extract to a temporary directory under CLI cache
- reject zip slip and path traversal
- reject empty packages
- reject packages without root `SKILL.md`
- clean temporary extraction directories after use

### Conflict Rules

`install` fails closed when the target skill directory already exists.
`--overwrite` is required to replace it.

`sync` may overwrite records already tracked by CLI sync state when `--yes` is
present and the server skill is pending for that scoped target.

If `sync` finds an existing same-name local skill that is not tracked by CLI
sync state, it must report `conflict-local-existing` and skip that target
unless `--overwrite-untracked` is present.

### Server Sync

`sync` uses the SkillDrive API base URL from this priority order:

1. `--api-base-url`
2. `SKILLDRIVE_API_BASE_URL`
3. CLI `config.json`
4. `http://127.0.0.1:8001`

API tokens are supplied only through:

1. `--api-token`
2. `SKILLDRIVE_API_TOKEN`

Tokens are never written to disk.

By default, `sync` installs only server skills that are pending for the scoped
CLI state. `--all` considers all visible server skills for the selected scope
and targets.

If the server reports `encryption_enabled=true` for a downloadable package, the
CLI must fail closed before writing anything, print that encrypted downloads
are not supported by Linux CLI v1, and exit with code `5`.

### CLI Storage

The CLI uses Linux XDG storage separate from the desktop app:

```text
$XDG_CONFIG_HOME/skilldrive-cli/
  config.json
  agent-paths.json
$XDG_STATE_HOME/skilldrive-cli/
  state.sqlite3
$XDG_CACHE_HOME/skilldrive-cli/
  package-*
```

Fallback paths:

```text
~/.config/skilldrive-cli
~/.local/state/skilldrive-cli
~/.cache/skilldrive-cli
```

CLI sync state must be scoped by:

- scope type: `global` or `project`
- scope key: global sentinel or normalized project path
- agent ID or shared target ID
- remote skill ID

This prevents global and project installs of the same remote skill from
overwriting each other's state.

## Output

Human output is the default and should be concise enough for interactive use.

`--json` writes a stable JSON object to stdout. Under `--json`, non-structured
diagnostics and errors must go to stderr.

Exit codes:

| Code | Meaning |
|------|---------|
| `0` | success or dry-run plan generated successfully |
| `1` | validation, config, or user input error |
| `2` | partial failure after at least one target action failed |
| `3` | no targets or no matching agents |
| `4` | remote API, auth, or network failure |
| `5` | unsupported encrypted download |

## Hermes And Categories

Hermes support is inherited from target-level skill layout metadata already
used by the desktop client.

The CLI must not introduce a separate server-side category feature in v1.
Hermes categories are local filesystem layout only:

```text
<skills-root>/<category>/<skill-name>/SKILL.md
```

For SkillDrive-managed writes, the existing target layout resolver chooses the
configured default category. Categories do not need to appear in backend skill
records for CLI v1.

## Acceptance Criteria

- `skilldrive-agent install <dir> --global --yes` installs a local skill into
  every writable global target.
- `skilldrive-agent install <zip> --project <path> --yes` installs a local zip
  package into every writable project target under the supplied project.
- `skilldrive-agent sync --global --yes` downloads and installs pending
  server-backed skills for global targets and updates CLI sync state.
- `skilldrive-agent sync --project <path> --yes` downloads and installs pending
  server-backed skills for only that project path and updates scoped state.
- `--agents` limits writes to the requested agents.
- Shared physical targets are written once and reported for covered agents.
- Hermes categorized targets install under the resolver-selected category.
- Compatible-read targets never receive writes.
- Dry-run mode performs no filesystem writes.
- Local install does not update remote sync state.
- Sync state distinguishes global and project installs of the same remote
  skill.
- Existing local skill conflicts fail closed unless the relevant overwrite flag
  is supplied.
- Encrypted server downloads exit with code `5` before any writes.
- `--json` output is stable and machine-readable.

## Documentation And Execution Gates

This spec is paired with:

- `../design-docs/linux-cli-distribution.md`
- `../exec-plans/completed/2026-05-13-linux-cli-distribution.md`
- `../exec-plans/completed/2026-05-13-linux-cli-distribution-tasks.md`

Implementation completion must satisfy:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build:cli
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```
