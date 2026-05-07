# Project Skill Loading - Technical Design

Status: implemented
Last updated: 2026-05-07
Scope: `desktop-client/`

## 1. Problem Statement

The desktop client currently manages global agent skill targets and server-driven
distribution. It does not let an operator register local project folders or
inspect/import skills that live inside a project workspace.

Project Skill Loading adds a project-scoped inventory and import workflow while
preserving the desktop-client privilege boundary:

- renderer displays state and invokes typed IPC
- Electron main process owns filesystem access
- agent-specific path rules stay in the agent catalog or adapters
- writes happen only after explicit user action

## 2. Design Goals

- Keep Projects as a top-level view, not a new route system.
- Persist only lightweight project records.
- Scan project skill directories on demand.
- Import validated skill folders into explicit project agent targets.
- Reuse Local Skills identity and package-safety rules where practical.
- Keep backend sync and distribution unchanged.

## 3. Non-Goals

- No backend API work.
- No automatic project discovery.
- No background project scanning.
- No project file deletion.
- No direct renderer filesystem access.
- No promotion of unsupported agents into the supported catalog.

## 4. Architecture Overview

```text
Renderer Projects view
  -> src/lib/ipc-client.ts
  -> electron/preload.ts
  -> electron/ipc.ts
  -> electron/main.ts
  -> project storage + project skill services
  -> filesystem and agent catalog
```

New code should sit beside existing desktop-client surfaces:

- storage in `src/core/storage/`
- project scanning/import in `src/core/projects/`
- UI in `src/components/projects-view.tsx`
- typed contracts in `src/types/index.ts`
- IPC wiring in existing Electron bridge files

## 5. Data Model

Add shared types:

```typescript
export interface ProjectEntry {
  id: string
  name: string
  path: string
  addedAt: string
  updatedAt: string
}

export interface ProjectAgentTarget {
  agentId: AgentId
  displayName: string
  targetPath: string
  relativePath: string
  writable: boolean
  sharedPathKey: string | null
}

export interface ProjectSkillRow {
  rowKey: string
  identity: string
  version: string | null
  description: string | null
  source: "project" | "global"
  agentIds: AgentId[]
  sourceDisplayNames: string[]
  skillPath: string
  relativePath: string | null
  validationState: LocalSkillValidationState
  validationMessage: string | null
}

export interface ProjectSkillScanSnapshot {
  projectId: string
  checkedAt: string
  project: ProjectEntry
  targets: ProjectAgentTarget[]
  rows: ProjectSkillRow[]
  errors: string[]
}

export interface ProjectSkillFolderValidation {
  valid: boolean
  identity: string | null
  version: string | null
  description: string | null
  sourcePath: string
  validationState: LocalSkillValidationState
  validationMessage: string | null
}
```

`ProjectSkillRow.identity` is the safe skill identity resolved from `slug` first
and `name` second. Do not use directory basename as identity unless
`SKILL.md` lacks both values and the row is invalid.

## 6. Storage Design

Create `src/core/storage/project-config.ts`.

Responsibilities:

- read/write `config/projects.json`
- validate JSON shape
- normalize project names and paths
- generate project IDs in the main process
- reject duplicate names case-insensitively
- reject duplicate normalized paths
- expose a small service API for main-process handlers

Recommended storage shape:

```typescript
interface ProjectConfigFile {
  projects: ProjectEntry[]
}
```

Use `createJsonConfigStore()` with `appPaths.projectsFilePath`. Add
`projectsFilePath` to `AppPaths`.

Do not put project records in `config.json`, `agent-paths.json`, SQLite sync
state, or renderer local storage.

## 7. Agent Catalog Extension

Extend `src/adapters/agents/definitions.ts` with project-specific targets.

Global default targets such as `~/.claude/skills` are home-directory paths. They
must not be reused for project scanning.

Recommended type:

```typescript
export interface AgentProjectTargetDefinition {
  path: string
  role: "primary" | "compatible-read"
  sharedPathKey?: string
}
```

Add a `projectTargets?: AgentProjectTargetDefinition[]` property to
`AgentPathDefinition`.

Rules:

- `primary` project targets are writable import targets.
- `compatible-read` targets are read-only contributors during scans.
- A target path is project-relative, for example `.claude/skills`.
- Agents without `projectTargets` are omitted from project target selection.
- Shared paths are deduped by normalized absolute path.
- The initial mapping must be covered by tests before implementation is
  considered complete.

## 8. Project Target Detection

Create `src/core/projects/project-agent-targets.ts`.

Given a `ProjectEntry`, resolve project targets from catalog metadata:

1. Resolve `project.path`.
2. For every supported agent with `projectTargets`, join each project-relative
   path under the project root.
3. Reject absolute project target definitions.
4. Reject relative paths containing `..`.
5. Mark target as installed/detected when either the target path exists or an
   agent marker directory exists in the project.
6. Deduplicate shared physical targets by normalized path.
7. Return writable targets separately from compatible read targets.

Marker detection should stay simple for v1. A target path that already exists is
enough to show the agent as available. If future work needs richer marker
detection, add it to catalog metadata rather than hardcoding agent names in the
service.

## 9. Project Skill Scan

Create `src/core/projects/project-skill-scan-service.ts`.

Inputs:

- selected project ID
- current project records
- agent project target definitions
- global local skills snapshot, when available; project detail uses only rows
  whose package root lives under `~/.agents/skills`
- filesystem dependencies for tests

Scan behavior:

1. Resolve the project by ID in main-process project storage.
2. Resolve project agent targets.
3. Read direct child directories under each project target.
4. For each child directory, read root `SKILL.md`.
5. Parse `slug`, `name`, `version`, and `description`.
6. Resolve safe identity with the Local Skills rule.
7. Build project rows keyed by normalized physical path plus identity.
8. Deduplicate same-identity project rows by first discovered project target.
9. Merge `~/.agents/skills` global local skill rows after project rows.
10. Suppress global rows with identities already present in project rows.

The scan is read-only and transient. It should not persist scan results.

## 10. Skill Folder Validation

Create `src/core/projects/project-skill-folder-validation.ts` or keep it inside
the import service if the function stays small.

Validation must:

- require an absolute directory path
- require root `SKILL.md`
- parse safe identity from `slug` or `name`
- parse version and description when available
- reject path traversal, symlink entries, excessive file count, excessive total
  bytes, and unreadable files
- return a redacted validation result to the renderer

Use the same limits as Local Skills upload packaging unless implementation finds
a reason to define stricter project-import limits.

## 11. Import Service

Create `src/core/projects/project-skill-import-service.ts`.

Inputs:

- project ID
- source skill folder path
- target agent ID
- overwrite flag

Main-process import sequence:

1. Read project record by ID.
2. Resolve writable project targets for the project.
3. Find the selected target by `agentId`.
4. Validate source skill folder.
5. Compute destination as
   `<project-root>/<target-relative-path>/<skill-identity>`.
6. Confirm destination stays inside project root and selected target root.
7. If destination exists and `overwrite` is false, reject with a conflict error.
8. If destination exists and `overwrite` is true, remove only that destination
   directory after path checks.
9. Copy source contents into destination, rejecting symlinks and non-file,
   non-directory entries.
10. Verify destination contains root `SKILL.md`.
11. Return import result and a refreshed scan snapshot.

Do not reuse shell commands for copying. Use Node filesystem APIs with resolved
path checks.

## 12. IPC And Preload

Add channels:

```typescript
projectsList: "projects:list"
projectsAdd: "projects:add"
projectsRename: "projects:rename"
projectsRemove: "projects:remove"
projectsSelectFolder: "projects:select-folder"
projectsOpenFolder: "projects:open-folder"
projectsScanSkills: "projects:scan-skills"
projectsSelectSkillFolder: "projects:select-skill-folder"
projectsValidateSkillFolder: "projects:validate-skill-folder"
projectsImportSkill: "projects:import-skill"
```

Bridge methods should mirror the channels with typed payloads and return values.

Main-process handler rules:

- validate project IDs as non-empty strings with a small length cap
- validate names as trimmed non-empty strings
- validate `AgentId` against catalog IDs
- validate folder paths before reading or writing
- never accept a renderer-provided destination path for import
- never return file contents

## 13. Renderer Design

Create `src/components/projects-view.tsx`.

Recommended local state in `App.tsx`:

- `projectsSnapshot`
- `selectedProjectId`
- `projectScanSnapshot`
- `isProjectsLoading`
- `isProjectScanning`
- `projectActionError`
- dialog state for add, rename, remove, import

Renderer responsibilities:

- render Projects list and detail view
- trigger IPC actions
- show validation and conflict states
- disable buttons during in-flight operations
- refresh list/detail after mutations
- surface activity events using the existing activity panel pattern

The renderer must not inspect filesystem paths directly.

## 14. I18n

Add English and Chinese copy in:

- `src/i18n/messages/types.ts`
- `src/i18n/messages/en-US.ts`
- `src/i18n/messages/zh-CN.ts`

Copy groups:

- navigation label
- Projects list view
- project detail view
- add/rename/remove dialogs
- import dialog
- validation state messages
- activity events

## 15. Testing Strategy

Unit tests:

- project config read/write/defaults/invalid JSON
- duplicate project name and path rejection
- project target path resolution and dedupe
- project skill scan with valid, invalid, duplicate, and global-overridden rows
- source skill folder validation
- import conflict handling and overwrite behavior
- import path escape and symlink rejection

Renderer tests:

- Projects navigation appears after Updates
- empty state renders
- adding/renaming/removing calls bridge methods and refreshes state
- detail view scans and displays project/global badges
- import dialog validates source and disables import on invalid folder
- overwrite conflict requires explicit confirmation

Build validation:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

## 16. Security Notes

Project Skill Loading introduces a new explicit write path into user-selected
project directories. That makes path safety part of the implementation contract,
not an optional polish item.

The minimum acceptable implementation must:

- keep writes in Electron main
- reject ambiguous paths
- never remove anything above the target skill directory
- require explicit overwrite confirmation
- keep all native directory selection in main-process IPC
- preserve the existing renderer privilege boundary

## 17. Implementation Notes

Implemented on 2026-05-07 across project storage, project target resolution,
skill metadata parsing, project scan, project import, typed IPC/preload/client
bridge methods, Projects renderer UI, and English/Chinese i18n.

The shipped `ProjectAgentTarget` type records `writableAgentIds` in addition to
`coveredAgentIds` so shared primary targets and compatible-read contributors can
share a physical directory without allowing read-only agents to become import
targets.

Project import returns a redacted import result. The renderer refreshes the
project scan after import instead of trusting renderer-provided destination
paths or file contents.

## 18. Documentation Updates After Implementation

Implementation updated:

- `docs/ARCHITECTURE.md` with the current project storage and project services
- `docs/SECURITY.md` with implemented project import rules
- `docs/references/runtime-and-storage-surface.md` with `projects.json`, IPC
  channels, and any new cache or temporary paths
- `task-tracker.md`
- completed ExecPlan progress and validation notes
