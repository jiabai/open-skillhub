# Desktop Client Skill Distribution V1

Status: canonical local product spec

## Purpose

Build a Windows desktop client that detects new or updated skills from Open SkillHub, holds them for operator review, and distributes approved versions to supported local agent installations.

## Goals

- Provide a standalone Electron desktop client with a React renderer
- Detect remote skill updates available to the current token owner
- Keep updates pending until the operator explicitly approves distribution
- Distribute an approved version to all enabled supported agents in one action
- Preserve enough local state to recover pending updates and sync context across restarts

## Non-Goals

- In-app skill editing, upload, activation, or server-side management flows
- Silent automatic rollouts
- Per-skill routing rules or workspace-specific rollout policies
- Real-time push sync as a v1 requirement

## Supported Agents

- Codex
- Claude Code
- Gemini CLI

## Core Product Rules

- The server is the source of truth for skill visibility and versions.
- The desktop client is the local sync and distribution runtime.
- No package is written to any agent directory before explicit operator approval.
- Distribution is global for enabled agents; per-agent routing is deferred.
- Unsupported encrypted downloads fail closed.

## Skill Review Mechanism

### Definition

Skill review refers to **human inspection and approval** of skill updates detected from the Open SkillHub server before they can be distributed to local agent (Codex, Claude Code, Gemini CLI) installation directories.

### Rationale

**Security Control**
- No package is written to any agent directory before explicit operator approval
- Prevents unreviewed code from automatically entering development environments

**Version Management**
- Pending Updates Panel displays: skill name, ID, local version, remote version, review reason
- Provides clarity on what will be updated, avoiding accidental overwrites or configuration damage

**Preventing Silent Automation Risks**
- "Silent automatic rollouts" is explicitly listed as a non-goal
- Core belief: no skill is written to an agent directory without explicit user approval

**Audit Trail**
- Activity Panel records all distribution operations with timestamps
- Provides operation history for tracing and retrospection

### Review Flow

```
Server discovers update → Download to local staging → Display in pending panel → User clicks "Distribute" → Write to agent directory
```

This is a **human approval gate** mechanism, ensuring users have complete control and visibility over every skill update entering their development environment.

## Skill Detection Mechanism

### Detection Method

The client uses a **background polling** mechanism to automatically detect skill updates on the Open SkillHub server.

### How It Works

**Polling Orchestration**
- Electron main process handles background polling orchestration
- Periodically calls `GET /api/v1/client/skills` API to fetch remote skill status
- Sync core compares remote status against local SQLite snapshot records
- Stages updates to pending review state when new skills or version differences are discovered

**Pull Architecture**
- Client actively queries server for updates (Pull mode)
- Not server-initiated push notifications (Push mode)
- "Real-time push sync" is listed as a V1 non-goal

### Detection Flow

```
Timer triggers → Call remote API → Compare local snapshot → Discover new/updated skills → Add to pending list → Notify user
```

### Key Rules

**Polling Constraints**
- Polling only refreshes review state and surfaces pending updates
- **Polling must never auto-distribute skills**
- Distribution must be an explicit operator action

**Configurability**
- Polling interval can be configured in settings panel
- Users can adjust detection frequency as needed

**State Persistence**
- Pending updates survive app restarts
- Local sync snapshot uses SQLite storage
- Last refresh timestamp displayed in overview panel

## Expected User Experience

- The app runs as a Windows desktop utility with tray presence.
- Background polling discovers reviewable updates.
- Pending updates remain visible in the main window until acted on.
- One approval distributes the chosen version to all enabled supported agents.
- Activity and failures should be understandable enough for manual retry.

## Distribution Warning Prompt

### User Confirmation on Approving Distribution

When the user clicks the "Distribute" button to approve skill sync, an explicit warning prompt must be displayed:

**Warning Content**
- The sync operation will **overwrite all locally installed skills**
- After sync, local skills will be **identical to the cloud version**
- **Manually installed skills will not auto-sync to the cloud**
- Manually installed skills **may be automatically deleted after sync**
- Prompt the user to ** proceed with caution** and confirm whether to continue

**Design Intent**
- Prevent accidental loss of user's local custom skills
- Clearly inform users of the destructive consequences of sync
- Ensure users make decisions with full knowledge of the impact

## Current Implemented Surface

### Core Runtime
- Electron main process for tray behavior, polling orchestration, notifications, and distribution
- Client API usage through `GET /api/v1/client/skills` and `POST /api/v1/client/skills/download`
- Local SQLite-backed sync snapshot with pending updates and distributed-skill records
- Agent adapters for Codex, Claude Code, and Gemini CLI

### Renderer UI Panels
The desktop client provides five core UI panels for operator interaction:

**Overview Panel**
- Displays review snapshot metrics: pending update count, local record count, last refresh timestamp
- Shows loading state and error messages when bridge communication fails
- Provides at-a-glance status for the current sync state

**Pending Updates Panel**
- Primary surface for skill review and distribution approval
- Lists each pending update with: skill name, ID, local version, remote version, review reason
- Provides "Distribute" button per item for explicit approval action
- Shows busy state during distribution operation
- Empty state indicates no updates awaiting review

**Agents Panel**
- Displays supported distribution targets: Claude Code, Codex, Gemini CLI
- Static informational panel showing adapter layer readiness
- No interactive controls; reflects configured agent support

**Settings Panel**
- Documents review policy: pending updates stay gated until human review
- Shows bridge access status (IPC wrapper only, no direct Node access)
- Displays storage snapshot behavior (state refreshed before/after distribution)
- Bridge status indicator with last refresh timestamp

**Activity Panel**
- Shows recent action history with timestamps
- Entry types: neutral (info), success (completed), warning (issues)
- Provides audit trail for distribution operations and sync events
- Empty state when no recent actions recorded

## Current Implementation Gaps

- There is no canonical package script for launching the full Electron runtime in development yet.
- `src/core/storage/secret-store.ts` exists, but runtime bootstrap still reads `OPEN_SKILLHUB_API_TOKEN` from the environment.
- The SQLite state store does not yet persist full distribution history or backup metadata.
- The broader brainstorming design assumed richer recoverability than the current implementation provides.

## Architecture Boundaries

- Renderer UI renders status and invokes actions only.
- Preload and IPC form the only renderer-to-runtime bridge.
- Electron main process owns polling, notifications, filesystem writes, downloads, and runtime bootstrap.
- Sync core compares remote state against local records.
- Distribution core validates packages and coordinates installs.
- Agent adapters own target-specific install and verification behavior.

## Security Requirements

- Secrets never go into plaintext config or renderer state.
- Package validation happens before agent-directory writes.
- Path validation rejects unsafe or ambiguous skill identifiers and destinations.
- Unsupported encrypted packages fail closed until a decryptor boundary exists.

## Persistence Requirements

- Pending updates and local distributed-skill records survive restarts.
- If v1 claims restart-safe activity history, the state store must expand to persist it explicitly.
- Product copy must not promise persisted distribution history until it exists in the schema.

## References

- API contract: `../references/client-api-contract.md`
- Runtime and storage surface: `../references/runtime-and-storage-surface.md`
- Generated state schema: `../generated/state-db-schema.md`

## Historical Context

Earlier brainstorming design and implementation plan drafts that lived in `docs/superpowers/` have been retired. This file is the canonical product spec.
