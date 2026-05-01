# Local Skills Management

Status: canonical local product spec

## Purpose

Build a management interface that allows operators to view all locally detected skills, identify those that don't exist on the server, and upload them to the server when needed.

## Goals

- Provide a dedicated view for displaying all locally detected skills
- Indicate for each skill whether it exists on the server
- Add an "Upload" button for skills that only exist locally
- Maintain consistency with existing UI patterns
- Reuse existing agent detection infrastructure

## Non-Goals

- In-app skill editing capabilities
- Automatic upload to server without explicit user action
- Bulk upload operations
- Skill deletion from server
- Skill version management on the server

## Supported Agents

- Claude Code
- Cursor
- Windsurf
- GitHub Copilot
- RooCode
- Cline
- Gemini CLI
- Codex
- OpenCode
- KiloCode
- Amp
- Kiro
- Warp
- Trae
- Factory
- Kimi Code CLI
- Mistral Le Chat
- Pi Coding Agent
- Antigravity
- OpenClaw

## Core Product Rules

- The server remains the source of truth for skill visibility and versions
- Local skills are displayed for awareness and optional upload only
- Upload operations must be explicit user actions
- Skills that exist on the server should not show any upload controls
- The existing agent detection infrastructure should be reused to find local skills

## Local Skills Display Mechanism

### Definition

Local Skills Management refers to the interface that shows all skills currently present in local agent installations, indicates their server presence status, and provides upload functionality for skills missing from the server.

### Rationale

**Visibility**
- Operators need to see what skills they have locally installed
- Prevents accidental loss of custom local skills
- Provides awareness of skill inventory

**Upload Capability**
- Operators may want to share their custom skills to the server
- Upload is an explicit action, ensuring no unintended sharing
- Only skills not already on the server show the upload button

### Display Flow

```
Detect local skills from agents → Query server for existence → Display list with status indicators → Show upload button for missing skills
```

## UI Specification

### New Navigation Item

A new navigation item "Local Skills" will be added to the main navigation bar, positioned between "Home" and "Updates".

### Local Skills View

The new view will display:

**Skill List**
- Skill name (primary display)
- Skill ID (secondary information)
- Agent source (which agent installation the skill was found in)
- Server presence indicator (exists / missing)

**Upload Button**
- Only visible for skills that do NOT exist on the server
- Positioned next to the skill entry
- When clicked, initiates upload process
- Shows busy state during upload

**Empty State**
- Displayed when no local skills are found
- Provides helpful message about skill detection

## Expected User Experience

- Operators can view all locally installed skills at a glance
- Operators can easily identify which skills are missing from the server
- Upload process is straightforward with clear feedback
- The interface feels consistent with existing views

## Architecture Boundaries

- Renderer UI: Displays skill list and upload controls
- IPC bridge: Handles communication between renderer and main process
- Electron main process:
  - Reuses existing AgentDetectionService to find local skills
  - Queries server for skill existence via API
  - Handles upload operation (if implemented)
  - Manages file system access for skill package preparation

## Security Requirements

- No secrets exposed to renderer process
- Upload operations must validate skill packages before transmission
- Path validation for skill package files
- API token management follows existing patterns

## References

- API contract: `../references/client-api-contract.md`
- Runtime and storage surface: `../references/runtime-and-storage-surface.md`
- Agent detection: `../design-docs/agent-detection-and-distribution.md`
