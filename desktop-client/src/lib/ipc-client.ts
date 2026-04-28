import type {
  AppLocale,
  AgentDetectionSnapshot,
  ConfigurationPayload,
  ConfigurationState,
  ConnectionTestResult,
  DesktopSyncState,
  PreDistributionCheckSnapshot,
  SkillDistributionResult
} from "@/types"

export interface DesktopClientBridge {
  getConfiguration(): Promise<ConfigurationState>
  saveConfiguration(payload: ConfigurationPayload): Promise<ConfigurationState>
  saveLocale(locale: AppLocale): Promise<ConfigurationState>
  clearConfiguration(): Promise<ConfigurationState>
  testConnection(payload: ConfigurationPayload): Promise<ConnectionTestResult>
  refreshSync(): Promise<DesktopSyncState>
  refreshAgentDetection(): Promise<AgentDetectionSnapshot>
  refreshPreDistributionCheck(): Promise<PreDistributionCheckSnapshot>
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
  clearConfiguration: invokeClearConfiguration,
  testConnection: invokeTestConnection,
  refreshSync: invokeRefreshSync,
  refreshAgentDetection: invokeRefreshAgentDetection,
  refreshPreDistributionCheck: invokeRefreshPreDistributionCheck,
  reconcileInstalledSkill: invokeReconcileInstalledSkill,
  distributePendingUpdate: invokeDistributePendingUpdate
} as const
