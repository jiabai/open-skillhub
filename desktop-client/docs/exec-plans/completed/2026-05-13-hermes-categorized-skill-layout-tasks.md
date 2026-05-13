# Hermes Categorized Skill Layout Task Checklist

Status: completed and archived

## Documentation Gate

- [x] Review root workflow, execution gates, desktop-client guidance, task
  tracker, active ExecPlan index, architecture, design, and security docs.
- [x] Inspect current agent catalog, adapter, detection, Local Skills,
  pre-distribution check, distribution, project scan, and project import code
  paths.
- [x] Record that existing dirty work already adds Hermes as a flat target.
- [x] Add product spec:
  `desktop-client/docs/product-specs/2026-05-13-hermes-categorized-skill-layout.md`.
- [x] Add technical design:
  `desktop-client/docs/design-docs/hermes-categorized-skill-layout.md`.
- [x] Add active ExecPlan:
  `desktop-client/docs/exec-plans/active/2026-05-13-hermes-categorized-skill-layout.md`.
- [x] Add this task checklist.
- [x] Run documentation validation for the planning pass.
- [x] Human review approves implementation.

## Implementation Gate

- [x] Write failing detection test proving Hermes target layout is categorized.
- [x] Add runtime `AgentSkillLayout` type and target-level `skillLayout`
  metadata.
- [x] Configure Hermes default target with categorized layout.
- [x] Add `src/adapters/agents/skill-layout.ts` with layout normalization,
  category validation, install path resolution, missing path resolution,
  candidate enumeration, and categorized installed-skill lookup.
- [x] Run the focused detection test and confirm the expected failure changes
  to pass.
- [x] Write failing adapter metadata tests for categorized installed, missing,
  and ambiguous duplicate-category skills.
- [x] Update `AgentInstallContextV1`, adapter install, and adapter metadata
  reads to use the layout resolver.
- [x] Run adapter tests and confirm they pass.
- [x] Write failing Local Skills inventory test for
  `<target>/<category>/<skill>/SKILL.md`.
- [x] Update Local Skills candidate discovery to use layout-aware enumeration.
- [x] Run Local Skills inventory tests and confirm they pass.
- [x] Write failing distribution test proving Hermes writes to the default
  category.
- [x] Pass target layout from distribution targets into adapter install context.
- [x] Pass target layout from pre-distribution check targets into adapter read
  context.
- [x] Run distribution and pre-distribution focused tests and confirm they pass.
- [x] Write failing project target propagation, project scan, and project import
  tests for categorized test definitions.
- [x] Update project target resolution to carry layout metadata.
- [x] Update project skill scan to use layout-aware enumeration.
- [x] Update project import destination resolution to use the layout resolver.
- [x] Run project focused tests and confirm they pass.
- [x] Update desktop architecture, security, and runtime reference docs with
  implemented categorized layout behavior.
- [x] Update this ExecPlan with progress, decisions, and validation notes.

## Validation Gate

- [x] `cd desktop-client && npm test -- src/__tests__/agent-detection-service.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/agent-adapters.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/local-skill-inventory-service.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/distribution-service.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/pre-distribution-check-service.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/project-agent-targets.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/project-skill-scan-service.test.ts`
- [x] `cd desktop-client && npm test -- src/__tests__/project-skill-import-service.test.ts`
- [x] `cd desktop-client && npm test`
- [x] `cd desktop-client && npm run build`
- [x] `python scripts/validate_agents_docs.py --level ERROR`
- [x] `git diff --check`
- [x] Backend contracts unchanged; backend Client API gate not required.

## Completion Gate

- [x] Confirm every acceptance criterion in the product spec is implemented or
  recorded as a follow-up.
- [x] Move this checklist and the ExecPlan to
  `desktop-client/docs/exec-plans/completed/` after implementation acceptance.
- [x] Update active and completed ExecPlan indexes during archival.
- [x] Move the task tracker item from In Progress to Done during archival.
