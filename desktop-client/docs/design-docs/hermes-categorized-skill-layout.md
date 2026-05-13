# Hermes Categorized Skill Layout - Technical Design

Status: implemented
Last updated: 2026-05-13
Scope: `desktop-client/`

## Problem Statement

The desktop client currently assumes every agent target stores skills directly
below its skills root. That assumption is embedded in the filesystem adapter,
Local Skills inventory, project scan, and project import services.

Hermes Agent adds a different filesystem convention: skills are grouped under a
category directory. Supporting Hermes by adding a shallow scan depth flag would
let inventory find nested folders, but it would not define where new
distributed skills should be written, how pre-distribution checks should handle
duplicate skill names across categories, or how project import should resolve a
safe destination.

## Architecture Decision

Add a target-level skill layout strategy and a small shared resolver layer.

```text
agent catalog target layout
  -> detection/project target snapshots
  -> skill layout resolver
  -> inventory scan, adapter metadata read, distribution write, project scan/import
```

The catalog remains the source of truth for agent-specific filesystem
conventions. Core services consume resolved target metadata; they do not
hardcode Hermes rules.

## Target Layout Type

Add this type near the agent target definitions:

```typescript
export type AgentSkillLayoutDefinition =
  | { mode: "flat" }
  | {
      mode: "categorized"
      categoryDepth: 1
      defaultCategory: string
      categorySource: "agent-default" | "skill-frontmatter"
      allowRootSkills?: boolean
    }
```

Use `skillLayout?: AgentSkillLayoutDefinition` on both
`AgentTargetDefinition` and `AgentProjectTargetDefinition`.

Normalization rules:

- `undefined` becomes `{ mode: "flat" }`.
- v1 supports only `categoryDepth: 1`.
- categorized targets require a valid `defaultCategory`.
- `skill-frontmatter` is reserved unless the implementation explicitly adds
  safe package metadata parsing before install.

## Runtime Target Types

Carry normalized layout metadata through runtime targets:

```typescript
interface AgentSkillTarget {
  targetId: string
  targetPath: string
  primaryAgentId: AgentId
  coveredAgentIds: AgentId[]
  sharedPathKey: string | null
  source: AgentInstallSource
  skillLayout: AgentSkillLayout
}

interface ProjectAgentTarget {
  targetId: string
  targetPath: string
  relativePath: string
  primaryAgentId: AgentId
  coveredAgentIds: AgentId[]
  writableAgentIds: AgentId[]
  displayNames: string[]
  sharedPathKey: string | null
  writable: boolean
  skillLayout: AgentSkillLayout
}
```

`AgentSkillLayout` should be the normalized runtime form. This keeps renderer
snapshots serializable and lets distribution/pre-check receive the same target
shape they already use.

## Resolver Responsibilities

Create a focused helper module, for example
`src/adapters/agents/skill-layout.ts`.

Responsibilities:

- `normalizeSkillLayout(layout)` returns a safe runtime layout.
- `validateSkillCategoryName(category)` rejects unsafe category path segments.
- `resolveSkillInstallPath(targetPath, skillName, layout)` returns the exact
  destination root for writes.
- `resolveMissingSkillPath(targetPath, skillName, layout)` returns the path to
  report when a skill is not installed.
- `enumerateSkillDirectories(targetPath, layout, readDirectory)` returns
  candidate skill roots for inventory and project scans.
- `findInstalledSkillDirectory(targetPath, skillName, layout, readDirectory)`
  returns zero, one, or ambiguous matches for metadata reads.

The resolver should not parse `SKILL.md`; metadata parsing stays with existing
inventory/project helpers.

## Detection Integration

Detection currently resolves a target path and shared path key. It should also
normalize and attach the target's skill layout.

Path overrides from `agent-paths.json` replace the target path only. They should
keep the layout from the assistant's first default target. This matters for
Hermes: a configured Hermes target is still categorized.

Shared target dedupe should preserve the first layout and fail fast in tests if
two catalog entries declare the same shared physical target with incompatible
layouts. Current shared targets are flat.

## Adapter Integration

Extend `AgentInstallContextV1`:

```typescript
export interface AgentInstallContextV1 {
  skillsPath: string
  skillLayout?: AgentSkillLayout
}
```

Install:

- Use `resolveSkillInstallPath()` instead of `join(skillsPath, skillName)`.
- Create the parent category directory when needed.
- Return the installed skill root.

Metadata read:

- Use `findInstalledSkillDirectory()`.
- Missing returns `exists: false` with deterministic missing path.
- One match reads metadata and content hash from the match.
- Multiple matches throw an error listing the conflicting relative category
  paths without reading file contents.

Verify:

- Existing verification can keep using the installed skill root returned from
  install.

## Inventory Integration

Replace one-level target enumeration with resolver enumeration:

- Local Skills inventory uses `enumerateSkillDirectories()`.
- Project skill scan uses `enumerateSkillDirectories()`.
- Flat targets keep the exact current candidate set.
- Categorized targets expose only skill roots below one category level.

Inventory row keys remain based on normalized package root path and identity.

## Project Import Integration

Project import should resolve destination paths with
`resolveSkillInstallPath(target.targetPath, validation.identity, target.skillLayout)`.

Containment checks stay unchanged but should run against both:

- the project target root
- the resolved destination skill root

For categorized targets, the resolver returns a destination under
`defaultCategory`.

## Distribution And Pre-Check Integration

Main-process target builders should pass target layout into:

- pre-distribution check `installContext`
- distribution `SkillDistributionTarget`

`SkillDistributionTarget` already extends `AgentSkillTarget`, so adding layout
to `AgentSkillTarget` carries it into distribution with minimal shape changes.

Skip-installed-content behavior does not need a separate path calculation.

## Tests

Focused coverage should be added before implementation code:

- catalog exposes Hermes as categorized.
- detection preserves layout on default and configured Hermes targets.
- local inventory lists nested categorized skill roots and ignores category
  folders themselves.
- adapter metadata read finds one categorized install.
- adapter metadata read reports missing under the default category.
- adapter metadata read fails on duplicate skill names across categories.
- distribution writes Hermes to the default category and verifies the installed
  root.
- project target scan/import helpers work with categorized test definitions.
- flat agent tests remain green.

## Documentation Updates After Implementation

After implementation, update:

- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/references/runtime-and-storage-surface.md`
- `task-tracker.md`
- this active ExecPlan and task checklist

Do not mark Hermes categorized layout as implemented in docs before tests and
execution gates pass.
