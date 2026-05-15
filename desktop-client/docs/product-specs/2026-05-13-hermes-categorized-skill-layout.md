# Hermes Categorized Skill Layout

Status: implemented on 2026-05-13

## Purpose

Teach the desktop client to support agent skill targets whose installed skills
live below a category layer, starting with Hermes Agent.

Today the desktop client treats every skill target as flat:

```text
<skills-root>/<skill-name>/SKILL.md
```

Hermes uses a categorized layout:

```text
<skills-root>/<category>/<skill-name>/SKILL.md
```

Without an explicit layout model, the desktop client can detect Hermes but will
scan category directories as invalid skills, miss installed Hermes skills during
pre-distribution checks, and write distributed skills to the wrong path.

## Goals

- Add a catalog-owned skill layout strategy for agent targets.
- Keep flat layout as the default for all existing agents.
- Configure Hermes with a one-level categorized layout.
- Make Local Skills inventory scan categorized targets correctly.
- Make pre-distribution metadata reads find categorized installed skills.
- Make distribution write categorized skills into a deterministic category.
- Make project skill scan and project import support categorized project
  targets when a future agent declares them.
- Preserve shared-path dedupe, review-before-write, and renderer privilege
  boundaries.

## Non-Goals

- No backend API changes.
- No server-side skill schema changes.
- No renderer filesystem access.
- No automatic category inference from arbitrary nested folder depth.
- No multi-level category support in v1.
- No UI for choosing a category during distribution.
- No support for duplicate installed skill names across multiple categories in
  the same target beyond deterministic conflict handling.
- No changes to agents that keep the flat `skills/<skill-name>` layout.

## Affected Surfaces

- Agent catalog metadata in `src/adapters/agents/definitions.ts`.
- Shared runtime target types in `src/types/index.ts`.
- Agent adapter install, verify, and metadata read behavior.
- Local Skills inventory discovery.
- Pre-distribution checks.
- Distribution target write context.
- Project target resolution, project skill scan, and project skill import.
- Desktop architecture, security, runtime references, and active ExecPlan docs.

## Layout Model

Add an explicit target layout strategy rather than a generic scan depth.

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

Rules:

- Missing layout means `{ mode: "flat" }`.
- `categoryDepth` is fixed to `1` in v1.
- `defaultCategory` is required for categorized write targets.
- `categorySource: "agent-default"` writes every distributed skill to
  `defaultCategory`.
- `categorySource: "skill-frontmatter"` is a reserved future mode unless the
  implementation can safely parse and validate category metadata from the
  package before write.
- `allowRootSkills` lets a categorized target also read root-level skills, but
  Hermes v1 should keep this false unless Hermes documentation says root skills
  are valid.

Prefer placing layout metadata on target definitions:

```typescript
interface AgentTargetDefinition {
  path: string
  role: AgentTargetRole
  sharedPathKey?: string
  skillLayout?: AgentSkillLayoutDefinition
}

interface AgentProjectTargetDefinition {
  path: string
  role: AgentProjectTargetRole
  sharedPathKey?: string
  skillLayout?: AgentSkillLayoutDefinition
}
```

Target-level metadata keeps the model open for agents with multiple targets
that do not share the same layout.

## Hermes V1 Behavior

Hermes should be represented as:

```typescript
{
  id: "hermes",
  displayName: "Hermes Agent",
  detectionDirs: ["~/.hermes"],
  defaultTargets: [
    {
      path: "~/.hermes/skills",
      role: "primary",
      skillLayout: {
        mode: "categorized",
        categoryDepth: 1,
        defaultCategory: "general",
        categorySource: "agent-default"
      }
    }
  ],
  pathResolution: "all-owned"
}
```

The exact `defaultCategory` can change during implementation if project-owned
Hermes documentation or local examples show a canonical category name. If no
canonical category exists, `general` is the deterministic fallback for
SkillDrive-managed installs.

## Skill Directory Resolution

Introduce a shared resolver used by inventory, metadata reads, distribution,
and project services.

Core responsibilities:

- Normalize missing layout to flat.
- Validate skill directory names before path joins.
- Validate category names before path joins.
- Enumerate candidate skill roots:
  - flat: `<target>/<skill-name>`
  - categorized: `<target>/<category>/<skill-name>`
- Enumerate inventory rows:
  - flat: one directory below target
  - categorized: directories two levels below target
- Resolve install destinations:
  - flat: `<target>/<skill-name>`
  - categorized: `<target>/<defaultCategory>/<skill-name>`

Category validation must reject empty values, separators, `.`, `..`, leading
dot names, and path traversal fragments. The implementation should use the same
containment checks already used around agent and project targets.

## Local Skills Inventory

For flat targets, current behavior stays unchanged.

For categorized targets:

- Scan target children as categories.
- Scan each category child directory as a candidate skill root.
- Ignore files at category level.
- Treat a category directory without skill child directories as empty.
- Mark a candidate invalid only when the candidate skill root lacks `SKILL.md`.
- Include the actual package root path
  `<target>/<category>/<skill-name>` in inventory rows.
- Continue deduping by normalized package root path.
- Continue resolving server identity from valid `slug` first, then valid `name`.

## Pre-Distribution Checks And Metadata Reads

Pre-distribution checks must pass the target layout into adapter metadata reads.

For flat targets:

- Read exactly `<target>/<skill-name>`.

For categorized targets:

- Search one category level for `<category>/<skill-name>`.
- If no matching categorized skill exists, return `exists: false` using the
  deterministic write destination under `defaultCategory`.
- If exactly one matching categorized skill exists, read metadata and content
  hash from that directory.
- If multiple categories contain the same skill name, return a read error that
  surfaces as an `error` comparison rather than choosing silently.

This prevents stale pending updates from being reconciled against an ambiguous
local state.

## Distribution

Distribution must pass the target layout into `AgentInstallContextV1`.

For flat targets, install path remains:

```text
<target>/<skill-name>
```

For categorized targets, install path becomes:

```text
<target>/<defaultCategory>/<skill-name>
```

Distribution must create the category directory as needed, verify the installed
skill root, and keep the existing per-target result semantics:

- one physical write per unique target
- covered agents reported for shared targets
- same-content skip mode preserved
- local state updated only when all effective target writes or skips succeed

## Project Skills

Project target resolution should carry layout metadata into `ProjectAgentTarget`
so scan/import services do not need to reread catalog definitions by agent ID.

V1 does not need to add a Hermes project target unless a deterministic
project-relative Hermes target is known. The implementation should still make
project scan/import layout-aware so future categorized project targets work
without another shared-service rewrite.

For categorized project targets:

- project scan enumerates `<project-target>/<category>/<skill-name>`
- project import writes to
  `<project-target>/<defaultCategory>/<skill-identity>`
- compatible-read categorized paths can contribute scan rows but are not
  writable import targets

## Security And Safety

- Renderer receives only typed layout metadata already present in target
  snapshots; it never receives file contents or unrestricted filesystem access.
- Layout metadata must be catalog-owned or sanitized from existing
  `agent-paths.json` target overrides. Overrides replace only the path, not the
  layout strategy.
- Category names must be validated before path joins.
- Directory enumeration must stay bounded to the declared target and one
  category level for categorized targets.
- Ambiguous duplicate skill names across categories should fail closed for
  pre-distribution comparison.
- Distribution and project import must containment-check resolved destination
  paths before writes or overwrites.

## Acceptance Criteria

- Hermes is supported as a categorized global target.
- Existing flat agents keep their current install, metadata read, inventory,
  project scan, and project import behavior.
- Local Skills inventory lists
  `~/.hermes/skills/<category>/<skill>/SKILL.md` as a valid local skill.
- Local Skills inventory does not report `~/.hermes/skills/<category>` itself
  as an invalid missing-`SKILL.md` skill.
- Pre-distribution checks detect an installed Hermes skill below a category.
- Pre-distribution checks return an error when the same Hermes skill name exists
  in multiple categories.
- Distribution writes Hermes skills under the configured default category.
- Distribution verification reads the categorized installed skill root.
- Project scan/import services are layout-aware even if Hermes does not yet
  declare a project target.
- Tests cover flat regression behavior, categorized inventory, categorized
  metadata reads, ambiguous categorized reads, categorized distribution, and
  categorized project scan/import.
- Documentation and execution gates pass before implementation is called done.

## Documentation And Execution Gates

This spec is paired with:

- `../design-docs/hermes-categorized-skill-layout.md`
- `../exec-plans/active/2026-05-13-hermes-categorized-skill-layout.md`
- `../exec-plans/active/2026-05-13-hermes-categorized-skill-layout-tasks.md`

Implementation completion must satisfy the affected gates in
`../../docs/EXECUTION_GATES.md`:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Backend Client API gates are not required unless implementation changes backend
contracts.
