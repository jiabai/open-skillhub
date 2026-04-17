import type { DesktopSyncState, SkillDistributionResult } from "@/types"

export interface DesktopClientBridge {
  refreshSync(): Promise<DesktopSyncState>
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

function invokeRefreshSync(): Promise<DesktopSyncState> {
  const bridge = getDesktopClientBridge()

  if (!bridge) {
    throw new Error("Desktop client bridge is unavailable")
  }

  return bridge.refreshSync()
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
  refreshSync: invokeRefreshSync,
  distributePendingUpdate: invokeDistributePendingUpdate
} as const
