# Local Skills Management Exec Plan

## Goal

Implement the desktop-client Local Skills view so operators can inspect valid
local skill package roots and explicitly upload server-missing skills through
the Client API without exposing filesystem or token privileges to the renderer.

## Scope

- Add a read-only local skill inventory service based on the existing agent
  detection snapshot.
- Compare valid local skills to `GET /api/v1/client/skills` by exact SKILL name.
- Add safe local ZIP packaging for upload candidates.
- Add main-process Client API upload support for
  `POST /api/v1/client/skills/upload`.
- Add typed IPC/preload/renderer bridge methods for local inventory refresh and
  upload by row key.
- Add a Local Skills navigation item and renderer view with English and Chinese
  copy.
- Add focused tests for inventory, packaging, IPC boundaries, renderer states,
  and upload error mapping.
- Update runtime/security/reference docs after implementation.

## Non-Goals

- No automatic upload or bulk upload.
- No local skill editing.
- No agent directory writes.
- No persisted local inventory database.
- No version append for existing server skills from this view.
- No Console API JWT upload route usage.

## Progress

- [x] 2026-05-02: Reviewed root and desktop workflow docs, desktop architecture,
  security, design rules, target product specs, current agent detection, IPC,
  package validation, and Client API upload contract.
- [x] 2026-05-02: Rewrote the English and Chinese Local Skills product specs to
  clarify identity, matching, upload, privilege, and non-goal boundaries.
- [x] 2026-05-02: Added this implementation ExecPlan and sibling task checklist.
- [x] 2026-05-02: Updated desktop indexes, task tracker, security rules, and
  Client API contract for the planned Local Skills upload surface.
- [x] 2026-05-02: Ran documentation validation for the doc-only planning pass.
- [ ] Implementation not started by request; code begins only after spec/plan
  review.

## Decisions

- Inventory rows represent unique local package roots, not remote skill IDs.
- Server presence is matched by exact SKILL name from root `SKILL.md`.
- Existing server skills are read-only in this v1; Local Skills upload creates
  server-missing skills only.
- Upload IPC accepts a row key and resolves it in main process; renderer never
  sends arbitrary filesystem paths.
- ZIP packaging and cleanup belong to Electron main-process helpers.
- Inventory snapshots are transient renderer state and are not persisted.

## File Map

Create:

| File | Responsibility |
|------|----------------|
| `src/core/local-skills/local-skill-inventory-service.ts` | Scan detected target directories and build local inventory rows |
| `src/core/local-skills/local-skill-upload-package.ts` | Revalidate local package roots, create temporary ZIPs, own cleanup |
| `src/__tests__/local-skill-inventory-service.test.ts` | Local scan and server matching tests |
| `src/__tests__/local-skill-upload-package.test.ts` | ZIP packaging safety and cleanup tests |
| `src/components/local-skills-view.tsx` | Renderer inventory view and row actions |

Modify:

| File | Change |
|------|--------|
| `src/types/index.ts` | Add local inventory, server state, validation state, and upload result types |
| `electron/ipc.ts` | Add local skills refresh/upload channels and handler signatures |
| `electron/preload.ts` | Expose local skills bridge functions |
| `electron/main.ts` | Wire service creation, API list/upload, row-key resolution, and cleanup |
| `src/lib/ipc-client.ts` | Add typed bridge wrappers |
| `src/app/App.tsx` | Add Local Skills view state, refresh, upload, and activity feedback |
| `src/components/nav-shell.tsx` | Add Local Skills nav entry between Home and Updates |
| `src/i18n/messages/en-US.ts` | Add English UI copy |
| `src/i18n/messages/zh-CN.ts` | Add Chinese UI copy |
| `docs/references/runtime-and-storage-surface.md` | Record implemented IPC channels and temp artifact ownership |
| `docs/SECURITY.md` | Record implemented local upload security constraints if details differ |
| `task-tracker.md` | Move this work from In Progress to Done after validation |
| `docs/exec-plans/active/index.md` | Remove this plan after archiving to completed |

## Implementation Steps

1. Add local skills shared types.
2. Add inventory service tests for scanning direct child directories, invalid
   entries, shared target coverage, and exact-name server matching.
3. Implement the inventory service with dependency injection for filesystem and
   clock behavior.
4. Add packaging tests for root `SKILL.md`, archive layout, unsafe paths,
   symlink escape, size/count limits, and cleanup.
5. Implement temporary ZIP packaging and cleanup ownership.
6. Add IPC and preload tests or source-level coverage for refresh/upload
   handler registration.
7. Wire Electron main-process refresh and upload handlers.
8. Add Client API upload helper using API token auth and multipart form data.
9. Add renderer tests for navigation, row actions, busy states, and error
   feedback.
10. Implement the Local Skills view and navigation entry.
11. Add English and Chinese i18n copy.
12. Update runtime/security docs to describe implemented IPC and temp storage.
13. Run validation gates and archive this plan after acceptance.

## Validation Plan

Run these before marking implementation complete:

```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

If upload implementation touches backend contracts beyond the existing Client
API route, also run:

```bash
uv run pytest tests/test_client_skills_api.py -q
```

## Validation Results

- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors
  and 0 warnings on 2026-05-02.
- `git diff --check` exited 0 on 2026-05-02; PowerShell reported CRLF
  normalization warnings only.

## Documentation Results

- Product spec: `../../product-specs/2026-05-01-local-skills-management.md`
- Chinese product spec: `../../product-specs/2026-05-01-local-skills-management-zh.md`
- Technical design: `../../design-docs/local-skills-management.md`
- Task checklist: `2026-05-02-local-skills-management-tasks.md`

## Outcome

Pending implementation.
