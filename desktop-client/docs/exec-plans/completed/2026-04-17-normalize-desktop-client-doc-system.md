# Normalize Desktop Client Doc System

This ExecPlan is a living document.

## Purpose / Big Picture

After this plan, an agent can enter `desktop-client/`, find canonical local docs without relying on root brainstorming drafts, validate the supported test and build paths, and see the remaining implementation gaps in explicit trackers.

## Progress

- [x] 2026-04-17 Create local architecture, design, security, and quality docs.
- [x] 2026-04-17 Rewrite `desktop-client/AGENTS.md` into a recovery-first entry map.
- [x] 2026-04-17 Add a local product spec index that points to the approved desktop sync behavior.
- [x] 2026-04-17 Verify `npm test` and `npm run build` after the doc alignment.
- [x] 2026-04-17 Verify the client API test path with `uv run pytest tests/test_client_skills_api.py -q`.
- [x] 2026-04-17 Decide and document the v1 rule for encrypted downloads.
- [x] 2026-04-17 Add local design-docs, references, generated schema, and tech-debt tracking.
- [x] 2026-04-17 Separate canonical local docs from historical root drafts.

## Concrete Steps

1. Workdir: `desktop-client/`
   Command: `npm test`
   Expected: the Vitest suite passes with no new failures.

2. Workdir: `desktop-client/`
   Command: `npm run build`
   Expected: Electron typecheck and Vite build complete successfully.

3. Workdir: repository root
   Command: `uv run pytest tests/test_client_skills_api.py -q`
   Expected: the client skill summary and download contract tests pass.

4. Workdir: repository root
   Command: `Get-ChildItem desktop-client/tasks.md,desktop-client/docs/ARCHITECTURE.md,desktop-client/docs/DESIGN.md,desktop-client/docs/SECURITY.md,desktop-client/docs/QUALITY_SCORE.md,desktop-client/docs/design-docs,desktop-client/docs/references,desktop-client/docs/generated`
   Expected: all canonical local desktop-client docs exist.

5. Workdir: repository root
   Command: `Get-Content desktop-client/AGENTS.md`
   Expected: quick entry points only to local canonical docs, with legacy drafts separated into a non-canonical section.

## Validation and Acceptance

- `desktop-client/AGENTS.md` is enough to find local tasks, architecture, specs, and the active plan.
- `cd desktop-client && npm test` passes.
- `cd desktop-client && npm run build` passes.
- `uv run pytest tests/test_client_skills_api.py -q` passes.
- `desktop-client/README.md`, `desktop-client/docs/SECURITY.md`, and `desktop-client/docs/product-specs/2026-04-17-skill-distribution-v1.md` describe the encrypted-download rule the same way.
- `desktop-client/AGENTS.md` quick entry resolves entirely inside `desktop-client/docs/`.
