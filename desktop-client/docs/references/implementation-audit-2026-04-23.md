# Desktop Client Implementation Audit Report

**Date:** 2026-04-23  
**Scope:** Product spec `2026-04-17-skill-distribution-v1` vs codebase  
**Consistency Score:** ~85%

## Summary

The desktop client codebase implements the core product spec with high fidelity across architecture, security, UI, and persistence layers. Three gaps remain between the spec promises and the current implementation.

## Fully Implemented

### Core Runtime Architecture
- Electron main process with tray presence and window lifecycle management
- React renderer with context isolation and sandboxed web preferences
- Preload bridge exposing only `refreshSync` and `distributePendingUpdate` via typed IPC
- Window close preserves tray residency (`main.ts:L361-L368`)

### Polling Mechanism
- Background polling via `setInterval` in `createSyncPollingController`
- Pull architecture: client queries `GET /api/v1/client/skills`
- Polling only refreshes review state; never auto-distributes
- Configurable interval via `OPEN_SKILLHUB_POLL_INTERVAL_MS` (default: 30000ms)
- Tray tooltip updates with pending count; notification on new updates

### Sync Core
- `compareRemoteSkills()` compares remote API response against local SQLite records
- Generates pending updates with reason: `missing-local-record` or `version-mismatch`
- State refreshed before and after distribution operations

### Distribution Service

- Explicit operator approval required via UI "Distribute" button
- Global distribution to all enabled agent targets
- Package validation: checksum (SHA256), expiration, encryption boundary (see API contract for full validation sequence)
- State updated after successful distribution; pending update removed

### Agent Adapters
- Three adapters registered: Codex, Claude Code, Gemini CLI
- Filesystem-based install with path validation
- Rejects unsafe skill identifiers (`.` `..` `/` `\`)
- Post-install verification implemented

### Storage Layer
- SQLite-backed state via `sql.js` with three tables:
  - `distributed_skills` - local record tracking
  - `pending_updates` - review queue
  - `sync_metadata` - last refresh timestamp
- State persists across restarts via file-based database

### UI Panels (5 panels)
1. **Overview Panel** - pending count, local record count, last refresh timestamp, error state
2. **Pending Updates Panel** - skill name, ID, local/remote version, review reason, distribute button with busy state
3. **Agents Panel** - static display of three supported targets
4. **Settings Panel** - review policy, bridge access status, storage snapshot behavior
5. **Activity Panel** - recent actions with neutral/success/warning tones, timestamps

### Security Requirements
- Secrets never enter renderer state (contextIsolation + sandbox)
- Package validation before agent-directory writes
- Path validation rejects unsafe identifiers
- Encrypted packages fail closed without decryptor boundary
- IPC is the only renderer-to-runtime bridge

## Implementation Gaps

### Gap 1: Distribution Warning Prompt (HIGH)

**Spec requirement:** When user clicks "Distribute", explicit warning must display:
- Sync will overwrite all locally installed skills
- Local skills will be identical to cloud version
- Manually installed skills will not auto-sync to cloud
- Manually installed skills may be automatically deleted
- User must confirm to proceed

**Current implementation:** `App.tsx:L171-L196` `handleDistribute` calls IPC directly without confirmation dialog.

**Impact:** Users may accidentally lose local custom skills without understanding destructive consequences.

**Fix location:** `src/app/App.tsx` - add confirmation dialog before `desktopClient.distributePendingUpdate()`

### Gap 2: Secret Store Not Integrated (MEDIUM)

**Spec requirement:** "Secrets never go into plaintext config or renderer state"

**Current implementation:** `secret-store.ts` exists with keytar and in-memory implementations, but `main.ts:L139` still reads `OPEN_SKILLHUB_API_TOKEN` from environment variable directly.

**Impact:** Security posture depends on env-only token startup; no OS-level credential management.

**Fix location:** `electron/main.ts` - wire `createKeytarSecretStore()` into runtime config bootstrap

**Tracked as:** Tech Debt DC-002

### Gap 3: No Canonical Electron Start Script (MEDIUM)

**Spec requirement:** Development workflow should support launching full Electron runtime

**Current implementation:** `package.json` only has:
- `dev` - Vite dev server (renderer only)
- `build` - typecheck + vite build
- `test` - vitest run

No `electron:dev` or equivalent script to launch complete Electron + Vite workflow.

**Impact:** Cannot run end-to-end development flow with single command.

**Fix location:** `package.json` scripts + potentially `electron/main.ts` VITE_DEV_SERVER_URL handling

**Tracked as:** Tech Debt DC-001

### Gap 4: Distribution History Not Persisted (LOW)

**Spec requirement:** "If v1 claims restart-safe activity history, the state store must expand to persist it explicitly"

**Current implementation:** Activity panel data lives in React state only (`App.tsx:L71-L76`). Survives session but not restart.

**Impact:** Audit trail lost on app restart. Product spec does not explicitly promise persisted distribution history in v1.

**Decision:** This is acknowledged as a known limitation in the spec itself. No action required unless product scope expands.

**Tracked as:** Tech Debt DC-003

## Non-Goals Verification

| Non-Goal | Code Compliance | Status |
|----------|----------------|--------|
| Silent automatic rollouts | No auto-distribution logic exists | Compliant |
| Per-skill routing rules | Distribution is global to enabled agents | Compliant |
| Real-time push sync | Polling-only architecture, no WebSocket/SSE | Compliant |
| In-app skill editing/upload | No UI or API for skill management | Compliant |

## References

- Product spec (EN): `../product-specs/2026-04-17-skill-distribution-v1.md`
- Product spec (ZH): `../product-specs/2026-04-17-skill-distribution-v1-zh.md`
- Tech debt tracker: `../exec-plans/tech-debt-tracker.md`
- Runtime surface: `./runtime-and-storage-surface.md`
- API contract: `./client-api-contract.md` - Backend API routes, request/response shapes, and validation rules
