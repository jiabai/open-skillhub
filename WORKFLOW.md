# Project Workflow

## Purpose

This document defines the mandatory execution workflow for Open SkillHub. It turns
the high-level workflow in `.superpowers/Workflow/WORKFLOW.md` into a
repository-native operating rule that future tasks should follow by default.

The goal is simple: code should serve reviewed specifications, and non-trivial work
should move through explicit review gates instead of jumping straight into
implementation.

## Mandatory Rule

Unless the task is a trivial, low-risk change, agents working in this repository
must follow the gated flow below:

1. Constitution and context
2. Spec
3. Technical plan
4. Task breakdown
5. Implementation and validation

For non-trivial work, do not skip directly from a user request to code. Produce the
right repository artifacts first, then implement after review.

## What Counts As the Constitution Here

This repository already has stable governance documents. For Open SkillHub, the
"constitution" is the durable ruleset formed by:

- `docs/design-docs/core-beliefs.md`
- `ARCHITECTURE.md`
- `docs/DESIGN.md`
- `docs/SECURITY.md`
- the relevant local `AGENTS.md` file for the area being changed

Every non-trivial task should begin by reading this governance set before creating
new delivery artifacts.

## Default Flow

### Stage 1: Constitution and Orientation

Start from the root `AGENTS.md`, then read the narrowest relevant guidance for the
module you are about to change. Use the constitution sources above to anchor
architecture, security, and documentation expectations.

Expected result:

- the task is framed against existing project rules
- the correct module boundaries are understood before planning begins

### Stage 2: Define What To Build

If the request changes user-visible behavior, introduces a new boundary, changes
deployment behavior, affects auth or security semantics, or is large enough to
benefit from reviewable intent, create or update a product spec under
`docs/product-specs/`.

Recommended filename:

- `docs/product-specs/YYYY-MM-DD-<feature-slug>.md`

The spec should capture:

- user-visible goal
- scope and non-goals
- affected surfaces
- acceptance criteria

Review gate:

- pause for human review before implementation continues

### Stage 3: Plan How To Build

After the spec is acceptable, create an execution plan in
`docs/exec-plans/active/` using the ExecPlan structure defined in
`.superpowers/Conventions/PLANS-UNIVERSAL.md`.

Recommended filename:

- `docs/exec-plans/active/<feature-slug>-plan.md`

The plan should explain:

- what files will change
- what order the work will happen in
- what validations will prove success
- what decisions and discoveries must be tracked as the work proceeds

If the task introduces durable design decisions, add or update the matching file in
`docs/design-docs/`. If the task needs external or vendor reference material, place
LLM-friendly references in `docs/references/`.

Review gate:

- pause for human review after the plan is written or materially revised

### Stage 4: Break Work Into Tasks

For larger or multi-step work, add an explicit checklist that turns the plan into
small, reviewable execution units. This can either live inside the ExecPlan's
Progress section or in a sibling task file when the checklist is large.

Recommended filename when split out:

- `docs/exec-plans/active/<feature-slug>-tasks.md`

Task breakdown rules:

- tasks should be concrete and independently verifiable
- dependencies should be explicit
- tasks should name the files or module areas they touch
- validation expectations should be attached to each meaningful batch

Review gate:

- pause for human review when the task list is a major deliverable of the request

### Stage 5: Implement and Validate

Only after the relevant spec, plan, and task breakdown are accepted should
implementation begin.

Execution expectations:

- inspect the code path before editing
- implement the smallest end-to-end change that satisfies the approved task
- validate with the narrowest useful tests first, then broader checks if needed
- update the active plan as a living document while work proceeds

When an active plan is complete:

1. move the plan from `docs/exec-plans/active/` to `docs/exec-plans/completed/`
2. update the matching `index.md` files
3. preserve outcomes and follow-up notes in the completed plan

## Lightweight Path For Trivial Work

Not every request needs the full spec -> plan -> tasks pipeline. A task may use the
lightweight path only when all of the following are true:

- it is low risk
- it is small enough to stay reviewable without a new spec
- it does not introduce a new product or architecture boundary
- it does not materially change auth, security, data model, or deployment behavior

Examples:

- small copy fixes
- narrow UI bug fixes
- targeted test repairs
- documentation corrections
- single-file refactors with no user-visible behavior change

For lightweight work, the required path is:

1. read the constitution sources and relevant local `AGENTS.md`
2. inspect the code path to change
3. implement the smallest end-to-end fix
4. run focused validation
5. update docs only if durable behavior or structure changed

## File Placement Rules

Use these default locations:

- durable cross-cutting rules and decisions: `docs/design-docs/`
- user-visible feature intent: `docs/product-specs/`
- active implementation plans and task lists: `docs/exec-plans/active/`
- completed plans: `docs/exec-plans/completed/`
- external or reference material for agents: `docs/references/`

Do not put long, fast-changing workflow detail directly into `AGENTS.md`. Keep
`AGENTS.md` as the auto-loaded map that points here and makes this workflow
mandatory.

## Review and Pause Rules

Agents should explicitly pause for human review after:

- creating or materially changing a spec
- creating or materially changing an ExecPlan
- producing a large task checklist meant to drive execution

If the user explicitly asks for direct implementation and the work is still
trivial, the lightweight path is acceptable. Otherwise, use the gated flow for
meaningful work.

## Success Criteria

This workflow is working correctly when future tasks in this repository do the
following by default:

- start from `AGENTS.md`
- follow this document for task shape and review gates
- create specs and ExecPlans before non-trivial implementation
- keep active plans live during execution
- archive finished plans into `docs/exec-plans/completed/`
