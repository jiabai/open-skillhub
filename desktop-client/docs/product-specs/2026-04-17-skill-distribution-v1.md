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

## Expected User Experience

- The app runs as a Windows desktop utility with tray presence.
- Background polling discovers reviewable updates.
- Pending updates remain visible in the main window until acted on.
- One approval distributes the chosen version to all enabled supported agents.
- Activity and failures should be understandable enough for manual retry.

## Current Implemented Surface

- Renderer UI for overview, pending updates, agents, settings, and activity
- Electron main process for tray behavior, polling orchestration, notifications, and distribution
- Client API usage through `GET /api/v1/client/skills` and `POST /api/v1/client/skills/download`
- Local SQLite-backed sync snapshot with pending updates and distributed-skill records
- Agent adapters for Codex, Claude Code, and Gemini CLI

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
