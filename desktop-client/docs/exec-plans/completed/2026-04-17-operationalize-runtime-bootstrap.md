# Operationalize Desktop Runtime Bootstrap

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries,
Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

## Purpose / Big Picture

A developer should be able to start the full Electron desktop runtime from one
documented command, and the main process should obtain the API token through a
supported bootstrap path rather than hidden environment assumptions. When this
plan is complete, the command will be discoverable in `desktop-client/package.json`,
the launch workflow will be documented in `desktop-client/README.md`, and the
runtime bootstrap contract will be consistent across code, security guidance,
and the product spec.

## Progress

- [x] (2026-04-23 14:58) Reviewed the current desktop-client runtime surface and
  confirmed the plan needed a full ExecPlan template rewrite.
- [x] (2026-04-23 14:58) Verified the current state: `desktop-client/package.json`
  has no canonical Electron start command, `desktop-client/src/core/storage/secret-store.ts`
  already exists, and the docs still describe env-only token bootstrap as the
  current behavior.
- [x] (2026-04-23 16:32) Add one canonical Electron start command for the full
  desktop runtime.
- [x] (2026-04-23 16:32) Wire `electron/main.ts` to the supported token bootstrap
  path, using `src/core/storage/secret-store.ts` if that remains the chosen
  contract.
- [x] (2026-04-23 16:32) Update `desktop-client/README.md`, `desktop-client/docs/SECURITY.md`,
  `desktop-client/docs/references/runtime-and-storage-surface.md`, and the
  desktop-client task and debt trackers so they describe the same runtime contract.
- [x] (2026-04-23 16:32) Add or update tests that prove the selected bootstrap
  workflow still passes validation.

## Surprises & Discoveries

- Observation: `desktop-client/src/core/storage/secret-store.ts` is already present
  and exposes both a keytar-backed store and an in-memory store.
  Evidence: the file already defines `SecretStore`, `createKeytarSecretStore`,
  and `createInMemorySecretStore`.

- Observation: `desktop-client/package.json` only exposes renderer, test, and
  build scripts today.
  Evidence: the scripts block contains `dev`, `build`, `preview`, `test`,
  `test:watch`, and `typecheck:electron`, but nothing that starts the full
  Electron runtime.

- Observation: the local README and security doc already describe env-only token
  bootstrap as current behavior and call secret-store wiring out as open work.
  Evidence: `desktop-client/README.md` and `desktop-client/docs/SECURITY.md`
  both say the bootstrap path still reads `SKILLDRIVE_API_TOKEN` from the
  environment.

- Observation: the Electron runtime needs an explicit Node/SSR Vite build target.
  Evidence: an initial `npm run build` attempt treated `node:*` imports as browser
  externals and failed before `vite.electron.config.ts` set `build.ssr: true`.

## Decision Log

- Decision: Keep the canonical launch command focused on the full Electron runtime,
  not the Vite renderer alone.
  Rationale: this plan exists to operationalize the real desktop runtime, so a
  renderer-only shortcut would not satisfy the user-visible goal.
  Date/Author: 2026-04-23 / Codex

- Decision: Prefer the existing secret-store abstraction as the bootstrap target
  unless the implementation forces a documented env-only fallback.
  Rationale: the abstraction already exists, so wiring it reduces future cleanup
  and keeps the runtime secret handling consistent with the security guidance.
  Date/Author: 2026-04-23 / Codex

- Decision: Use `npm run start:electron` as the canonical full runtime command.
  Rationale: the command can build the renderer and Electron main/preload bundle
  with existing dependencies, then launch Electron through the package `main`
  entry without adding a process runner dependency.
  Date/Author: 2026-04-23 / Codex

- Decision: Keep `SKILLDRIVE_API_TOKEN` as an explicit first-run seed and
  current-session fallback, while making the `keytar` secret store the preferred
  token source.
  Rationale: local development still needs a simple bootstrap path, but persistent
  token ownership should move behind the supported secret-store abstraction.
  Date/Author: 2026-04-23 / Codex

## Outcomes & Retrospective

Implemented. `desktop-client/package.json` now exposes `npm run start:electron`
and builds Electron main/preload into `dist-electron/`. Runtime API token
bootstrap now prefers the `keytar` secret store and uses `SKILLDRIVE_API_TOKEN`
as a documented first-run seed or current-session fallback when secret storage is
unavailable. README, security, architecture, runtime reference, product spec,
task tracker, and tech debt tracker now describe that same contract.

The remaining desktop-client follow-up work is outside this plan: distribution
history persistence and the destructive distribution warning prompt remain tracked
in `desktop-client/docs/exec-plans/tech-debt-tracker.md`.

Validated on 2026-04-23 16:35 with `npm run typecheck:electron`, `npm test`,
`npm run build`, and `python scripts/validate_agents_docs.py --level ERROR`.

## Context and Orientation

`desktop-client/` is the Electron + Vite desktop shell for SkillDrive. The
renderer stays in `src/`, while the privileged runtime stays in `electron/`.

Key files for this work:

- `desktop-client/package.json`: exposes the local scripts and should gain the
  canonical Electron start command
- `desktop-client/electron/main.ts`: privileged runtime entry point, current
  token bootstrap, tray, polling, and distribution orchestration
- `desktop-client/src/core/storage/secret-store.ts`: existing token storage
  abstraction backed by `keytar`
- `desktop-client/README.md`: local run instructions and runtime notes
- `desktop-client/docs/SECURITY.md`: the current security contract for token
  handling and package validation
- `desktop-client/docs/product-specs/2026-04-17-skill-distribution-v1.md`:
  product rules for the desktop sync workflow
- `desktop-client/docs/references/runtime-and-storage-surface.md`: runtime
  environment variables, IPC channels, and storage surface
- `desktop-client/task-tracker.md`: current open desktop-client follow-up work
- `desktop-client/docs/exec-plans/tech-debt-tracker.md`: backlog items tied to
  this runtime bootstrap gap

Terms used in this plan:

- Canonical Electron start command: the one documented `npm run ...` entry that
  launches the full desktop runtime, not just the renderer
- Bootstrap path: the code path the main process uses to obtain the API token
  before it starts polling the backend
- Secret store: the `keytar`-backed abstraction in `src/core/storage/secret-store.ts`

Current state to keep in mind:

- `npm run dev` starts the Vite renderer only
- `npm run build` is already the supported validation path for the renderer and
  Electron TypeScript code
- The runtime still reads `SKILLDRIVE_API_TOKEN` from the environment when
  launched manually
- The docs already tell readers that persistent token storage is planned, not
  fully wired yet

## Plan of Work

1. Add a single Electron runtime launch script in `desktop-client/package.json`
   and make it the documented way to start the full desktop app.
2. Update `electron/main.ts` so startup resolves the API token through the
   supported bootstrap path instead of relying on undocumented assumptions.
3. Keep the current environment-based launch behavior documented until the new
   bootstrap path is in place, so local development remains understandable during
   the transition.
4. Update the README, security rules, references, product spec, task tracker,
   and tech debt tracker so they describe the same contract.
5. Add focused tests for the bootstrap path and the new launch workflow, then
   verify the result with the narrowest useful commands first.

## Concrete Steps

1. Inspect the current runtime surface.

   Commands:
   - `Get-Content package.json`
   - `Get-Content electron/main.ts`
   - `Get-Content src/core/storage/secret-store.ts`

   Expected output: confirm the current scripts, token source, and secret-store
   API before editing.

2. Implement the runtime bootstrap changes.

   Commands:
   - edit `desktop-client/package.json`
   - edit `desktop-client/electron/main.ts`

   Expected output: the package exposes one canonical Electron start command, and
   the main process uses the chosen token bootstrap path.

3. Update the repository docs and trackers.

   Commands:
   - edit `desktop-client/README.md`
   - edit `desktop-client/docs/SECURITY.md`
   - edit `desktop-client/docs/references/runtime-and-storage-surface.md`
   - edit `desktop-client/docs/product-specs/2026-04-17-skill-distribution-v1.md`
   - edit `desktop-client/task-tracker.md`
   - edit `desktop-client/docs/exec-plans/tech-debt-tracker.md`

   Expected output: the desktop-client docs and trackers all describe the same
   launch and bootstrap contract.

4. Validate behavior and types.

   Commands:
   - `npm run typecheck:electron`
   - `npm test`
   - `npm run build`

   Expected output: the Electron TypeScript check, Vitest suite, and production
   build all pass.

5. Validate documentation consistency.

   Command:
   - `python scripts/validate_agents_docs.py --level ERROR`

   Expected output: no documentation validation errors.

## Validation and Acceptance

- `desktop-client/package.json` exposes one canonical Electron start command.
- `desktop-client/README.md` documents that command as the supported local
  runtime workflow.
- The Electron main process obtains its API token through the supported bootstrap
  path described in the plan.
- `npm run typecheck:electron`, `npm test`, and `npm run build` all pass.
- `python scripts/validate_agents_docs.py --level ERROR` passes.
- The README, security doc, product spec, references, task tracker, and tech
  debt tracker all describe the same runtime bootstrap contract.

## Idempotence and Recovery

- The document can be reopened and updated at any stop point without needing
  external notes.
- If implementation changes the chosen bootstrap path, update the Decision Log
  first, then sync the downstream docs.
- If the Electron launch command changes again, update `README.md` and the
  runtime references in the same change so the docs do not drift.
