# Desktop Client Design Rules

## Product Shape

The desktop client should feel like a review-first sync utility, not a second admin console.
The primary job is to show what changed, let the operator approve it once, and make the resulting filesystem changes understandable.
On Windows, it should behave like a notification-area utility: a tray-opened window, no native application menu bar, and close-to-tray rather than close-to-quit.

## View Priorities

- `Home` is the primary surface and should answer whether anything needs review.
- `Home` shows connection health, last refresh, current counts, and at most the first 3 pending updates.
- `Updates` owns the full pending update queue and distribution actions.
- `Settings` is a drawer that owns backend URL, token state, connection testing, target agents, bridge state, and activity.
- `Activity` explains what happened after sync or distribution runs, but it should not crowd the home page.

## Visual Language

- Align desktop-client with the Web console: light background, restrained cards, clear top navigation, muted supporting text, and compact action buttons.
- Prefer local design tokens and reusable renderer primitives over spreading inline styles.
- Do not introduce Tailwind, shadcn, or service-side frontend dependencies into the desktop client unless a future spec explicitly approves it.

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
