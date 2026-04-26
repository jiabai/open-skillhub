# Pre-Distribution Skill Check Exec Plan

## Goal

Implement the read-only pre-distribution skill check described in
`docs/design-docs/pre-distribution-skill-check.md` so the desktop client can show
actual target-directory skill state before a user approves distribution.

## Scope

- Add shared pre-check and installed metadata types.
- Add adapter-owned read-only installed metadata lookup.
- Add a core pre-distribution check service with strict version comparison,
  concurrency, timeout, fingerprints, and transient snapshots.
- Expose the check through main-process IPC only.
- Store check results in renderer React state only and show them in Home and
  Updates wherever distribution can be started.
- Update desktop architecture and runtime reference docs for the new module and
  IPC channel.

## Non-Goals

- No State DB schema changes.
- No automatic conflict resolution, diff, merge, or rollback.
- No change to the distribution write strategy.
- No renderer filesystem access.

## Implementation Steps

1. Add shared types, strict version comparison helpers, and service defaults.
2. Extend filesystem agent adapters with safe metadata reads from `SKILL.md`,
   root `manifest.json`, and nested `skills/manifest.json`.
3. Implement `pre-distribution-check-service` using configured agent targets from
   runtime config and current pending updates from `StateStore`.
4. Add the IPC channel through `electron/ipc.ts`, `electron/preload.ts`,
   `src/lib/ipc-client.ts`, and `electron/main.ts`.
5. Wire renderer state refresh after sync, manual refresh-check, and distribution
   refresh; discard stale snapshots by fingerprint.
6. Add compact Home and detailed Updates UI copy in English and Chinese.
7. Add focused tests and run desktop plus docs validation gates.

## Progress

- [x] Design checked against current desktop boundaries; no blocking logic issue found.
- [x] Shared types and version comparison helpers implemented.
- [x] Adapter metadata reader implemented and tested.
- [x] Pre-check service implemented and tested.
- [x] IPC and main-process orchestration wired.
- [x] Renderer state and UI wired.
- [x] Documentation updated.
- [x] Validation gates passed.

## Decisions

- Treat `docs/design-docs/pre-distribution-skill-check.md` as the approved
  technical source because it is marked final design for implementation handoff.
- Keep pre-check snapshots transient: main builds them from current StateStore
  pending updates, renderer stores them only in React state, and stale snapshots
  are hidden when fingerprints differ.
- Keep unconfigured supported agents omitted by using runtime
  `agentSkillsPaths` as the effective target set.
- Add a small reusable renderer summary component so Home and Updates show the
  same stale/fingerprint-safe claims without duplicating comparison copy.

## Validation Plan

- `cd desktop-client && npm test`
- `cd desktop-client && npm run build`
- `python scripts/validate_agents_docs.py --level ERROR`

## Validation Results

- `cd desktop-client && npm test` passed with 12 test files and 51 tests.
- `cd desktop-client && npm run build` passed, including Electron typechecking and renderer/Electron builds.
- `python scripts/validate_agents_docs.py --level ERROR` passed with 0 errors and 0 warnings.

## Notes

- The design changes durable runtime architecture and IPC surface, so update
  `docs/ARCHITECTURE.md` and `docs/references/runtime-and-storage-surface.md`.
- `docs/SECURITY.md` only needs changes if implementation adds path or symlink
  behavior beyond the design rules.
- Implementation did not add new symlink behavior or broaden path traversal
  rules; existing adapter path safety is reused for metadata reads.

## Status

- `completed`: read-only pre-distribution checks are implemented across adapter
  metadata reads, core service snapshots, IPC, renderer state, Home/Updates UI,
  tests, and durable docs.
