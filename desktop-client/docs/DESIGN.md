# Desktop Client Design Rules

## Product Shape

The desktop client should feel like a review-first sync utility, not a second admin console.
The primary job is to show what changed, let the operator approve it once, and make the resulting filesystem changes understandable.
On Windows, it should behave like a notification-area utility: a tray-opened window, no native application menu bar, and close-to-tray rather than close-to-quit. The rendered content area targets `1984x1168` physical pixels by converting through the active display scale factor at startup, and the page content should sit with a little more inset so text does not press against the shell edges.

## View Priorities

- `Home` is the primary surface and should answer whether anything needs review.
- `Home` shows connection health, last refresh, current counts, and at most the first 3 pending updates.
- On wide desktop windows, `Home` should split the summary metrics and the review queue into separate columns so the larger canvas carries more usable information.
- `Updates` owns the full pending update queue and distribution actions.
- `Settings` is a drawer that owns backend URL, token state, connection testing, target agents, bridge state, and activity.
- `Activity` explains what happened after sync or distribution runs, but it should not crowd the home page.

## Responsive Review Workspace

- The renderer uses one shared sidebar Shell for Home, Updates, Local Skills, and Projects. The wide layout keeps the 13.5rem sidebar and expands the page content; compact layouts use a 4.5rem icon rail with accessible labels preserved for keyboard and assistive technology users.
- The Shell has three documented responsive bands: wide (`>= 1440px`), medium (`1100px–1439px`), and compact (`< 1100px`). Wide pages can expose side-by-side summaries and details, medium pages keep review context above dense content, and compact pages collapse dense surfaces into single-column cards.
- `Updates` is the only page that renders the sticky review action bar. It is scoped to the workspace content area, reserves bottom space while present, and exposes selection, eligible-count, target-count, progress, and aggregate completion state. It is not rendered for Home, Local Skills, or Projects.
- Home is a read-only review preview: it shows health and review metrics plus at most the first three pending updates, and routes operators to `Updates` for distribution or reconciliation.
- Local Skills keeps the inventory and adds one contextual detail card for the selected same-name group. The detail shows paths, source agents, versions, server state, validation, and the existing upload/open/delete actions without replacing the multi-path picker or destructive confirmation flow.
- Projects uses a master-detail layout on wide and medium screens. The project list remains available beside the selected project details; on compact screens selecting a project hides the list and exposes a Back action to return to the list.

## Visual Language

- Align desktop-client with the Web console: persisted light/dark mode, restrained cards, clear top navigation, muted supporting text, and compact action buttons.
- Default new desktop sessions to dark mode so the first-run appearance matches the Web console default.
- Provide a one-click theme toggle in the shell action row. The toggle should stay compact and use the same `Sun`/`MoonStar` icon pattern as the Web console.
- Dark mode must use semantic local tokens under `.dark`; avoid bright cream panels, inputs, overlays, or badges on dark surfaces.
- Prefer local design tokens and reusable renderer primitives over spreading inline styles.
- Do not introduce Tailwind, shadcn, `next-themes`, or service-side frontend dependencies into the desktop client unless a future spec explicitly approves it. A small icon dependency may be used when a spec requires visual parity with the Web console.

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
