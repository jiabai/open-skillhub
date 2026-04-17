export interface RemoteSkillSummary {
  id: string
  name: string
  version: string | null
  updatedAt: string
}

export interface LocalDistributedSkillRecord {
  remoteSkillId: string
  name: string
  installedVersion: string | null
  remoteVersion: string | null
  lastComparedAt: string | null
}

export interface PendingSyncUpdate {
  remoteSkillId: string
  name: string
  localVersion: string | null
  remoteVersion: string
  reason: "missing-local-record" | "version-mismatch"
}

export interface SyncComparisonItem {
  remoteSkillId: string
  name: string
  localVersion: string | null
  remoteVersion: string | null
  status: "in-sync" | "install" | "update"
}

export interface DesktopSyncState {
  localRecords: LocalDistributedSkillRecord[]
  pendingUpdates: PendingSyncUpdate[]
  lastRefreshedAt: string | null
}

export interface SyncComparisonResult {
  items: SyncComparisonItem[]
  localRecords: LocalDistributedSkillRecord[]
  pendingUpdates: PendingSyncUpdate[]
  comparedAt: string
}

export interface SyncRefreshResult extends SyncComparisonResult {
  lastRefreshedAt: string
}

export interface SyncApiClient {
  listClientSkills(): Promise<RemoteSkillSummary[]>
}

export interface StateStore {
  readState(): Promise<DesktopSyncState>
  writeState(state: DesktopSyncState): Promise<void>
  close(): Promise<void>
}

export interface SkillPackageRequest {
  skillId: string
  name: string
  version: string | null
  packageSource: unknown
}

export interface DownloadedSkillArtifact {
  artifactPath: string
  encrypted: boolean
}

export interface PreparedSkillPackage {
  skillId: string
  name: string
  version: string | null
  extractedPath: string
  cleanup(): Promise<void>
}

export interface SkillPackageValidationResult {
  skillId: string
  name: string
  version: string | null
  artifactPath: string
  extractedPath: string
}

export interface SkillDistributionRequest {
  skillId: string
  name: string
  version: string | null
  packageSource: unknown
  enabledAgentIds: string[]
}

export interface SkillDistributionTargetResult {
  agentId: string
  success: boolean
  errorMessage: string | null
}

export interface SkillDistributionResult {
  skillId: string
  name: string
  version: string | null
  extractedPath: string | null
  targets: SkillDistributionTargetResult[]
  succeededAgentIds: string[]
  failedAgentIds: string[]
  syncedToLocalState: boolean
}
