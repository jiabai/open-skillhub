# Desktop Client V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Open SkillHub desktop client vertical slice: a Windows Electron app plus the minimum backend client API needed to detect, review, and distribute skill updates to Codex, Claude Code, and Gemini CLI.

**Architecture:** Add a new `desktop-client/` application with an Electron main process, a React renderer, and focused core modules for storage, sync, and distribution. Extend the backend with a token-authenticated `GET /api/v1/client/skills` summary endpoint so the desktop client can compare remote state against its local SQLite state without depending on JWT console routes.

**Tech Stack:** FastAPI, Pydantic 2, pytest, Electron, React, TypeScript, Vite, Vitest, Testing Library, SQLite, Windows Credential Manager

---

## File Structure

### Backend surface

- Create: `backend/schemas/client_skill.py`
  - API-token-facing response models for client skill summaries
- Create: `backend/services/client_skill_catalog.py`
  - Builds the `GET /api/v1/client/skills` response from existing skill/version state
- Modify: `backend/api/v1/client_skills.py`
  - Add the summary route alongside the existing download route
- Create: `tests/test_client_skills_api.py`
  - Covers token-authenticated skill summary and download flows

### Desktop app scaffold

- Create: `desktop-client/package.json`
  - App scripts, Electron/Vite/Vitest dependencies, package metadata
- Create: `desktop-client/tsconfig.json`
- Create: `desktop-client/tsconfig.node.json`
- Create: `desktop-client/vite.config.ts`
- Create: `desktop-client/vitest.config.ts`
- Create: `desktop-client/index.html`
- Create: `desktop-client/src/test/setup.ts`
- Create: `desktop-client/README.md`
- Create: `desktop-client/AGENTS.md`

### Electron runtime

- Create: `desktop-client/electron/main.ts`
  - Creates the window, tray, notifications, and owns privileged services
- Create: `desktop-client/electron/preload.ts`
  - Exposes a narrow renderer-safe API bridge
- Create: `desktop-client/electron/ipc.ts`
  - Registers typed IPC handlers for config, sync, agents, and distribution

### Shared desktop types and renderer entry

- Create: `desktop-client/src/main.tsx`
- Create: `desktop-client/src/app/App.tsx`
- Create: `desktop-client/src/types/index.ts`
- Create: `desktop-client/src/lib/ipc-client.ts`

### Storage and sync core

- Create: `desktop-client/src/core/storage/app-paths.ts`
- Create: `desktop-client/src/core/storage/config-store.ts`
- Create: `desktop-client/src/core/storage/secret-store.ts`
- Create: `desktop-client/src/core/storage/state-db.ts`
- Create: `desktop-client/src/core/sync/compare.ts`
- Create: `desktop-client/src/core/sync/sync-service.ts`

### Distribution core and agent adapters

- Create: `desktop-client/src/core/distribution/package-service.ts`
- Create: `desktop-client/src/core/distribution/distribution-service.ts`
- Create: `desktop-client/src/adapters/agents/base.ts`
- Create: `desktop-client/src/adapters/agents/registry.ts`
- Create: `desktop-client/src/adapters/agents/codex.ts`
- Create: `desktop-client/src/adapters/agents/claude-code.ts`
- Create: `desktop-client/src/adapters/agents/gemini-cli.ts`

### Renderer components

- Create: `desktop-client/src/components/nav-shell.tsx`
- Create: `desktop-client/src/components/overview-panel.tsx`
- Create: `desktop-client/src/components/pending-updates-panel.tsx`
- Create: `desktop-client/src/components/agents-panel.tsx`
- Create: `desktop-client/src/components/settings-panel.tsx`
- Create: `desktop-client/src/components/activity-panel.tsx`

### Desktop tests

- Create: `desktop-client/src/__tests__/app.test.tsx`
- Create: `desktop-client/src/__tests__/storage.test.ts`
- Create: `desktop-client/src/__tests__/compare.test.ts`
- Create: `desktop-client/src/__tests__/sync-service.test.ts`
- Create: `desktop-client/src/__tests__/agent-adapters.test.ts`
- Create: `desktop-client/src/__tests__/distribution-service.test.ts`

## Sequencing Notes

- Build the backend summary endpoint before the desktop sync core so the client can target a stable contract.
- Keep filesystem writes, token storage, SQLite access, tray behavior, and notifications in the Electron main process only.
- The renderer must talk to privileged capabilities through `preload.ts` and typed IPC wrappers, never via direct Node access.
- Keep the first vertical slice intentionally narrow: detect updates, review them, and distribute to all enabled agents.

### Task 1: Add the client skill summary API

**Files:**
- Create: `backend/schemas/client_skill.py`
- Create: `backend/services/client_skill_catalog.py`
- Modify: `backend/api/v1/client_skills.py`
- Test: `tests/test_client_skills_api.py`

- [ ] **Step 1: Write the failing API summary tests**

```python
async def test_client_skills_list_returns_latest_visible_versions(async_client, api_token_headers, seeded_skill):
    response = await async_client.get("/api/v1/client/skills", headers=api_token_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["skill_uuid"] == seeded_skill.id
    assert payload["items"][0]["current_version"] == "1.2.0"
```

- [ ] **Step 2: Run the new backend test to verify it fails**

Run: `uv run pytest tests/test_client_skills_api.py -q`

Expected: FAIL because `GET /api/v1/client/skills` does not exist yet.

- [ ] **Step 3: Add client-facing Pydantic models**

```python
class ClientSkillSummary(BaseModel):
    skill_uuid: str
    name: str
    current_version: str | None
    updated_at: datetime | None
    is_active: bool

class ClientSkillListResponse(BaseModel):
    items: list[ClientSkillSummary]
```

- [ ] **Step 4: Implement the catalog service and route**

```python
@router.get("", response_model=ClientSkillListResponse)
async def list_client_skills(
    current_user=Depends(require_api_token_permission("skill.read")),
    session=Depends(get_async_session),
):
    service = ClientSkillCatalogService(session)
    return await service.list_skills(current_user)
```

- [ ] **Step 5: Re-run the targeted backend test**

Run: `uv run pytest tests/test_client_skills_api.py -q`

Expected: PASS.

- [ ] **Step 6: Run the existing client-skill download tests or adjacent route tests**

Run: `uv run pytest tests/test_client_skills_api.py tests/test_api_skill_download.py -q`

Expected: PASS or only unrelated pre-existing failures.

- [ ] **Step 7: Commit the backend API slice**

```bash
git add backend/schemas/client_skill.py backend/services/client_skill_catalog.py backend/api/v1/client_skills.py tests/test_client_skills_api.py
git commit -m "feat: add client skill summary endpoint"
```

### Task 2: Scaffold the Electron desktop app

**Files:**
- Create: `desktop-client/package.json`
- Create: `desktop-client/tsconfig.json`
- Create: `desktop-client/tsconfig.node.json`
- Create: `desktop-client/vite.config.ts`
- Create: `desktop-client/vitest.config.ts`
- Create: `desktop-client/index.html`
- Create: `desktop-client/src/test/setup.ts`
- Create: `desktop-client/src/main.tsx`
- Create: `desktop-client/src/app/App.tsx`
- Create: `desktop-client/src/__tests__/app.test.tsx`
- Create: `desktop-client/README.md`
- Create: `desktop-client/AGENTS.md`

- [ ] **Step 1: Write the failing renderer smoke test**

```tsx
it("renders the desktop shell heading", () => {
  render(<App />)
  expect(screen.getByText("Open SkillHub Desktop")).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the desktop test to verify it fails**

Run: `cd desktop-client; npm test -- --run src/__tests__/app.test.tsx`

Expected: FAIL because the desktop app scaffold does not exist yet.

- [ ] **Step 3: Create the package, Vite, TypeScript, and test harness files**

```json
{
  "name": "skillhub-desktop-client",
  "private": true,
  "type": "module",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "keytar": "^7.9.0",
    "better-sqlite3": "^11.7.0",
    "adm-zip": "^0.5.16"
  },
  "devDependencies": {
    "electron": "^33.2.1",
    "vite": "^5.4.8",
    "vitest": "^2.1.3",
    "@vitejs/plugin-react": "^4.3.2",
    "@testing-library/react": "^16.0.1",
    "typescript": "^5.6.3"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.node.json && vite build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Install the desktop dependencies**

Run: `cd desktop-client; npm install`

Expected: PASS with `node_modules` created and no missing-script errors.

- [ ] **Step 5: Add the first renderable `App` shell**

```tsx
export function App() {
  return <main><h1>Open SkillHub Desktop</h1></main>
}
```

- [ ] **Step 6: Re-run the renderer smoke test**

Run: `cd desktop-client; npm test -- --run src/__tests__/app.test.tsx`

Expected: PASS.

- [ ] **Step 7: Run a build smoke test for the renderer**

Run: `cd desktop-client; npm run build`

Expected: PASS with a generated Vite build in `desktop-client/dist`.

- [ ] **Step 8: Commit the desktop scaffold**

```bash
git add desktop-client/package.json desktop-client/tsconfig.json desktop-client/tsconfig.node.json desktop-client/vite.config.ts desktop-client/vitest.config.ts desktop-client/index.html desktop-client/src/test/setup.ts desktop-client/src/main.tsx desktop-client/src/app/App.tsx desktop-client/src/__tests__/app.test.tsx desktop-client/README.md desktop-client/AGENTS.md
git commit -m "feat: scaffold desktop client app"
```

### Task 3: Add local paths, config storage, and secret storage

**Files:**
- Create: `desktop-client/src/core/storage/app-paths.ts`
- Create: `desktop-client/src/core/storage/config-store.ts`
- Create: `desktop-client/src/core/storage/secret-store.ts`
- Test: `desktop-client/src/__tests__/storage.test.ts`

- [ ] **Step 1: Write the failing storage tests**

```ts
it("creates the expected local app directories", async () => {
  const paths = await ensureAppPaths(tempRoot)
  expect(paths.cacheDir).toContain("OpenSkillHub")
  expect(existsSync(paths.logsDir)).toBe(true)
})

it("stores the API token through the secret store interface", async () => {
  const secretStore = new InMemorySecretStore()
  await secretStore.saveApiToken("ask_live_123")
  await expect(secretStore.getApiToken()).resolves.toBe("ask_live_123")
})
```

- [ ] **Step 2: Run the storage tests to verify they fail**

Run: `cd desktop-client; npm test -- --run src/__tests__/storage.test.ts`

Expected: FAIL because the path and storage modules do not exist yet.

- [ ] **Step 3: Implement app paths and config persistence**

```ts
export async function ensureAppPaths(root = process.env.LOCALAPPDATA ?? homedir()): Promise<AppPaths> {
  const baseDir = join(root, "OpenSkillHub")
  // create config, cache, logs, backups
}
```

- [ ] **Step 4: Implement a real secret-store adapter and a test double**

```ts
export interface SecretStore {
  getApiToken(): Promise<string | null>
  saveApiToken(token: string): Promise<void>
  clearApiToken(): Promise<void>
}
```

- [ ] **Step 5: Re-run the storage tests**

Run: `cd desktop-client; npm test -- --run src/__tests__/storage.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the storage foundation**

```bash
git add desktop-client/src/core/storage/app-paths.ts desktop-client/src/core/storage/config-store.ts desktop-client/src/core/storage/secret-store.ts desktop-client/src/__tests__/storage.test.ts
git commit -m "feat: add desktop config and secret storage"
```

### Task 4: Add the SQLite state store and sync comparison logic

**Files:**
- Create: `desktop-client/src/core/storage/state-db.ts`
- Create: `desktop-client/src/core/sync/compare.ts`
- Create: `desktop-client/src/core/sync/sync-service.ts`
- Create: `desktop-client/src/types/index.ts`
- Create: `desktop-client/src/__tests__/compare.test.ts`
- Create: `desktop-client/src/__tests__/sync-service.test.ts`

- [ ] **Step 1: Write the failing comparison and sync tests**

```ts
it("creates a pending update when the remote version is newer than the distributed version", () => {
  const result = compareRemoteToLocal(
    [{ skillUuid: "a", currentVersion: "1.3.0" }],
    [{ skillUuid: "a", distributedVersion: "1.2.1" }]
  )
  expect(result.pending).toEqual([
    expect.objectContaining({ skillUuid: "a", targetVersion: "1.3.0" })
  ])
})
```

- [ ] **Step 2: Run the sync tests to verify they fail**

Run: `cd desktop-client; npm test -- --run src/__tests__/compare.test.ts src/__tests__/sync-service.test.ts`

Expected: FAIL because the comparison logic and state DB do not exist yet.

- [ ] **Step 3: Implement typed desktop state models and the SQLite wrapper**

```ts
export type PendingUpdate = {
  skillUuid: string
  name: string
  currentVersion: string | null
  targetVersion: string
}
```

- [ ] **Step 4: Implement sync comparison and `SyncService.refresh()`**

```ts
export async function refresh(): Promise<SyncRefreshResult> {
  const remote = await apiClient.listSkills()
  const local = stateDb.listDistributedSkills()
  const pending = compareRemoteToLocal(remote.items, local)
  stateDb.replacePendingUpdates(pending)
  return { remoteCount: remote.items.length, pendingCount: pending.length }
}
```

- [ ] **Step 5: Re-run the sync tests**

Run: `cd desktop-client; npm test -- --run src/__tests__/compare.test.ts src/__tests__/sync-service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the sync state slice**

```bash
git add desktop-client/src/types/index.ts desktop-client/src/core/storage/state-db.ts desktop-client/src/core/sync/compare.ts desktop-client/src/core/sync/sync-service.ts desktop-client/src/__tests__/compare.test.ts desktop-client/src/__tests__/sync-service.test.ts
git commit -m "feat: add desktop sync state and comparison"
```

### Task 5: Implement the agent adapter layer

**Files:**
- Create: `desktop-client/src/adapters/agents/base.ts`
- Create: `desktop-client/src/adapters/agents/registry.ts`
- Create: `desktop-client/src/adapters/agents/codex.ts`
- Create: `desktop-client/src/adapters/agents/claude-code.ts`
- Create: `desktop-client/src/adapters/agents/gemini-cli.ts`
- Create: `desktop-client/src/__tests__/agent-adapters.test.ts`

- [ ] **Step 1: Write the failing adapter tests**

```ts
it("registers the three supported agent adapters", () => {
  const registry = buildAgentRegistry()
  expect(registry.supportedKinds()).toEqual(["codex", "claude-code", "gemini-cli"])
})

it("installs a skill into an agent skills directory", async () => {
  const adapter = new CodexAdapter()
  await adapter.installSkill(target, { skillId: "excel", version: "1.2.0", extractedPath })
  expect(existsSync(join(target.skillsPath, "excel", "SKILL.md"))).toBe(true)
})
```

- [ ] **Step 2: Run the adapter tests to verify they fail**

Run: `cd desktop-client; npm test -- --run src/__tests__/agent-adapters.test.ts`

Expected: FAIL because the adapter files do not exist yet.

- [ ] **Step 3: Implement the shared adapter contract and registry**

```ts
export interface AgentAdapter {
  kind: AgentKind
  detectInstallations(): Promise<AgentInstallation[]>
  validateSkillsPath(path: string): Promise<boolean>
  installSkill(target: AgentInstallation, payload: ResolvedSkillPayload): Promise<void>
  verifySkill(target: AgentInstallation, skillId: string, version: string): Promise<boolean>
}
```

- [ ] **Step 4: Implement Codex, Claude Code, and Gemini CLI adapters with identical v1 write semantics**

```ts
await cp(join(payload.extractedPath), join(target.skillsPath, payload.skillId), { recursive: true })
```

- [ ] **Step 5: Re-run the adapter tests**

Run: `cd desktop-client; npm test -- --run src/__tests__/agent-adapters.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the adapter layer**

```bash
git add desktop-client/src/adapters/agents/base.ts desktop-client/src/adapters/agents/registry.ts desktop-client/src/adapters/agents/codex.ts desktop-client/src/adapters/agents/claude-code.ts desktop-client/src/adapters/agents/gemini-cli.ts desktop-client/src/__tests__/agent-adapters.test.ts
git commit -m "feat: add desktop agent adapters"
```

### Task 6: Implement package validation and multi-agent distribution

**Files:**
- Create: `desktop-client/src/core/distribution/package-service.ts`
- Create: `desktop-client/src/core/distribution/distribution-service.ts`
- Create: `desktop-client/src/__tests__/distribution-service.test.ts`
- Modify: `desktop-client/src/core/storage/state-db.ts`
- Modify: `desktop-client/src/types/index.ts`

- [ ] **Step 1: Write the failing distribution tests**

```ts
it("distributes an approved skill to all enabled agents and records per-target results", async () => {
  const result = await distributionService.distributePendingUpdate(pendingUpdate)
  expect(result.targets).toHaveLength(3)
  expect(result.targets.every((item) => item.status === "success")).toBe(true)
})

it("returns partial success when one agent path is invalid", async () => {
  const result = await distributionService.distributePendingUpdate(pendingUpdate)
  expect(result.status).toBe("partial_success")
})
```

- [ ] **Step 2: Run the distribution tests to verify they fail**

Run: `cd desktop-client; npm test -- --run src/__tests__/distribution-service.test.ts`

Expected: FAIL because the package and distribution services do not exist yet.

- [ ] **Step 3: Implement the package service**

```ts
export async function resolveDownload(download: SkillDownloadResponse): Promise<ResolvedSkillPayload> {
  assertNotExpired(download.expiresAt)
  assertChecksum(download)
  const extractedPath = await extractArchive(download)
  assertSkillLayout(extractedPath)
  return { skillId: download.skillUuid, version: download.version, extractedPath }
}
```

- [ ] **Step 4: Implement the distribution coordinator**

```ts
for (const target of enabledTargets) {
  try {
    await backupIfPresent(target, payload.skillId)
    await adapter.installSkill(target, payload)
    await adapter.verifySkill(target, payload.skillId, payload.version)
    results.push({ target: target.kind, status: "success" })
  } catch (error) {
    results.push({ target: target.kind, status: "failed", error: normalizeError(error) })
  }
}
```

- [ ] **Step 5: Re-run the distribution tests**

Run: `cd desktop-client; npm test -- --run src/__tests__/distribution-service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the distribution pipeline**

```bash
git add desktop-client/src/core/distribution/package-service.ts desktop-client/src/core/distribution/distribution-service.ts desktop-client/src/core/storage/state-db.ts desktop-client/src/types/index.ts desktop-client/src/__tests__/distribution-service.test.ts
git commit -m "feat: add desktop distribution pipeline"
```

### Task 7: Wire Electron main, preload, and IPC

**Files:**
- Create: `desktop-client/electron/main.ts`
- Create: `desktop-client/electron/preload.ts`
- Create: `desktop-client/electron/ipc.ts`
- Create: `desktop-client/src/lib/ipc-client.ts`
- Modify: `desktop-client/src/main.tsx`

- [ ] **Step 1: Write the failing IPC contract test**

```ts
it("exposes a desktop client API surface", () => {
  expect(window.desktopClient.refreshSync).toBeTypeOf("function")
  expect(window.desktopClient.distributePendingUpdate).toBeTypeOf("function")
})
```

- [ ] **Step 2: Run the renderer contract test to verify it fails**

Run: `cd desktop-client; npm test -- --run src/__tests__/app.test.tsx`

Expected: FAIL because the preload contract is not exposed yet.

- [ ] **Step 3: Implement the Electron main process and typed IPC handlers**

```ts
ipcMain.handle("sync:refresh", async () => syncService.refresh())
ipcMain.handle("distribution:run", async (_event, pendingUpdateId: string) =>
  distributionService.distributePendingUpdate(pendingUpdateId)
)
```

- [ ] **Step 4: Expose the safe preload bridge and renderer wrapper**

```ts
contextBridge.exposeInMainWorld("desktopClient", {
  refreshSync: () => ipcRenderer.invoke("sync:refresh"),
  distributePendingUpdate: (id: string) => ipcRenderer.invoke("distribution:run", id),
})
```

- [ ] **Step 5: Re-run the renderer contract test**

Run: `cd desktop-client; npm test -- --run src/__tests__/app.test.tsx`

Expected: PASS after the app consumes the exposed bridge.

- [ ] **Step 6: Run a packaged build smoke test**

Run: `cd desktop-client; npm run build`

Expected: PASS for both renderer and Electron TypeScript compilation.

- [ ] **Step 7: Commit the Electron runtime slice**

```bash
git add desktop-client/electron/main.ts desktop-client/electron/preload.ts desktop-client/electron/ipc.ts desktop-client/src/lib/ipc-client.ts desktop-client/src/main.tsx desktop-client/src/__tests__/app.test.tsx
git commit -m "feat: wire desktop electron runtime"
```

### Task 8: Build the review-first desktop UI

**Files:**
- Create: `desktop-client/src/components/nav-shell.tsx`
- Create: `desktop-client/src/components/overview-panel.tsx`
- Create: `desktop-client/src/components/pending-updates-panel.tsx`
- Create: `desktop-client/src/components/agents-panel.tsx`
- Create: `desktop-client/src/components/settings-panel.tsx`
- Create: `desktop-client/src/components/activity-panel.tsx`
- Modify: `desktop-client/src/app/App.tsx`
- Modify: `desktop-client/src/__tests__/app.test.tsx`

- [ ] **Step 1: Write the failing UI flow tests**

```tsx
it("shows pending updates as the primary surface", async () => {
  render(<App />)
  expect(await screen.findByText("Pending Updates")).toBeInTheDocument()
  expect(await screen.findByRole("button", { name: "Distribute" })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the UI tests to verify they fail**

Run: `cd desktop-client; npm test -- --run src/__tests__/app.test.tsx`

Expected: FAIL because the multi-panel review UI has not been implemented.

- [ ] **Step 3: Add the navigation shell and review panels**

```tsx
<NavShell>
  <OverviewPanel />
  <PendingUpdatesPanel />
  <AgentsPanel />
  <SettingsPanel />
  <ActivityPanel />
</NavShell>
```

- [ ] **Step 4: Connect the UI to the preload-backed IPC client**

```tsx
const pendingUpdates = usePendingUpdates()
<button onClick={() => desktopClient.distributePendingUpdate(item.id)}>Distribute</button>
```

- [ ] **Step 5: Re-run the UI tests**

Run: `cd desktop-client; npm test -- --run src/__tests__/app.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the renderer UI**

```bash
git add desktop-client/src/components/nav-shell.tsx desktop-client/src/components/overview-panel.tsx desktop-client/src/components/pending-updates-panel.tsx desktop-client/src/components/agents-panel.tsx desktop-client/src/components/settings-panel.tsx desktop-client/src/components/activity-panel.tsx desktop-client/src/app/App.tsx desktop-client/src/__tests__/app.test.tsx
git commit -m "feat: add desktop review ui"
```

### Task 9: Add polling, tray behavior, and end-to-end verification

**Files:**
- Modify: `desktop-client/electron/main.ts`
- Modify: `desktop-client/src/core/sync/sync-service.ts`
- Modify: `desktop-client/src/core/distribution/distribution-service.ts`
- Modify: `desktop-client/README.md`
- Modify: `desktop-client/AGENTS.md`
- Modify: `README.md`
- Modify: `README_ZH.md`

- [ ] **Step 1: Write the failing integration checks for polling and review state**

```ts
it("creates pending updates during a background refresh without auto-distributing them", async () => {
  await syncService.refresh()
  expect(stateDb.listPendingUpdates()).toHaveLength(1)
  expect(distributionSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the sync and distribution integration tests**

Run: `cd desktop-client; npm test -- --run src/__tests__/sync-service.test.ts src/__tests__/distribution-service.test.ts`

Expected: FAIL until polling and state wiring are complete.

- [ ] **Step 3: Add background polling, tray badge updates, and desktop notifications**

```ts
setInterval(async () => {
  const result = await syncService.refresh()
  if (result.pendingCount > 0) {
    tray.setToolTip(`SkillHub Sync (${result.pendingCount} updates)`)
    new Notification({ title: "New skills are ready for review" }).show()
  }
}, config.pollIntervalMs)
```

- [ ] **Step 4: Update desktop and repository docs with local run instructions**

```md
cd desktop-client
npm install
npm test
npm run build
```

- [ ] **Step 5: Re-run the backend and desktop verification set**

Run: `uv run pytest tests/test_client_skills_api.py -q`

Run: `cd desktop-client; npm test`

Run: `cd desktop-client; npm run build`

Expected: PASS.

- [ ] **Step 6: Commit the end-to-end vertical slice**

```bash
git add desktop-client/electron/main.ts desktop-client/src/core/sync/sync-service.ts desktop-client/src/core/distribution/distribution-service.ts desktop-client/README.md desktop-client/AGENTS.md README.md README_ZH.md
git commit -m "feat: finish desktop client v1 vertical slice"
```

## Self-Check Before Execution

- The backend exposes `GET /api/v1/client/skills` and `POST /api/v1/client/skills/download`
- The desktop renderer does not use direct Node APIs
- API token storage is routed through the secret-store abstraction
- Pending updates are generated before any distribution occurs
- Distribution writes to all enabled agents and records partial failures per target
- Docs explain how to run backend tests and desktop tests locally

## Plan Review Notes

The writing-plans skill normally asks for a dedicated plan-document-reviewer subagent. In this environment, subagents are not available unless the user explicitly asks for delegation, so review must happen inline. Review this document against the approved spec before execution and fix any issue that would block an implementer.
