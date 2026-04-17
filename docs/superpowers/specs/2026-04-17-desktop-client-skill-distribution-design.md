# Desktop Client Skill Distribution Design

Status: Approved in brainstorming on 2026-04-17

## Summary

This document defines the v1 design for a Windows desktop client for Open SkillHub. The client behaves like a cloud-drive sync app for skills: it connects to SkillHub with an API token, detects new or updated skills, asks the user for confirmation, and then distributes the approved skills into the local skill directories used by supported AI coding agents.

The v1 target agents are Codex, Claude Code, and Gemini CLI.

## Product Intent

Open SkillHub already covers centralized skill management on the server side. The new desktop client covers local distribution on the user machine.

The product split is:

- SkillHub server: source of truth for skills, versions, permissions, and distribution APIs
- Desktop client: local sync runtime, update review surface, agent directory writer, and activity log

This keeps the web console focused on management and the desktop app focused on safe local delivery.

## Goals

- Provide a standalone Windows desktop client built with Electron, React, and TypeScript
- Authenticate with a pasted API token
- Detect new skills and new versions available to the token owner
- Require explicit user confirmation before any distribution happens
- Distribute approved skills to all enabled agent targets in one action
- Support Codex, Claude Code, and Gemini CLI through a shared adapter model
- Preserve local state, activity history, and recoverable failure information across restarts

## Non-Goals

- In-app skill editing, upload, activation, deactivation, or other server-side management flows
- Silent automatic distribution without user review
- Per-skill routing rules or per-agent subscription rules
- Multi-profile agent management, workspace-specific targeting, or advanced rollout policies
- Real-time push sync as a v1 requirement

## User Experience

The client should feel like a sync utility rather than a second admin console.

Primary UX behaviors:

- Run as a normal desktop app with tray support
- Poll SkillHub in the background for updates
- Surface pending updates in the main window and through desktop notifications
- Keep the "Pending Updates" view as the center of the product
- Let the user confirm distribution once, then apply that change to all enabled agents
- Show clear activity history and actionable failure messages

The main navigation is:

- Overview
- Pending Updates
- Agents
- Settings
- Activity

## Recommended Technical Stack

- Desktop shell: Electron
- UI: React + TypeScript
- Styling: lightweight local design system or utility CSS consistent with the product look
- Secure secret storage: Windows Credential Manager
- Local state store: SQLite
- Packaging and app runtime: npm-based desktop app workflow

Electron is the recommended choice because it fits the user's TypeScript familiarity, supports Windows desktop patterns well, and keeps system integration simpler than Tauri for this repository and team workflow.

## Repository Layout

Add a new top-level app rather than extending the existing Next.js web console:

```text
desktop-client/
  AGENTS.md
  README.md
  docs/
  package.json
  electron/
    main.ts
    preload.ts
  src/
    app/
    components/
    core/
      sync/
      distribution/
      storage/
    adapters/
      agents/
        base.ts
        registry.ts
        codex.ts
        claude-code.ts
        gemini-cli.ts
    lib/
    types/
```

This preserves a clean boundary:

- `frontend/` remains the server-hosted web console
- `desktop-client/` becomes the local sync and distribution app

## System Architecture

The architecture is intentionally split by responsibility:

- UI layer: renders status, pending updates, settings, and activity
- Desktop runtime: owns tray behavior, notifications, scheduled polling, and window orchestration
- Sync core: loads remote state, compares against local state, and creates pending updates
- Distribution core: downloads skill packages, validates them, and coordinates multi-agent writes
- Agent adapters: encapsulate each agent's path detection, path validation, install behavior, and post-write verification
- Local storage: stores config, sync state, distribution history, and cached packages

The desktop client does not interpret how a skill executes inside an agent. It only delivers the skill package safely into the correct local directory and records what happened.

## Ideal Server API Contract

The desktop client should rely on a dedicated client-facing API surface and should not depend on web-console JWT endpoints.

The ideal v1 API surface is:

- `GET /api/v1/client/skills`
  - Returns the skills visible to the API token together with the current distributable version
- `POST /api/v1/client/skills/download`
  - Returns a versioned skill package with checksum, expiration metadata, and encryption metadata

Recommended response shape for `GET /api/v1/client/skills`:

```json
{
  "items": [
    {
      "skill_uuid": "uuid",
      "name": "excel",
      "current_version": "1.2.0",
      "updated_at": "2026-04-17T12:00:00Z",
      "is_active": true
    }
  ]
}
```

Future client endpoints such as resolve, manifest, package, or sync are compatible with this design but are not required for the first implementation plan.

## Sync and Distribution Flow

The v1 lifecycle is:

1. Desktop client starts
2. Client loads local configuration and registered agent targets
3. Client polls the SkillHub client API on an interval
4. Sync core fetches remote skill summaries
5. Sync core compares remote versions against local distribution records
6. New or updated items become `pending updates`
7. User is notified through the UI and system notifications
8. User approves distribution
9. Distribution core downloads the selected package
10. Distribution core validates checksum, expiration, and package structure
11. Distribution core writes the package to every enabled agent target
12. Client records success, partial success, or failure details in local state

Important v1 rule: no package is written to any agent directory until the user confirms the pending update.

## Agent Adapter Model

Agent-specific behavior must be isolated behind a shared interface.

Recommended concepts:

```ts
type AgentKind = "codex" | "claude-code" | "gemini-cli"

type AgentInstallation = {
  kind: AgentKind
  label: string
  rootPath: string
  skillsPath: string
  detected: boolean
  enabled: boolean
}

type InstalledSkillRecord = {
  skillId: string
  version: string | null
  installedAt?: string
}

type ResolvedSkillPayload = {
  skillId: string
  version: string
  extractedPath: string
}

interface AgentAdapter {
  kind: AgentKind
  detectInstallations(): Promise<AgentInstallation[]>
  validateSkillsPath(path: string): Promise<boolean>
  listInstalledSkills(target: AgentInstallation): Promise<InstalledSkillRecord[]>
  installSkill(target: AgentInstallation, payload: ResolvedSkillPayload): Promise<void>
  verifySkill(target: AgentInstallation, skillId: string, version: string): Promise<boolean>
}
```

Adapter responsibilities:

- Detect whether the agent exists locally
- Infer or accept a configured skills directory
- Validate that the directory is correct and writable
- Install the skill into the agent-specific target
- Verify that the installed version is present after writing

Sync core must not know per-agent path conventions or install structure details.

## Distribution Scope Rules

The approved v1 distribution rules are intentionally simple:

- The user reviews updates before distribution
- Distribution is global for enabled agents
- One approval applies the same selected skill version to Codex, Claude Code, and Gemini CLI when those agents are enabled
- No per-skill routing matrix is part of v1

This keeps the product easy to understand and reduces failure states in the first release.

## Local Storage Design

Use two storage layers:

### Secure secrets

- API token stored in Windows Credential Manager

### Local app state

- Config file in the app data directory for non-secret settings
- SQLite database for operational state

Recommended app data layout:

```text
%LOCALAPPDATA%/OpenSkillHub/
  config.json
  state.db
  cache/
  logs/
  backups/
```

Recommended SQLite concerns:

- `agents`
- `remote_skills`
- `pending_updates`
- `distribution_runs`
- `distribution_targets`

This supports update comparison, restart recovery, history, and actionable troubleshooting.

## Safe Write Pipeline

Distribution should use a guarded write path:

1. Download package into cache
2. Validate checksum and expiration
3. Decrypt if required by the server contract
4. Extract into a temporary directory
5. Validate basic structure
   - `SKILL.md` exists
   - file names are safe
   - package size stays within allowed limits
6. For each enabled agent target:
   - back up the current installed version if present
   - write into a temporary target location
   - verify the written files
   - atomically replace or promote into the live skills directory
7. Record final per-agent results

This reduces the risk of partial writes or corrupted local agent state.

## Failure Model

The client must expose failures as named, understandable states.

Recommended error classes:

- `AuthError`
- `NetworkError`
- `PackageError`
- `PathError`
- `VerifyError`
- `PartialSuccess`

UI behavior should tell the user where the failure occurred and what action to take next:

- Retry
- Fix Path
- Reconnect
- Review Logs

If the app exits during a distribution run, the run should be marked as interrupted on the next startup and surfaced for manual retry rather than silently assumed successful.

## Security Rules

- API token must never be stored in plaintext config
- The client should only call the client-oriented API surface
- Package validation must happen before writing to any agent directory
- Path validation must reject unsafe or ambiguous destinations
- Local backups should exist before overwriting a previously distributed version
- Logs must avoid leaking the raw API token

## UI Shape

The main window is designed around pending review rather than browsing every server feature.

Main views:

- Overview: connection health, last sync, enabled agents, and current counts
- Pending Updates: the primary review queue for new skills and new versions
- Agents: detected agents, configured paths, enabled toggles, validation state
- Settings: server URL, token connection state, polling interval, startup behavior
- Activity: recent sync runs and distribution results

Tray behavior:

- App can stay resident in the system tray
- Notifications alert the user when pending updates are found
- Clicking the notification opens the main review surface

## Testing Strategy

The implementation plan should cover four test layers:

### Unit tests

- version comparison logic
- adapter path validation and install verification
- package validation pipeline
- local state transitions

### Integration tests

- desktop sync core with a mocked SkillHub client API
- success, token failure, path failure, partial success, and retry scenarios

### Filesystem-level tests

- use temporary directories to simulate agent skill roots
- perform real writes, backups, retries, and interrupted-run recovery

### End-to-end acceptance

- connect with an API token
- detect a new skill or new version
- surface it in pending updates
- approve distribution
- confirm the version appears in all enabled agent directories
- confirm activity and pending state update correctly

## Acceptance Criteria for v1

- A user can connect the client with an API token
- The client can detect remote skill updates available to that token
- Updates stay pending until the user explicitly approves them
- A confirmed distribution writes the selected version to all enabled supported agents
- Per-agent failures are recorded without erasing successful results for other agents
- State survives app restart, including pending updates and recent activity
- Secrets are not stored in plaintext app configuration

## Rationale for the Chosen Approach

The approved direction is a new Electron desktop client rather than a new page inside the existing web console.

Reasons:

- The desktop client has different permissions, runtime behavior, and operating assumptions than the server-hosted console
- Background polling, tray behavior, notifications, and local filesystem writes are native desktop responsibilities
- Electron aligns with the user's JavaScript and TypeScript background
- A dedicated desktop app keeps the server API boundary clean and leaves room for future client-focused endpoints

## Deferred Work

The following are intentionally deferred until after v1:

- per-agent or per-skill routing rules
- automatic silent rollouts
- server-pushed sync events
- richer package metadata views or version diffs in the client
- in-app editing of skills
- advanced rollback UX beyond backup-based recovery

## Next Step

The next document should be an implementation plan that breaks this design into executable milestones, starting with:

- desktop-client app scaffold
- client API integration
- local state model
- agent adapter skeletons
- pending update workflow
- safe distribution pipeline
