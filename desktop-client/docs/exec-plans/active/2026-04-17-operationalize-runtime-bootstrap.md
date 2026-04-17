# Operationalize Desktop Runtime Bootstrap

This ExecPlan is a living document.

## Purpose / Big Picture

After this plan, a developer can start the real Electron desktop runtime with one documented command and the runtime can obtain its API token through the supported bootstrap path without relying on hidden assumptions.

## Progress

- [ ] 2026-04-17 Decide how Electron main and preload are launched in development and local verification.
- [ ] 2026-04-17 Add one canonical package script for the Electron runtime.
- [ ] 2026-04-17 Wire runtime token bootstrap through `src/core/storage/secret-store.ts` or explicitly narrow the product contract to env-only startup.
- [ ] 2026-04-17 Update README, SECURITY, references, and tasks to match the chosen bootstrap path.
- [ ] 2026-04-17 Add or update tests for the selected bootstrap workflow.

## Concrete Steps

1. Workdir: `desktop-client/`
   Command: `Get-Content package.json`
   Expected: confirm there is currently no canonical Electron start script.

2. Workdir: `desktop-client/`
   Command: `Get-Content electron/main.ts`
   Expected: confirm the current runtime bootstrap still reads `OPEN_SKILLHUB_API_TOKEN`.

3. Workdir: `desktop-client/`
   Command: `Get-Content src/core/storage/secret-store.ts`
   Expected: confirm the existing secret-store abstraction and API shape.

4. Workdir: `desktop-client/`
   Command: `npm test`
   Expected: existing tests stay green before and after bootstrap changes.

5. Workdir: `desktop-client/`
   Command: `npm run build`
   Expected: the chosen runtime bootstrap path does not break the current build validation flow.

## Validation and Acceptance

- `package.json` exposes one canonical Electron start command.
- `README.md` documents that command exactly once as the supported local runtime workflow.
- Runtime auth bootstrap is either wired to `secret-store.ts` or the product/security docs explicitly narrow the contract to env-only startup.
- `npm test` passes.
- `npm run build` passes.
