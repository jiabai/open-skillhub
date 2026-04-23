# API Token Configuration UI

## Summary

Add a user-friendly configuration interface in the desktop client to allow manual input of API Token and API Base URL, eliminating the need for environment variable configuration.

## Motivation

### Current Pain Points

| Issue | Impact |
|-------|--------|
| Token only configurable via environment variable | Requires terminal/command line knowledge |
| No visual feedback on token status | Users cannot verify if token is saved correctly |
| Settings panel only displays status | No interactive configuration capability |
| Non-technical users blocked | Cannot use the client without CLI skills |

### Target Users

- Operators who received an API Token from the server admin
- Users who want to reconfigure or clear an existing token
- Users switching between different server instances (dev/prod)

## Design Goals

1. **Self-contained configuration** - Complete setup without external tools
2. **Secure storage** - Token persisted via system credential store (keytar)
3. **Clear feedback** - Visual confirmation of save success/failure
4. **Privilege isolation** - All storage operations through IPC bridge (per core-beliefs.md)

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      First Launch                            │
│                                                             │
│  App detects no token → Shows "Configure API Token" panel   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Configuration Panel                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ API Base URL                                         │    │
│  │ [http://127.0.0.1:8001                        ] [✓] │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ API Token                                            │    │
│  │ [••••••••••••••••••••••••••••••                ] [👁] │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [Save Configuration]  [Clear Token]                        │
│                                                             │
│  Status: ● Token saved to system credential store           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Post-Save Behavior                        │
│                                                             │
│  - Token stored in system keychain/credential manager        │
│  - App attempts connection test                             │
│  - Success → Navigate to main review panel                  │
│  - Failure → Show error, allow retry                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## UI Components

### New Components

| Component | File | Description |
|-----------|------|-------------|
| `ConfigPanel` | `src/components/config-panel.tsx` | Full configuration form with inputs |
| `ConfigStatus` | `src/components/config-status.tsx` | Status indicator after save/clear |

### Modified Components

| Component | Change |
|-----------|--------|
| `SettingsPanel` | Replace static text with "Edit Configuration" button linking to ConfigPanel |
| `NavShell` | Add conditional rendering for ConfigPanel when token missing |
| `App` | Add config mode state management |

### UI Layout (ASCII Mock)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   ┌──────────────────────┐   ┌───────────────────────────────────────┐  │
│   │                      │   │                                       │  │
│   │   OPEN SKILLHUB      │   │   API Configuration                   │  │
│   │                      │   │   ─────────────────────               │  │
│   │   Setup Required     │   │                                       │  │
│   │                      │   │   Connect to the SkillHub server to   │  │
│   │   [Configure Now]    │   │   receive pending skill updates.      │  │
│   │                      │   │                                       │  │
│   │                      │   │   ┌─────────────────────────────────┐ │  │
│   │                      │   │   │ API Base URL                    │ │  │
│   │                      │   │   │ http://127.0.0.1:8001      [✓] │ │  │
│   │                      │   │   └─────────────────────────────────┘ │  │
│   │                      │   │                                       │  │
│   │                      │   │   ┌─────────────────────────────────┐ │  │
│   │                      │   │   │ API Token                       │ │  │
│   │                      │   │   │ ••••••••••••             [👁]   │ │  │
│   │                      │   │   └─────────────────────────────────┘ │  │
│   │                      │   │                                       │  │
│   │                      │   │   [Save Configuration]                │  │
│   │                      │   │                                       │  │
│   │                      │   │   ──────────────────────────────────  │  │
│   │                      │   │                                       │  │
│   │                      │   │   ● Status: Not configured            │  │
│   │                      │   │                                       │  │
│   └──────────────────────┘   └───────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Technical Design

### IPC Extension

Add new channels to the existing IPC bridge:

```typescript
// electron/ipc.ts - existing channels
export const desktopClientIpcChannels = {
  refreshSync: "desktop-client:refresh-sync",
  distributePendingUpdate: "desktop-client:distribute-pending-update",
  // NEW:
  getConfiguration: "desktop-client:get-configuration",
  saveConfiguration: "desktop-client:save-configuration",
  clearConfiguration: "desktop-client:clear-configuration",
  testConnection: "desktop-client:test-connection"
}
```

### IPC Handler Types

```typescript
// Types for IPC bridge
interface ConfigurationPayload {
  apiBaseUrl: string
  apiToken: string
}

interface ConfigurationState {
  apiBaseUrl: string
  hasToken: boolean  // true/false, never expose actual token to renderer
  tokenSource: 'secret-store' | 'environment' | 'missing'
}

interface ConnectionTestResult {
  success: boolean
  error?: string
  serverVersion?: string
}
```

### Main Process Implementation

```typescript
// electron/main.ts additions

async function handleGetConfiguration(): Promise<ConfigurationState> {
  const config = await createRuntimeConfig()
  return {
    apiBaseUrl: config.apiBaseUrl,
    hasToken: config.apiToken !== null,
    tokenSource: config.apiToken ? 'secret-store' : 'missing'
  }
}

async function handleSaveConfiguration(payload: ConfigurationPayload): Promise<void> {
  const secretStore = createKeytarSecretStore(APP_NAME)
  
  // Normalize and validate
  const normalizedUrl = normalizeBaseUrl(payload.apiBaseUrl)
  const normalizedToken = payload.apiToken.trim()
  
  if (!normalizedToken) {
    throw new Error("API token cannot be empty")
  }
  
  // Persist token
  await secretStore.setApiToken(normalizedToken)
  
  // Persist URL (new requirement - needs storage mechanism)
  // Option: Save to state DB or separate config file
}

async function handleClearConfiguration(): Promise<void> {
  const secretStore = createKeytarSecretStore(APP_NAME)
  await secretStore.clearApiToken()
}

async function handleTestConnection(config: ConfigurationPayload): Promise<ConnectionTestResult> {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/v1/health`, {
      headers: { Authorization: `Bearer ${config.apiToken}` }
    })
    
    if (!response.ok) {
      return { success: false, error: `Server returned ${response.status}` }
    }
    
    const data = await response.json()
    return { success: true, serverVersion: data.version }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) }
  }
}
```

### Preload Bridge Extension

```typescript
// electron/preload.ts additions

const desktopClientBridge: DesktopClientBridge = {
  // existing
  refreshSync: () => ipcRenderer.invoke(desktopClientIpcChannels.refreshSync),
  distributePendingUpdate: (id) => ipcRenderer.invoke(desktopClientIpcChannels.distributePendingUpdate, id),
  // NEW
  getConfiguration: () => ipcRenderer.invoke(desktopClientIpcChannels.getConfiguration),
  saveConfiguration: (payload) => ipcRenderer.invoke(desktopClientIpcChannels.saveConfiguration, payload),
  clearConfiguration: () => ipcRenderer.invoke(desktopClientIpcChannels.clearConfiguration),
  testConnection: (payload) => ipcRenderer.invoke(desktopClientIpcChannels.testConnection, payload)
}
```

### Renderer IPC Client

```typescript
// src/lib/ipc-client.ts additions

export interface ConfigurationPayload {
  apiBaseUrl: string
  apiToken: string
}

export interface ConfigurationState {
  apiBaseUrl: string
  hasToken: boolean
  tokenSource: string
}

export interface ConnectionTestResult {
  success: boolean
  error?: string
  serverVersion?: string
}

export const desktopClient = {
  // existing
  isAvailable: isDesktopClientAvailable,
  refreshSync: invokeRefreshSync,
  distributePendingUpdate: invokeDistributePendingUpdate,
  // NEW
  getConfiguration: () => bridge!.getConfiguration(),
  saveConfiguration: (payload: ConfigurationPayload) => bridge!.saveConfiguration(payload),
  clearConfiguration: () => bridge!.clearConfiguration(),
  testConnection: (payload: ConfigurationPayload) => bridge!.testConnection(payload)
}
```

## State Management

### App.tsx State Extensions

```typescript
type AppState = {
  // existing
  syncState: DesktopSyncState
  activity: ActivityEntry[]
  isLoading: boolean
  // NEW
  configState: ConfigurationState | null
  configMode: 'reviewing' | 'configuring' | 'testing'
  configError: string | null
}
```

### State Flow

```
App Mount
    │
    ▼
desktopClient.getConfiguration()
    │
    ▼
hasToken?
    │
    ├── Yes → configMode = 'reviewing', proceed to sync
    │
    └── No → configMode = 'configuring', show ConfigPanel
```

## Security Considerations

Per `core-beliefs.md` principles:

### Principle 2: Privilege Stays in the Main Process

- Token storage (keytar) only accessible in main process
- Renderer never sees actual token value after save
- `getConfiguration()` returns `hasToken: boolean`, not the token itself
- Token passed to main process only during save operation

### Principle 4: Fail Closed On Contract Gaps

- Invalid token format → reject before storage
- Empty token → reject with clear error message
- Connection test failure → show error, don't proceed to sync
- Malformed URL → validate before save attempt

### Token Visibility

- Input field: masked by default (`••••••`)
- Toggle visibility button: shows token temporarily for verification
- After save: token never returned to renderer in subsequent `getConfiguration()` calls

## API Base URL Storage

Current implementation reads `OPEN_SKILLHUB_API_BASE_URL` from environment only.

New requirement: persist URL alongside token.

Options:

| Option | Pros | Cons |
|--------|------|------|
| State DB (SQLite) | Already exists, simple | URL stored in plaintext file |
| Config file (JSON) | Easy to read/write | Needs file path management |
| keytar (same as token) | Secure storage | Keytar designed for passwords, not URLs |

**Recommendation**: Use State DB for URL storage. URL is not a secret, just configuration. Token stays in keytar.

## Implementation Checklist

### Phase 1: IPC Infrastructure
- [ ] Add new IPC channels to `electron/ipc.ts`
- [ ] Implement handlers in `electron/main.ts`
- [ ] Extend preload bridge in `electron/preload.ts`
- [ ] Add types and methods to `src/lib/ipc-client.ts`

### Phase 2: UI Components
- [ ] Create `src/components/config-panel.tsx`
- [ ] Create `src/components/config-status.tsx`
- [ ] Modify `src/components/settings-panel.tsx` to include edit button
- [ ] Update `src/components/nav-shell.tsx` for conditional rendering

### Phase 3: State Management
- [ ] Extend `src/app/App.tsx` with config state
- [ ] Add config mode routing logic
- [ ] Implement connection test flow

### Phase 4: URL Persistence
- [ ] Add URL storage to state DB
- [ ] Create `src/core/storage/config-store.ts` (if needed)
- [ ] Update `createRuntimeConfig()` to read persisted URL

### Phase 5: Polish
- [ ] Add validation feedback (URL format, token format)
- [ ] Add success/error toast notifications
- [ ] Add keyboard shortcuts (Enter to save)
- [ ] Test on Windows/macOS/Linux credential stores

## Open Questions

1. **Should connection test be mandatory before save?**
   - Option A: Test on save, block if fails
   - Option B: Save regardless, show test result
   - Recommendation: Option B (allow offline configuration)

2. **Should environment variable token be visible in UI?**
   - If token came from `OPEN_SKILLHUB_API_TOKEN`, should UI show "Token from environment"?
   - Recommendation: Yes, show source indicator for transparency

3. **Clear token behavior:**
   - Clear token only, or clear URL too?
   - Recommendation: Clear both for clean reset

## Success Criteria

- User can configure token entirely within desktop UI
- Token saved to system credential store on all platforms (Windows/macOS/Linux)
- Connection test provides clear success/failure feedback
- Settings panel shows current configuration status
- No token value ever exposed to renderer after initial save