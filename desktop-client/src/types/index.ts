export type ApiTokenSource = "secret-store" | "environment" | "missing"

export type AppLocale = "en-US" | "zh-CN"

export type AgentId =
  | "claude-code"
  | "cursor"
  | "windsurf"
  | "copilot"
  | "roocode"
  | "cline"
  | "gemini-cli"
  | "codex"
  | "opencode"
  | "kilocode"
  | "amp"
  | "kiro"
  | "warp"
  | "trae"
  | "factory"
  | "kimi"
  | "mistral"
  | "pi"
  | "antigravity"
  | "openclaw"

export type AgentInstallSource = "auto-detected" | "environment" | "missing"

export interface AgentInstallStatus {
  agentId: AgentId
  displayName: string
  installed: boolean
  source: AgentInstallSource
  detectionDirs: string[]
  targetPaths: string[]
  compatibleReadPaths: string[]
  reason: string | null
}

export interface AgentSkillTarget {
  targetId: string
  targetPath: string
  primaryAgentId: AgentId
  coveredAgentIds: AgentId[]
  sharedPathKey: string | null
  source: AgentInstallSource
}

export interface AgentDetectionSnapshot {
  checkedAt: string
  supportedAgentCount: number
  installedAgentIds: AgentId[]
  agentStatuses: AgentInstallStatus[]
  uniqueTargets: AgentSkillTarget[]
}

export type SkillDistributionTargetStatus =
  | "success"
  | "covered-by-shared-path"
  | "skipped-agent-not-installed"
  | "skipped-same-version"
  | "failed"

export type SkillDistributionWriteMode = "write" | "skip-same-version"

export interface SkillDistributionTarget extends AgentSkillTarget {
  writeMode?: SkillDistributionWriteMode
  adapterAgentId?: string
}

export interface ConfigurationState {
  apiBaseUrl: string
  locale: AppLocale
  hasToken: boolean
  tokenSource: ApiTokenSource
  persistedEnvironmentToken: boolean
  secretStoreAvailable: boolean
  warning?: string
}

export interface ConfigurationPayload {
  apiBaseUrl: string
  apiToken: string
}

export interface ConnectionTestResult {
  ok: boolean
  status?: number
  message: string
}

export interface RemoteSkillSummary {
  id: string
  name: string
  version: string | null
  updatedAt: string
}

export type LocalSkillValidationState =
  | "valid"
  | "missing-skill-md"
  | "invalid-skill-name"
  | "unreadable"
  | "not-directory"

export type LocalSkillServerLookupStatus =
  | "ok"
  | "configuration-missing"
  | "auth-failed"
  | "network-error"
  | "error"

export type LocalSkillServerState = "existing" | "missing" | "unknown" | "invalid-local"

export interface LocalSkillInventoryRow {
  rowKey: string
  name: string | null
  localVersion: string | null
  packageRootPath: string
  sourceAgents: AgentId[]
  sourceDisplayNames: string[]
  validationState: LocalSkillValidationState
  validationMessage: string | null
  serverState: LocalSkillServerState
  remoteSkillId: string | null
  remoteVersion: string | null
  uploadable: boolean
}

export interface LocalSkillsInventorySnapshot {
  checkedAt: string
  rows: LocalSkillInventoryRow[]
  serverLookupStatus: LocalSkillServerLookupStatus
  serverLookupMessage: string | null
}

export interface LocalSkillUploadResult {
  rowKey: string
  uploadedSkillId: string | null
  name: string
  version: string | null
  refreshedSnapshot: LocalSkillsInventorySnapshot
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
  successfulDistributionCount: number
  lastRefreshedAt: string | null
}

export type InstalledSkillVersionSource =
  | "skill-frontmatter"
  | "manifest-json"
  | "nested-manifest-json"
  | null

export interface InstalledSkillMetadataV1 {
  exists: boolean
  skillDir: string
  version: string | null
  versionSource: InstalledSkillVersionSource
}

export type PreDistributionVersionFormat = "semver" | "unknown"

export type PreDistributionVersionComparison =
  | "not-installed"
  | "installed-older"
  | "same"
  | "installed-newer"
  | "unknown"
  | "error"

export interface AgentPreDistributionCheckResult {
  agentId: AgentId
  displayName: string
  skillDir: string | null
  exists: boolean
  installedVersion: string | null
  installedVersionSource: InstalledSkillVersionSource
  remoteVersion: string
  installedVersionFormat: PreDistributionVersionFormat
  remoteVersionFormat: PreDistributionVersionFormat
  versionComparison: PreDistributionVersionComparison
  checkedAt: string
  durationMs: number
  errorCode: string | null
  errorMessage: string | null
}

export type PreDistributionCheckResults = Record<
  string,
  Partial<Record<AgentId, AgentPreDistributionCheckResult>>
>

export interface PreDistributionCheckSnapshot {
  results: PreDistributionCheckResults
  checkedAt: string
  expiresAt: string
  pendingUpdateFingerprint: string
  targetAgentIds: AgentId[]
  totalDurationMs: number
  globalErrors: string[]
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
  cleanupPaths?: string[]
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
  targets: SkillDistributionTarget[]
}

export interface SkillDistributionTargetResult {
  agentId: string
  targetPath: string
  status: SkillDistributionTargetStatus
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
