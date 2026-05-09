# Project Skill Loading

Status: implemented on 2026-05-07

## Purpose

Add a Projects view to the desktop client so operators can register local
project folders, inspect project-level agent skills, and explicitly import a
local skill folder into a selected project agent skills directory.

This feature adapts the original "add project -> load project skills" idea to
the current desktop-client architecture: top navigation, flat in-place views,
renderer-only UI state, and privileged filesystem work behind typed IPC.

## Goals

- Add a `Projects` top navigation item after `Updates`.
- Let operators add, rename, open, and remove local project records.
- Persist project records in `config/projects.json`, separate from
  `config/config.json`, `agent-paths.json`, and sync state.
- Scan project folders for project-level agent skills using catalog-owned
  project path metadata.
- Show project skills and global local skills from `~/.agents/skills` in one
  detail view, with clear source badges and project skills taking precedence on
  name conflicts.
- Let operators import a validated local skill folder into one explicitly chosen
  project agent skills target.
- Keep directory selection, filesystem reads, validation, copying, overwrite,
  and path opening in the Electron main process.
- Refresh the project detail skill list after project changes or imports.

## Non-Goals

- No backend API changes.
- No server upload, sync, or distribution workflow changes.
- No automatic project discovery or background scanning.
- No automatic writes to project folders. Import requires an explicit operator
  action and an explicit target agent.
- No deletion of project folders or skill folders when removing a project from
  the desktop list.
- No editing of skill file contents.
- No project-level version append, merge, diff, or rollback workflow.
- No support for agents that are not represented by the current
  `AgentId` union and `supportedAgentDefinitions`.
- No new UI framework, router, or renderer filesystem access.

## Affected Surfaces

- Renderer navigation and view state.
- Project list/detail UI and dialogs.
- Typed IPC, preload bridge, and renderer IPC client.
- Main-process project storage service.
- Main-process project skill scan and import services.
- Agent catalog metadata for project-level skill paths.
- Runtime/storage/security/design docs and active ExecPlan.

## User Experience

### Navigation

`Projects` appears in the existing top navigation:

```text
Home  Local Skills  Updates  Projects
```

The view stays inside the existing desktop shell. It does not introduce a
left sidebar or independent route.

### Projects List

The first Projects screen uses the existing `page-stack` and `PageIntro`
patterns. It shows:

- project name
- normalized absolute project path
- project skill count when known
- last scan status when known
- `Open`
- `Rename`
- `Remove`
- `Add Project`

Empty state shows a compact callout and an `Add Project` action.

### Add Project

Adding a project opens a dialog with:

- project name
- project folder path
- a folder picker button
- detected project agent targets, when any are found
- a non-blocking notice when no supported project agent target is detected

Rules:

- The name defaults to the selected folder name.
- The name must be non-empty after trimming.
- Project names must be unique case-insensitively.
- Project paths must be absolute directories.
- Project paths must be unique after platform-normalized path dedupe.
- Missing agent targets do not block adding the project, because a user may add
  `.claude/skills`, `.agents/skills`, or another supported target later.

### Project Detail

Opening a project switches the Projects view in place from list to detail. The
detail header includes:

- back button
- project name
- project path
- scan status
- `Open Folder`
- `Rename`
- `Remove`
- `Refresh`

The skills list shows:

- resolved skill identity
- local version, when available
- description, when available
- source badge: `project` or `global`
- agent display names that contributed the row
- absolute or project-relative path, shown in monospace
- validation or conflict notes

Project skills are listed before global skills. If a project skill and global
skill have the same resolved identity, only the project skill is shown.

### Import Skill

`Add Skill to Project` opens an import dialog. The operator selects:

- source skill folder
- target project agent
- overwrite confirmation when a same-name skill already exists

The source skill folder is validated immediately:

- path is an absolute directory
- root `SKILL.md` exists
- safe identity resolves from `slug` when present, otherwise `name`
- version and description are parsed when available
- unsafe paths, path traversal, symlinks, excessive file count, and excessive
  total bytes are rejected

The import action copies the source folder contents into:

```text
<project-root>/<project-agent-skills-path>/<skill-identity>/
```

If the target skill directory already exists, import fails unless the payload
contains explicit `overwrite: true`. In overwrite mode, the main process replaces
only the target skill directory, not the parent agent directory or project root.

### Remove Project

Removing a project deletes only the project record from `config/projects.json`.
It never deletes the project folder or any skill files.

## Project Records

Project records are persisted in:

```text
<app-root>/config/projects.json
```

Shape:

```typescript
interface ProjectEntry {
  id: string
  name: string
  path: string
  addedAt: string
  updatedAt: string
}
```

Storage rules:

- `id` is generated in the main process.
- `path` is normalized in the main process before persistence.
- The renderer never writes this file directly.
- Invalid JSON falls back to an empty list and surfaces a recoverable error.
- API tokens, backend URLs, sync state, and local skill inventory are not stored
  in `projects.json`.

## Agent Path Model

Project-level skill paths must be explicit catalog metadata, not inferred from
global home-directory targets.

Add a project path surface to `supportedAgentDefinitions`, for example:

```typescript
interface AgentProjectTargetDefinition {
  path: string
  role: "primary" | "compatible-read"
  sharedPathKey?: string
}
```

Rules:

- Only current `AgentId` values can appear in project target metadata.
- Agents without project target metadata are not shown as import targets.
- Current unsupported IDs such as `zed`, `augmentcode`, and `jetbrains-ai`
  remain out of scope until they are promoted to supported `AgentId` values.
- Shared project paths, such as `.agents/skills`, must be deduped by normalized
  physical path before scanning.
- Compatible read paths may contribute project scan results but must not become
  import write targets.

Initial v1 project target candidates should be added only where the agent
catalog can name a deterministic project-relative skills directory. The
implementation plan must add focused tests for each path it declares.

## Project Skill Identity

Project skill identity follows the same safe identity rule as Local Skills:

1. Read root `SKILL.md`.
2. Use a valid `slug` when present.
3. Otherwise use a valid `name`.
4. Reject empty values, path separators, `.`, `..`, leading `.`, path traversal
   fragments, invalid filename characters, and values over the backend skill
   name limit.

The identity is used for:

- row dedupe
- target directory name
- conflict detection
- project-over-global precedence

## IPC Contract

Add typed IPC channels:

| Channel | Purpose |
|---------|---------|
| `projects:list` | Read persisted projects |
| `projects:add` | Add a project record after validating name and path |
| `projects:rename` | Rename a project record |
| `projects:remove` | Remove a project record only |
| `projects:select-folder` | Open a native directory picker for project folders |
| `projects:open-folder` | Reveal a persisted project folder |
| `projects:scan-skills` | Scan one project and return redacted skill rows |
| `projects:select-skill-folder` | Open a native directory picker for source skill folders |
| `projects:validate-skill-folder` | Validate a selected source skill folder |
| `projects:import-skill` | Copy a validated source skill into an explicit project target |

IPC rules:

- Payloads must be serializable and typed.
- Main process validates all IDs, paths, names, agent IDs, and overwrite flags.
- Renderer never receives file contents.
- Renderer never receives unrestricted filesystem handles.
- Import must resolve project and target paths from main-process state, not from
  renderer-provided destination paths.

## Security And Safety

- Renderer remains unprivileged.
- Project add validates paths before persistence.
- Project scan reads only below the selected project root and current global
  local skill targets.
- Import writes only under the selected project root and selected project agent
  target.
- Import rejects source symlinks and target path escapes.
- Import uses count and size limits aligned with Local Skills upload packaging.
- Overwrite requires explicit user confirmation and explicit IPC payload.
- Project remove never deletes files.
- Logs may include project ID, agent ID, normalized error class, and skill
  identity; logs must not include file contents.

## UI Rules

- Use existing desktop-client primitives and CSS classes.
- Do not introduce cards inside cards.
- Use compact, work-focused layout rather than a landing page.
- Use icon buttons only where the meaning is standard or tooltip-backed.
- Keep row heights stable across loading, validation, and error states.
- Add English and Chinese i18n copy for all new visible strings.
- The first render must remain stable for smoke tests.

## Acceptance Criteria

- `Projects` appears after `Updates` in top navigation.
- Empty Projects view renders without configuration or backend connection.
- Adding a valid absolute project directory persists it in `projects.json`.
- Duplicate names and duplicate normalized paths are rejected.
- Removing a project removes only the persisted record.
- Opening a project scans project-level skills and shows project/global source
  badges.
- Project skills take precedence over same-name global skills.
- Import validates a source skill folder before enabling import.
- Import rejects missing `SKILL.md`, unsafe identity, symlink/path escape,
  excessive file count, and excessive total bytes.
- Import rejects same-name target conflicts unless overwrite is explicitly
  confirmed.
- Successful import writes only to the selected project agent skills directory
  and refreshes the detail list.
- Native folder selection and folder reveal happen only through main-process IPC.
- New tests cover storage, path safety, scan, import, IPC validation, renderer
  navigation, dialogs, and i18n.
- Documentation and execution gates pass before implementation is called done.

## Documentation And Execution Gates

Before implementation starts, this spec must be paired with:

- `desktop-client/docs/design-docs/project-skill-loading.md`
- `desktop-client/docs/exec-plans/active/2026-05-07-project-skill-loading.md`
- `desktop-client/docs/exec-plans/active/2026-05-07-project-skill-loading-tasks.md`

Implementation completion must satisfy the affected gates in
`../../docs/EXECUTION_GATES.md`:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

If implementation touches backend Client API behavior, also run the relevant
backend gate or explicitly record why it was not run.
