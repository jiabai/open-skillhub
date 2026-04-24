import type {
  DesktopSyncState,
  RemoteSkillSummary,
  StateStore,
  SyncApiClient,
  SyncRefreshResult
} from "@/types"
import { compareRemoteSkills } from "@/core/sync/compare"

export interface SyncServiceDependencies {
  apiClient: SyncApiClient
  stateStore: StateStore
  now?: () => string
}

export interface SyncService {
  refresh(): Promise<SyncRefreshResult>
  readState(): Promise<DesktopSyncState>
}

export interface SyncTrayLike {
  setToolTip(tooltip: string): void
}

export interface SyncNotificationLike {
  show(): void
}

export interface SyncNotificationFactory {
  (options: { title: string; body: string }): SyncNotificationLike
}

export interface SyncPollingControllerDependencies {
  syncService: Pick<SyncService, "refresh">
  tray: SyncTrayLike
  createNotification: SyncNotificationFactory
  pollIntervalMs: number
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
  onError?: (error: unknown) => void
}

export interface SyncPollingController {
  start(): Promise<void>
  refreshNow(): Promise<SyncRefreshResult>
  stop(): void
}

function buildTrayTooltip(pendingCount: number): string {
  if (pendingCount > 0) {
    return `SkillHub Desktop - ${pendingCount} pending review update${pendingCount === 1 ? "" : "s"}`
  }

  return "SkillHub Desktop - no pending review updates"
}

function buildReviewNotification(pendingCount: number): { title: string; body: string } {
  return {
    title: "New skills are ready for review",
    body: `${pendingCount} pending update${pendingCount === 1 ? "" : "s"} are waiting in the tray.`
  }
}

export function createSyncService(dependencies: SyncServiceDependencies): SyncService {
  const now = dependencies.now ?? (() => new Date().toISOString())

  return {
    async readState(): Promise<DesktopSyncState> {
      return dependencies.stateStore.readState()
    },
    async refresh(): Promise<SyncRefreshResult> {
      const remoteSkills: RemoteSkillSummary[] = await dependencies.apiClient.listClientSkills()
      const currentState = await dependencies.stateStore.readState()
      const comparedAt = now()
      const comparison = compareRemoteSkills(remoteSkills, currentState.localRecords, comparedAt)
      const nextState: DesktopSyncState = {
        localRecords: comparison.localRecords,
        pendingUpdates: comparison.pendingUpdates,
        successfulDistributionCount: currentState.successfulDistributionCount,
        lastRefreshedAt: comparedAt
      }

      await dependencies.stateStore.writeState(nextState)

      return {
        ...comparison,
        lastRefreshedAt: comparedAt
      }
    }
  }
}

export function createSyncPollingController(
  dependencies: SyncPollingControllerDependencies
): SyncPollingController {
  if (!Number.isFinite(dependencies.pollIntervalMs) || dependencies.pollIntervalMs <= 0) {
    throw new Error("pollIntervalMs must be a positive number")
  }

  const setIntervalImpl = dependencies.setIntervalFn ?? setInterval
  const clearIntervalImpl = dependencies.clearIntervalFn ?? clearInterval
  let intervalHandle: ReturnType<typeof setIntervalImpl> | null = null
  let lastPendingCount: number | null = null

  async function refreshNow(): Promise<SyncRefreshResult> {
    const result = await dependencies.syncService.refresh()
    const pendingCount = result.pendingUpdates.length

    dependencies.tray.setToolTip(buildTrayTooltip(pendingCount))

    if (pendingCount > 0 && (lastPendingCount === 0 || lastPendingCount === null)) {
      dependencies.createNotification(buildReviewNotification(pendingCount)).show()
    }

    lastPendingCount = pendingCount
    return result
  }

  function stop(): void {
    if (intervalHandle !== null) {
      clearIntervalImpl(intervalHandle)
      intervalHandle = null
    }
  }

  async function start(): Promise<void> {
    if (intervalHandle === null) {
      intervalHandle = setIntervalImpl(() => {
        void refreshNow().catch((error: unknown) => {
          dependencies.onError?.(error)
        })
      }, dependencies.pollIntervalMs)
    }

    await refreshNow()
  }

  return {
    start,
    refreshNow,
    stop
  }
}
