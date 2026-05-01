# Local Skills Management Task Checklist

Status: completed

## Documentation Gate

- [x] Review root `WORKFLOW.md`, root `docs/EXECUTION_GATES.md`, root
  `AGENTS.md`, and `desktop-client/AGENTS.md`.
- [x] Review desktop architecture, design, security, runtime references, product
  specs, and current task tracker.
- [x] Review current detection, IPC, type, sync, package, and Client API upload
  surfaces.
- [x] Revise English product spec.
- [x] Revise Chinese product spec.
- [x] Add technical design.
- [x] Add active ExecPlan.
- [x] Add implementation task checklist.
- [x] Run documentation validation after all doc edits.

## Implementation Gate

- [x] Add local inventory and upload result types in `desktop-client/src/types/index.ts`.
- [x] Write inventory service tests in
  `desktop-client/src/__tests__/local-skill-inventory-service.test.ts`.
- [x] Implement `desktop-client/src/core/local-skills/local-skill-inventory-service.ts`.
- [x] Write upload packaging tests in
  `desktop-client/src/__tests__/local-skill-upload-package.test.ts`.
- [x] Implement `desktop-client/src/core/local-skills/local-skill-upload-package.ts`.
- [x] Add local skills IPC channels and bridge methods in `desktop-client/electron/ipc.ts`,
  `desktop-client/electron/preload.ts`, and `desktop-client/src/lib/ipc-client.ts`.
- [x] Wire main-process inventory refresh and upload in `desktop-client/electron/main.ts`.
- [x] Add renderer Local Skills view in `desktop-client/src/components/local-skills-view.tsx`.
- [x] Add Local Skills navigation and app state in `desktop-client/src/app/App.tsx`
  and `desktop-client/src/components/app-shell.tsx`.
- [x] Add English and Chinese UI copy.
- [x] Add renderer/main-process tests for action visibility, row busy state,
  upload success, and error mapping.
- [x] Update runtime/security/reference docs with implemented IPC and temp
  storage details.

## Validation Gate

- [x] `cd desktop-client && npm test`
- [x] `cd desktop-client && npm run build`
- [x] `python scripts/validate_agents_docs.py --level ERROR`
- [x] `git diff --check`
- [x] Move the ExecPlan and checklist to `docs/exec-plans/completed/` after
  implementation completion.
