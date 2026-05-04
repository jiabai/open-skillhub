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
  reconcileInstalledSkill: invokeReconcileInstalledSkill,
  distributePendingUpdate: invokeDistributePendingUpdate
} as const
