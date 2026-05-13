export type ApiTokenSource = "secret-store" | "environment" | "missing"

export type AppLocale = "en-US" | "zh-CN"

export type AppTheme = "light" | "dark"

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
  | "codebuddy"
  | "workbuddy"

export type AgentInstallSource = "auto-detected" | "missing"

export interface AgentPathConfigEntry {
  targetPath: string
}

export type AgentPathsConfig = Partial<Record<AgentId, AgentPathConfigEntry>>

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
  | "skipped-installed-content"
  | "failed"

export type SkillDistributionWriteMode = "write" | "skip-installed-content"

export interface SkillDistributionTarget extends AgentSkillTarget {
  writeMode?: SkillDistributionWriteMode
  adapterAgentId?: string
}

export interface ConfigurationState {
  apiBaseUrl: string
  locale: AppLocale
  theme: AppTheme
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
  contentHash: string | null
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

export interface LocalSkillDeletePayload {
  rowKey: string
}

export interface LocalSkillOpenFolderPayload {
  rowKey: string
}

export interface ProjectEntry {
  id: string
  name: string
  path: string
  addedAt: string
  updatedAt: string
}

export interface ProjectListSnapshot {
  checkedAt: string
  projects: ProjectEntry[]
}

export interface ProjectAgentTarget {
  targetId: string
  targetPath: string
  relativePath: string
  primaryAgentId: AgentId
  coveredAgentIds: AgentId[]
  writableAgentIds: AgentId[]
  displayNames: string[]
  sharedPathKey: string | null
  writable: boolean
}

export type ProjectSkillSource = "project" | "global"

export interface ProjectSkillRow {
  rowKey: string
  identity: string | null
  version: string | null
  description: string | null
  source: ProjectSkillSource
  agentIds: AgentId[]
  sourceDisplayNames: string[]
  skillPath: string
  relativePath: string | null
  validationState: LocalSkillValidationState
  validationMessage: string | null
}

export interface ProjectSkillScanSnapshot {
  projectId: string
  checkedAt: string
  project: ProjectEntry
  targets: ProjectAgentTarget[]
  rows: ProjectSkillRow[]
  errors: string[]
}

export interface ProjectSkillFolderValidation {
  valid: boolean
  identity: string | null
  version: string | null
  description: string | null
  sourcePath: string
  validationState: LocalSkillValidationState
  validationMessage: string | null
}

export interface ProjectSkillImportResult {
  projectId: string
  identity: string
  targetPath: string
  overwritten: boolean
}

export interface ProjectAddPayload {
  name: string
  path: string
}

export interface ProjectRenamePayload {
  projectId: string
  name: string
}

export interface ProjectRemovePayload {
  projectId: string
}

export interface ProjectScanPayload {
  projectId: string
}

export interface ProjectOpenFolderPayload {
  projectId: string
}

export interface ProjectValidateSkillFolderPayload {
  sourcePath: string
}

export interface ProjectImportSkillPayload {
  projectId: string
  sourcePath: string
  targetAgentId: AgentId
  overwrite: boolean
}

export interface DirectorySelectionResult {
  canceled: boolean
  path: string | null
}

export interface LocalDistributedSkillRecord {
  remoteSkillId: string
  name: string
  installedVersion: string | null
  installedContentHash: string | null
  remoteVersion: string | null
  remoteContentHash: string | null
  lastComparedAt: string | null
}

export interface PendingSyncUpdate {
  remoteSkillId: string
  name: string
  localVersion: string | null
  localContentHash: string | null
  remoteVersion: string
  remoteContentHash: string | null
  reason: "not-installed" | "update"
}

export interface SyncComparisonItem {
  remoteSkillId: string
  name: string
  localVersion: string | null
  localContentHash: string | null
  remoteVersion: string | null
  remoteContentHash: string | null
  status: "installed" | "not-installed" | "update"
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
  contentHash: string | null
}

export type PreDistributionVersionFormat = "semver" | "unknown"

export type PreDistributionVersionComparison =
  | "not-installed"
  | "installed-older"
  | "same"
  | "installed-newer"
  | "unknown"
  | "error"

export type PreDistributionContentComparison =
  | "not-installed"
  | "installed"
  | "update"
  | "error"

export interface AgentPreDistributionCheckResult {
  agentId: AgentId
  displayName: string
  skillDir: string | null
  exists: boolean
  installedVersion: string | null
  installedVersionSource: InstalledSkillVersionSource
  installedContentHash: string | null
  remoteVersion: string
  remoteContentHash: string | null
  installedVersionFormat: PreDistributionVersionFormat
  remoteVersionFormat: PreDistributionVersionFormat
  contentComparison: PreDistributionContentComparison
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
  contentHash: string | null
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
