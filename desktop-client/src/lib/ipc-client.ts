import type {
  AppLocale,
  AppTheme,
  AgentDetectionSnapshot,
  AgentPathsConfig,
  ConfigurationPayload,
  ConfigurationState,
  ConnectionTestResult,
  DesktopSyncState,
  LocalSkillUploadResult,
  LocalSkillsInventorySnapshot,
  PreDistributionCheckSnapshot,
  DirectorySelectionResult,
  ProjectAddPayload,
  ProjectImportSkillPayload,
  ProjectListSnapshot,
  ProjectOpenFolderPayload,
  ProjectRemovePayload,
  ProjectRenamePayload,
  ProjectScanPayload,
  ProjectSkillFolderValidation,
  ProjectSkillImportResult,
  ProjectSkillScanSnapshot,
  ProjectValidateSkillFolderPayload,
  SkillDistributionResult
} from "@/types"

export interface DesktopClientBridge {
  getConfiguration(): Promise<ConfigurationState>
  saveConfiguration(payload: ConfigurationPayload): Promise<ConfigurationState>
  saveLocale(locale: AppLocale): Promise<ConfigurationState>
  saveTheme(theme: AppTheme): Promise<ConfigurationState>
  clearConfiguration(): Promise<ConfigurationState>
  testConnection(payload: ConfigurationPayload): Promise<ConnectionTestResult>
  getAgentPathsConfig(): Promise<AgentPathsConfig>
  saveAgentPathsConfig(config: AgentPathsConfig): Promise<AgentPathsConfig>
  openAgentPathsConfigDir(): Promise<void>
  refreshSync(): Promise<DesktopSyncState>
  refreshAgentDetection(): Promise<AgentDetectionSnapshot>
  refreshPreDistributionCheck(): Promise<PreDistributionCheckSnapshot>
  refreshLocalSkills(): Promise<LocalSkillsInventorySnapshot>
  uploadLocalSkill(rowKey: string): Promise<LocalSkillUploadResult>
  listProjects(): Promise<ProjectListSnapshot>
  addProject(payload: ProjectAddPayload): Promise<ProjectListSnapshot>
  renameProject(payload: ProjectRenamePayload): Promise<ProjectListSnapshot>
  removeProject(payload: ProjectRemovePayload): Promise<ProjectListSnapshot>
  selectProjectFolder(): Promise<DirectorySelectionResult>
  openProjectFolder(payload: ProjectOpenFolderPayload): Promise<void>
  scanProjectSkills(payload: ProjectScanPayload): Promise<ProjectSkillScanSnapshot>
  selectProjectSkillFolder(): Promise<DirectorySelectionResult>
  validateProjectSkillFolder(
    payload: ProjectValidateSkillFolderPayload
  ): Promise<ProjectSkillFolderValidation>
  importProjectSkill(payload: ProjectImportSkillPayload): Promise<ProjectSkillImportResult>
  reconcileInstalledSkill(pendingUpdateId: string): Promise<DesktopSyncState>
  distributePendingUpdate(pendingUpdateId: string): Promise<SkillDistributionResult>
}

declare global {
  interface Window {
    desktopClient?: DesktopClientBridge
  }
}

function getDesktopClientBridge(): DesktopClientBridge | null {
  if (typeof window === "undefined") {
    return null
  }

  return window.desktopClient ?? null
}

export function isDesktopClientAvailable(): boolean {
  return getDesktopClientBridge() !== null
}

function invokeGetConfiguration(): Promise<ConfigurationState> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.getConfiguration()
}

function invokeSaveConfiguration(payload: ConfigurationPayload): Promise<ConfigurationState> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.saveConfiguration(payload)
}

function invokeSaveLocale(locale: AppLocale): Promise<ConfigurationState> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.saveLocale(locale)
}

function invokeSaveTheme(theme: AppTheme): Promise<ConfigurationState> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.saveTheme(theme)
}

function invokeClearConfiguration(): Promise<ConfigurationState> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.clearConfiguration()
}

function invokeTestConnection(payload: ConfigurationPayload): Promise<ConnectionTestResult> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.testConnection(payload)
}

function invokeGetAgentPathsConfig(): Promise<AgentPathsConfig> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.getAgentPathsConfig()
}

function invokeSaveAgentPathsConfig(config: AgentPathsConfig): Promise<AgentPathsConfig> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.saveAgentPathsConfig(config)
}

function invokeOpenAgentPathsConfigDir(): Promise<void> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.openAgentPathsConfigDir()
}

function invokeRefreshSync(): Promise<DesktopSyncState> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.refreshSync()
}

function invokeRefreshAgentDetection(): Promise<AgentDetectionSnapshot> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.refreshAgentDetection()
}

function invokeRefreshPreDistributionCheck(): Promise<PreDistributionCheckSnapshot> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.refreshPreDistributionCheck()
}

function invokeRefreshLocalSkills(): Promise<LocalSkillsInventorySnapshot> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.refreshLocalSkills()
}

function invokeUploadLocalSkill(rowKey: string): Promise<LocalSkillUploadResult> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.uploadLocalSkill(rowKey)
}

function invokeListProjects(): Promise<ProjectListSnapshot> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.listProjects()
}

function invokeAddProject(payload: ProjectAddPayload): Promise<ProjectListSnapshot> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.addProject(payload)
}

function invokeRenameProject(payload: ProjectRenamePayload): Promise<ProjectListSnapshot> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.renameProject(payload)
}

function invokeRemoveProject(payload: ProjectRemovePayload): Promise<ProjectListSnapshot> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.removeProject(payload)
}

function invokeSelectProjectFolder(): Promise<DirectorySelectionResult> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.selectProjectFolder()
}

function invokeOpenProjectFolder(payload: ProjectOpenFolderPayload): Promise<void> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.openProjectFolder(payload)
}

function invokeScanProjectSkills(payload: ProjectScanPayload): Promise<ProjectSkillScanSnapshot> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.scanProjectSkills(payload)
}

function invokeSelectProjectSkillFolder(): Promise<DirectorySelectionResult> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.selectProjectSkillFolder()
}

function invokeValidateProjectSkillFolder(
  payload: ProjectValidateSkillFolderPayload
): Promise<ProjectSkillFolderValidation> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.validateProjectSkillFolder(payload)
}

function invokeImportProjectSkill(
  payload: ProjectImportSkillPayload
): Promise<ProjectSkillImportResult> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.importProjectSkill(payload)
}

function invokeReconcileInstalledSkill(pendingUpdateId: string): Promise<DesktopSyncState> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.reconcileInstalledSkill(pendingUpdateId)
}

function invokeDistributePendingUpdate(
  pendingUpdateId: string
): Promise<SkillDistributionResult> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.distributePendingUpdate(pendingUpdateId)
}

export const desktopClient = {
  isAvailable: isDesktopClientAvailable,
  getConfiguration: invokeGetConfiguration,
  saveConfiguration: invokeSaveConfiguration,
  saveLocale: invokeSaveLocale,
  saveTheme: invokeSaveTheme,
  clearConfiguration: invokeClearConfiguration,
  testConnection: invokeTestConnection,
  getAgentPathsConfig: invokeGetAgentPathsConfig,
  saveAgentPathsConfig: invokeSaveAgentPathsConfig,
  openAgentPathsConfigDir: invokeOpenAgentPathsConfigDir,
  refreshSync: invokeRefreshSync,
  refreshAgentDetection: invokeRefreshAgentDetection,
  refreshPreDistributionCheck: invokeRefreshPreDistributionCheck,
  refreshLocalSkills: invokeRefreshLocalSkills,
  uploadLocalSkill: invokeUploadLocalSkill,
  listProjects: invokeListProjects,
  addProject: invokeAddProject,
  renameProject: invokeRenameProject,
  removeProject: invokeRemoveProject,
  selectProjectFolder: invokeSelectProjectFolder,
  openProjectFolder: invokeOpenProjectFolder,
  scanProjectSkills: invokeScanProjectSkills,
  selectProjectSkillFolder: invokeSelectProjectSkillFolder,
  validateProjectSkillFolder: invokeValidateProjectSkillFolder,
  importProjectSkill: invokeImportProjectSkill,
  reconcileInstalledSkill: invokeReconcileInstalledSkill,
  distributePendingUpdate: invokeDistributePendingUpdate
} as const
