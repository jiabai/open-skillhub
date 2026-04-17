import { useEffect, useMemo, useState } from "react"

import { ActivityPanel } from "@/components/activity-panel"
import { AgentsPanel } from "@/components/agents-panel"
import { NavShell } from "@/components/nav-shell"
import { OverviewPanel } from "@/components/overview-panel"
import { PendingUpdatesPanel } from "@/components/pending-updates-panel"
import { SettingsPanel } from "@/components/settings-panel"
import { desktopClient } from "@/lib/ipc-client"
import type { DesktopSyncState, PendingSyncUpdate, SkillDistributionResult } from "@/types"

type ActivityEntry = {
  id: string
  title: string
  detail: string
  timestamp: string
  tone: "neutral" | "success" | "warning"
}

const initialState: DesktopSyncState = {
  localRecords: [],
  pendingUpdates: [],
  lastRefreshedAt: null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function createDistributionDetail(result: SkillDistributionResult): string {
  if (result.failedAgentIds.length === 0) {
    return `${result.name} was sent to ${result.succeededAgentIds.length} configured agent target${
      result.succeededAgentIds.length === 1 ? "" : "s"
    }.`
  }

  return `${result.name} reached ${result.succeededAgentIds.length} agent target${
    result.succeededAgentIds.length === 1 ? "" : "s"
  }, but failed on ${result.failedAgentIds.join(", ")}.`
}

function formatLongTimestamp(value: string | null): string {
  if (!value) {
    return "Not refreshed yet"
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}

function createActivityEntry(
  title: string,
  detail: string,
  tone: ActivityEntry["tone"]
): ActivityEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    detail,
    tone,
    timestamp: new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date())
  }
}

export function App() {
  const [syncState, setSyncState] = useState<DesktopSyncState>(initialState)
  const [activity, setActivity] = useState<ActivityEntry[]>([
    createActivityEntry(
      "Console ready",
      "Pending updates will stay visible until an operator distributes them.",
      "neutral"
    )
  ])
  const [isLoading, setIsLoading] = useState(true)
  const [busyUpdateId, setBusyUpdateId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const bridgeAvailable = desktopClient.isAvailable()

  const bridgeStatus = useMemo(() => {
    if (!bridgeAvailable) {
      return "Desktop bridge unavailable"
    }

    if (errorMessage) {
      return `Desktop bridge error: ${errorMessage}`
    }

    if (isLoading) {
      return "Desktop bridge connected, loading review state"
    }

    const pendingUpdateCount = syncState.pendingUpdates.length
    return `Desktop bridge connected, ${pendingUpdateCount} pending update${
      pendingUpdateCount === 1 ? "" : "s"
    }`
  }, [bridgeAvailable, errorMessage, isLoading, syncState.pendingUpdates.length])

  useEffect(() => {
    let active = true

    if (!bridgeAvailable) {
      setIsLoading(false)
      return
    }

    void desktopClient
      .refreshSync()
      .then((state) => {
        if (!active) {
          return
        }

        setSyncState(state)
        setErrorMessage(null)
        setIsLoading(false)
        setActivity((current) =>
          [
            createActivityEntry(
              "Review snapshot loaded",
              `${state.pendingUpdates.length} pending update${
                state.pendingUpdates.length === 1 ? "" : "s"
              } are ready for review.`,
              "neutral"
            ),
            ...current
          ].slice(0, 5)
        )
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }

        const message = getErrorMessage(error)
        setErrorMessage(message)
        setIsLoading(false)
        setActivity((current) =>
          [createActivityEntry("Refresh failed", message, "warning"), ...current].slice(0, 5)
        )
      })

    return () => {
      active = false
    }
  }, [bridgeAvailable])

  const handleRefresh = async () => {
    if (!bridgeAvailable) {
      return
    }

    setIsLoading(true)

    try {
      const state = await desktopClient.refreshSync()
      setSyncState(state)
      setErrorMessage(null)
      setActivity((current) =>
        [
          createActivityEntry(
            "Review snapshot refreshed",
            `${state.pendingUpdates.length} pending update${
              state.pendingUpdates.length === 1 ? "" : "s"
            } are visible again.`,
            "neutral"
          ),
          ...current
        ].slice(0, 5)
      )
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setErrorMessage(message)
      setActivity((current) =>
        [createActivityEntry("Refresh failed", message, "warning"), ...current].slice(0, 5)
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDistribute = async (pendingUpdate: PendingSyncUpdate) => {
    if (!bridgeAvailable) {
      return
    }

    setBusyUpdateId(pendingUpdate.remoteSkillId)

    try {
      const distributionResult = await desktopClient.distributePendingUpdate(
        pendingUpdate.remoteSkillId
      )
      try {
        const refreshedState = await desktopClient.refreshSync()
        setSyncState(refreshedState)
        setErrorMessage(null)
        setActivity((current) =>
          [
            createActivityEntry(
              distributionResult.failedAgentIds.length === 0
                ? "Distribution completed"
                : "Distribution completed with warnings",
              createDistributionDetail(distributionResult),
              distributionResult.failedAgentIds.length === 0 ? "success" : "warning"
            ),
            ...current
          ].slice(0, 5)
        )
      } catch (error: unknown) {
        const message = getErrorMessage(error)
        setErrorMessage(message)
        setActivity((current) =>
          [
            createActivityEntry(
              "Distribution completed with refresh warning",
              `${createDistributionDetail(distributionResult)} Refreshing the review snapshot then failed: ${message}`,
              "warning"
            ),
            ...current
          ].slice(0, 5)
        )
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setErrorMessage(message)
      setActivity((current) =>
        [
          createActivityEntry(
            "Distribution failed",
            `${pendingUpdate.name} could not be distributed: ${message}`,
            "warning"
          ),
          ...current
        ].slice(0, 5)
      )
    } finally {
      setBusyUpdateId(null)
    }
  }

  return (
    <NavShell bridgeStatus={bridgeStatus} onRefresh={handleRefresh} isRefreshing={isLoading}>
      <section
        style={{
          display: "grid",
          gap: "1rem"
        }}
      >
        <OverviewPanel
          isLoading={isLoading}
          lastRefreshedAt={formatLongTimestamp(syncState.lastRefreshedAt)}
          localRecordCount={syncState.localRecords.length}
          pendingUpdateCount={syncState.pendingUpdates.length}
          errorMessage={errorMessage}
        />

        <PendingUpdatesPanel
          isLoading={isLoading}
          pendingUpdates={syncState.pendingUpdates}
          busyUpdateId={busyUpdateId}
          onDistribute={handleDistribute}
        />

        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
          }}
        >
          <AgentsPanel />
          <SettingsPanel bridgeStatus={bridgeStatus} lastRefreshedAt={formatLongTimestamp(syncState.lastRefreshedAt)} />
        </div>

        <ActivityPanel entries={activity} />
      </section>
    </NavShell>
  )
}
