# Desktop Client Design Rules

## Product Shape

The desktop client should feel like a review-first sync utility, not a second admin console.
The primary job is to show what changed, let the operator approve it once, and make the resulting filesystem changes understandable.

## View Priorities

- `Pending Updates` is the primary surface and should stay the easiest screen to understand.
- `Overview` summarizes connection health, last refresh, and current counts.
- `Agents` explains where writes will happen and whether each target is valid.
- `Settings` owns backend URL, token state, path overrides, and polling interval.
- `Activity` explains what happened after sync or distribution runs.

## Interaction Rules

- Polling may discover updates, but it must not auto-distribute them.
- Distribution is a deliberate operator action.
- Partial success must be visible as a real state, not collapsed into generic failure.
- Error copy should tell the user what to fix next: reconnect, retry, fix path, or inspect logs.

## Renderer Rules

- Keep the first render stable for smoke tests.
- Prefer simple state flows over indirection-heavy UI abstractions.
- The renderer only talks to the desktop runtime through `src/lib/ipc-client.ts`.
- Do not hide privileged logic inside renderer helpers.

## IPC and Contract Rules

- IPC payloads must stay serializable and typed.
- Channel names should describe the action, not the component that triggered it.
- Backend-facing contracts belong to client-focused schemas and services, not reused JWT console shapes.

## Package and Distribution Rules

- Pending updates should show the remote target version clearly.
- Distribution should report per-agent outcomes, even when the overall result is partial success.
- Backups and verification are part of the write flow, not optional cleanup steps.

## Documentation Rules

- Product decisions live in `docs/product-specs/`.
- Execution state lives in `task-tracker.md` and `docs/exec-plans/index.md`.
- Security-sensitive behavior belongs in `docs/SECURITY.md`, not only in README caveats.
