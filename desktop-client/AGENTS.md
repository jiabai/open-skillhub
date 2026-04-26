# Desktop Client AGENTS.md

Guidance for AI coding agents working in `desktop-client/`.

## Quick Entry

- Architecture: `docs/ARCHITECTURE.md`
- Design rules: `docs/DESIGN.md`
- Security rules: `docs/SECURITY.md`
- Core beliefs: `docs/design-docs/core-beliefs.md`
- Quality tracker: `docs/QUALITY_SCORE.md`
- Product specs: `docs/product-specs/index.md`
- References: `docs/references/index.md`
- Generated schema: `docs/generated/state-db-schema.md`
- Task tracker: `task-tracker.md`
- ExecPlans: `docs/exec-plans/index.md`
- Tech debt: `docs/exec-plans/tech-debt-tracker.md`
- Execution gates: `../docs/EXECUTION_GATES.md`

## Core Beliefs

- Pending review beats silent automation. No skill is written to an agent directory before explicit user approval.
- The renderer stays unprivileged. Node, Electron, secrets, filesystem writes, tray state, and notifications live behind preload and typed IPC.
- Agent-specific behavior belongs in adapters. Sync and distribution core must not hardcode per-agent path rules.
- Docs must distinguish current behavior from target architecture. Do not present a design draft as if it were already implemented.
- Default scope is local to `desktop-client/`. Cross-repo edits are allowed only when a local product spec or active ExecPlan explicitly changes backend contracts or repo-level docs.

## Development Flow

- Read `task-tracker.md` and `docs/exec-plans/index.md` before changing code,
  then open the relevant active ExecPlan.
- Read the local product spec and references before changing contracts or persistence.
- Validate with tests or build commands before closing a task.
- Update `task-tracker.md`, `docs/ARCHITECTURE.md`, and any touched design, security, or reference docs when behavior changes.
- Move finished ExecPlans to `docs/exec-plans/completed/` and record unresolved gaps in `docs/exec-plans/tech-debt-tracker.md`.

## Common Commands

- `cd desktop-client`
- `npm install`
- `npm test`
- `npm run build`
- `npm run dev`
- `npm run test:watch`
- `npm run typecheck:electron`
- `uv run pytest tests/test_client_skills_api.py -q`

## Runtime Notes

- The current verified commands are renderer dev (`npm run dev`), full desktop
  runtime launch (`npm run start:electron`), tests, and build.
- `OPEN_SKILLHUB_API_BASE_URL` configures the backend base URL. `OPEN_SKILLHUB_API_TOKEN`
  is an optional first-run bootstrap that seeds the `keytar` secret store when
  no stored token exists, and a current-session fallback if the secret store is
  unavailable.
- Use `OPEN_SKILLHUB_CODEX_SKILLS_PATH`, `OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH`, and `OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH` when auto-detected agent paths are not suitable.
- Polling should only refresh review state and surface pending updates; it must not auto-distribute skills.
- When the window closes, the tray should keep the app resident so review state stays current.
