# Hermes Categorized Skill Layout Exec Plan

## Goal

Implement target-level skill layout strategies so SkillDrive can safely scan,
read, and distribute Hermes Agent skills stored under a one-level category
directory.

## Scope

- Add a normalized target layout model to the agent catalog and runtime target
  contracts.
- Configure Hermes Agent as a categorized global target.
- Add a shared skill layout resolver for flat and categorized target behavior.
- Update detection, pre-distribution checks, distribution, Local Skills
  inventory, project scan, and project import to consume layout metadata.
- Add focused TDD coverage for categorized behavior and flat regressions.
- Update desktop-client docs after implementation.

## Non-Goals

- No backend API changes.
- No renderer filesystem access.
- No category selection UI.
- No arbitrary recursive scan mode.
- No multi-level categories.
- No automatic writes before operator approval.

## Progress

- [x] 2026-05-13: Reviewed root workflow, execution gates, desktop-client
  guidance, architecture, design, security, product/ExecPlan indexes, task
  tracker, current agent catalog, adapter, inventory, pre-check, distribution,
  project scan, and project import code paths.
- [x] 2026-05-13: Confirmed the existing dirty working tree already adds Hermes
  as a flat target in `definitions.ts`, `types/index.ts`,
  `agent-adapters.test.ts`, and `app.test.tsx`; implementation must preserve
  and evolve those changes rather than reverting them.
- [x] 2026-05-13: Added the product spec, technical design, active ExecPlan,
  and task checklist for review.
- [x] 2026-05-13: Implementation approved by human reviewer; category remains
  a desktop-client local filesystem layout concern and does not require backend
  schema/API changes for v1.
- [x] 2026-05-13: Added failing tests for Hermes categorized detection,
  adapter metadata/install behavior, Local Skills inventory, distribution, and
  project scan/import.
- [x] 2026-05-13: Added `src/adapters/agents/skill-layout.ts`, normalized
  target layout metadata, configured Hermes as categorized, and wired detection,
  adapters, Local Skills inventory, distribution, pre-distribution context,
  project scan, and project import.
- [x] 2026-05-13: Updated architecture, security, and runtime storage docs with
  categorized target behavior.
- [x] Full validation gates passed.
- [x] Plan archived after implementation acceptance.
- [ ] Plan archived after implementation acceptance.

## Decisions

- Use target-level `skillLayout` metadata instead of a definition-level
  `scanDepth`.
- Default missing layout to flat so existing agents do not need explicit
  metadata churn.
- Hermes uses one-level categorized layout with a deterministic default
  category for SkillDrive-managed installs.
- `agent-paths.json` path overrides replace only the path; they keep the
  catalog layout strategy.
- Duplicate installed skill names across categories fail closed during
  pre-distribution metadata reads.
- Project scan/import should become layout-aware now even if Hermes does not
  yet declare a project target.
- Server categories are intentionally out of scope for v1. Hermes category is a
  local desktop-client layout detail; the backend continues to manage skill
  identity, package content, version, and content hash.

## Open Questions

- No open implementation blockers. `general` is the deterministic v1 write
  category for SkillDrive-managed Hermes installs unless a future Hermes
  reference requires a different default.

## File Map

Create:

| File | Responsibility |
|------|----------------|
| `src/adapters/agents/skill-layout.ts` | Normalize layouts, validate category names, enumerate skill roots, resolve install/missing paths, and detect ambiguous categorized installs |

Modify:

| File | Change |
|------|--------|
| `src/adapters/agents/definitions.ts` | Add layout types, target `skillLayout`, and Hermes categorized target metadata |
| `src/types/index.ts` | Add serialized runtime layout type to `AgentSkillTarget` and `ProjectAgentTarget` |
| `src/core/detection/agent-detection-service.ts` | Attach normalized layout to detected/default/configured targets and enforce compatible shared target layouts |
| `src/adapters/agents/base.ts` | Use layout resolver for install and metadata reads |
| `src/core/local-skills/local-skill-inventory-service.ts` | Enumerate candidate skill roots through the layout resolver |
| `src/core/pre-distribution-check/pre-distribution-check-service.ts` | Pass layout through adapter install context |
| `src/core/distribution/distribution-service.ts` | Pass layout through adapter install context |
| `src/core/projects/project-agent-targets.ts` | Attach normalized layout to project targets and deduped shared paths |
| `src/core/projects/project-skill-scan-service.ts` | Enumerate project skill roots through the layout resolver |
| `src/core/projects/project-skill-import-service.ts` | Resolve import destination through the layout resolver |
| `electron/main.ts` | Preserve layout when building pre-check and distribution target contexts |
| `src/__tests__/agent-detection-service.test.ts` | Add categorized Hermes detection/default override coverage |
| `src/__tests__/agent-adapters.test.ts` | Add categorized adapter metadata and duplicate-category tests |
| `src/__tests__/local-skill-inventory-service.test.ts` | Add categorized inventory tests |
| `src/__tests__/distribution-service.test.ts` | Add categorized distribution write test |
| `src/__tests__/project-agent-targets.test.ts` | Add categorized project target layout propagation test |
| `src/__tests__/project-skill-scan-service.test.ts` | Add categorized project scan test |
| `src/__tests__/project-skill-import-service.test.ts` | Add categorized project import destination test |
| `docs/ARCHITECTURE.md` | Document layout-aware agent adapter and inventory behavior after implementation |
| `docs/SECURITY.md` | Document category validation and ambiguous read fail-closed behavior after implementation |
| `docs/references/runtime-and-storage-surface.md` | Add Hermes and categorized target notes after implementation |
| `task-tracker.md` | Track active/completed state |
| `docs/exec-plans/active/index.md` | Reference this active plan and task checklist |

## Implementation Steps

1. Write failing layout resolver tests through the nearest service tests.
2. Add layout types and resolver helpers.
3. Update detection to carry layout metadata.
4. Write failing adapter categorized metadata tests.
5. Update adapter install and metadata reads.
6. Write failing Local Skills categorized inventory tests.
7. Update inventory enumeration.
8. Write failing distribution categorized write tests.
9. Update distribution/pre-check context propagation.
10. Write failing project target, scan, and import categorized tests.
11. Update project target resolution, scan, and import.
12. Update durable docs and plan progress.
13. Run focused tests, then full desktop and docs gates.

## Validation Plan

Focused iteration commands:

```bash
cd desktop-client && npm test -- src/__tests__/agent-detection-service.test.ts
cd desktop-client && npm test -- src/__tests__/agent-adapters.test.ts
cd desktop-client && npm test -- src/__tests__/local-skill-inventory-service.test.ts
cd desktop-client && npm test -- src/__tests__/distribution-service.test.ts
cd desktop-client && npm test -- src/__tests__/project-agent-targets.test.ts
cd desktop-client && npm test -- src/__tests__/project-skill-scan-service.test.ts
cd desktop-client && npm test -- src/__tests__/project-skill-import-service.test.ts
```

Completion gates:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Backend gates are not required unless implementation changes backend Client API
contracts.

## Validation Results

- `cd desktop-client && npm test -- src/__tests__/agent-detection-service.test.ts src/__tests__/agent-adapters.test.ts src/__tests__/local-skill-inventory-service.test.ts src/__tests__/distribution-service.test.ts src/__tests__/project-agent-targets.test.ts src/__tests__/project-skill-scan-service.test.ts src/__tests__/project-skill-import-service.test.ts` passed with 46 tests on 2026-05-13 after the expected red run.
- `cd desktop-client && npm test -- src/__tests__/pre-distribution-check-service.test.ts src/__tests__/storage.test.ts` passed with 25 tests on 2026-05-13.
- `cd desktop-client && npm run typecheck:electron` passed on 2026-05-13.
- `cd desktop-client && npm test` passed with 24 files and 142 tests on 2026-05-13.
- `cd desktop-client && npm run build` passed on 2026-05-13.
- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors
  and 0 warnings on 2026-05-13.
- `git diff --check` exited 0 on 2026-05-13. PowerShell reported CRLF
  normalization warnings only.

## Follow-Up Notes

- If Hermes later publishes an official category taxonomy, replace or make
  configurable the fallback `general` category in a separate product spec.

## Outcome

Implemented and archived. Hermes Agent is now modeled as a categorized target,
with layout-aware detection, adapter metadata reads, Local Skills inventory,
distribution writes, project scan/import support, tests, and updated
architecture/security/runtime documentation. Server-side category persistence
remains intentionally out of scope for v1.
