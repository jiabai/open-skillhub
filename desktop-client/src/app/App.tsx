import { useEffect, useMemo, useState } from "react"

import { ActivityPanel } from "@/components/activity-panel"
import { AgentsPanel } from "@/components/agents-panel"
import { ConfigPanel } from "@/components/config-panel"
import { NavShell } from "@/components/nav-shell"
import { OverviewPanel } from "@/components/overview-panel"
import { PendingUpdatesPanel } from "@/components/pending-updates-panel"
import { SettingsPanel } from "@/components/settings-panel"
import { desktopClient } from "@/lib/ipc-client"
import type {
  ConfigurationPayload,
  ConfigurationState,
  ConnectionTestResult,
  DesktopSyncState,
  PendingSyncUpdate,
  SkillDistributionResult
} from "@/types"

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
  const [configState, setConfigState] = useState<ConfigurationState | null>(null)
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isClearingConfiguration, setIsClearingConfiguration] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState<ConnectionTestResult | null>(
    null
  )

  const bridgeAvailable = desktopClient.isAvailable()
  const configurationReady = Boolean(configState?.hasToken)
  const showConfiguration = configState !== null && (isConfiguring || !configurationReady)

  const bridgeStatus = useMemo(() => {
    if (!bridgeAvailable) {
      return "Desktop bridge unavailable"
    }

    if (isLoading && configState === null) {
      return "Desktop bridge connected, loading configuration"
    }

    if (showConfiguration) {
      return configurationReady
        ? "Desktop bridge connected, editing API configuration"
        : "Desktop bridge connected, API token required"
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
  }, [
    bridgeAvailable,
    configState,
    configurationReady,
    errorMessage,
    isLoading,
    showConfiguration,
    syncState.pendingUpdates.length
  ])

  useEffect(() => {
    let active = true

    if (!bridgeAvailable) {
      setIsLoading(false)
      return
    }

    void (async () => {
      try {
        const configuration = await desktopClient.getConfiguration()

        if (!active) {
          return
        }

        setConfigState(configuration)

        if (!configuration.hasToken) {
          setIsConfiguring(true)
          setErrorMessage(null)
          setIsLoading(false)
          setActivity((current) =>
            [createActivityEntry("API token needed", "Review sync is paused until configuration is saved.", "warning"), ...current].slice(0, 5)
          )
          return
        }

        const state = await desktopClient.refreshSync()

        if (!active) {
          return
        }

        setIsConfiguring(false)
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
      } catch (error: unknown) {
        if (!active) {
          return
        }

        const message = getErrorMessage(error)
        setErrorMessage(message)
        setIsLoading(false)
        setActivity((current) =>
          [createActivityEntry("Refresh failed", message, "warning"), ...current].slice(0, 5)
        )
      }
    })()

    return () => {
      active = false
    }
  }, [bridgeAvailable])

  const handleRefresh = async () => {
    if (!bridgeAvailable) {
      return
    }

    if (!configurationReady) {
      setIsConfiguring(true)
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

  const handleSaveConfiguration = async (payload: ConfigurationPayload) => {
    if (!bridgeAvailable) {
      return
    }

    setIsSavingConfiguration(true)
    setErrorMessage(null)

    try {
      const nextConfiguration = await desktopClient.saveConfiguration(payload)
      setConfigState(nextConfiguration)
      setConnectionTestResult(null)
      setIsConfiguring(false)
      setActivity((current) =>
        [createActivityEntry("Configuration saved", "Runtime sync is using the latest API settings.", "success"), ...current].slice(0, 5)
      )

      if (nextConfiguration.hasToken) {
        setIsLoading(true)
        try {
          const state = await desktopClient.refreshSync()
          setSyncState(state)
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
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setErrorMessage(message)
      setActivity((current) =>
        [createActivityEntry("Configuration save failed", message, "warning"), ...current].slice(0, 5)
      )
    } finally {
      setIsSavingConfiguration(false)
    }
  }

  const handleTestConnection = async (payload: ConfigurationPayload) => {
    if (!bridgeAvailable) {
      return
    }

    setIsTestingConnection(true)
    setConnectionTestResult(null)

    try {
      const result = await desktopClient.testConnection(payload)
      setConnectionTestResult(result)
      setActivity((current) =>
        [
          createActivityEntry(
            result.ok ? "Connection test succeeded" : "Connection test failed",
            result.message,
            result.ok ? "success" : "warning"
          ),
          ...current
        ].slice(0, 5)
      )
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setConnectionTestResult({
        ok: false,
        message
      })
      setActivity((current) =>
        [createActivityEntry("Connection test failed", message, "warning"), ...current].slice(0, 5)
      )
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleClearConfiguration = async () => {
    if (!bridgeAvailable) {
      return
    }

    setIsClearingConfiguration(true)

    try {
      const nextConfiguration = await desktopClient.clearConfiguration()
      setConfigState(nextConfiguration)
      setSyncState(initialState)
      setConnectionTestResult(null)
      setErrorMessage(null)
      setIsConfiguring(true)
      setActivity((current) =>
        [createActivityEntry("Configuration cleared", "Review sync has been paused.", "warning"), ...current].slice(0, 5)
      )
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setErrorMessage(message)
      setActivity((current) =>
        [createActivityEntry("Configuration clear failed", message, "warning"), ...current].slice(0, 5)
      )
    } finally {
      setIsClearingConfiguration(false)
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
    <NavShell
      bridgeStatus={bridgeStatus}
      onRefresh={handleRefresh}
      isRefreshing={isLoading}
      canRefresh={!showConfiguration && configurationReady}
      activeSection={showConfiguration ? "configuration" : "pending"}
    >
      <section
        style={{
          display: "grid",
          gap: "1rem"
        }}
      >
        {showConfiguration ? (
          <>
            <ConfigPanel
              configState={configState}
              errorMessage={errorMessage}
              testResult={connectionTestResult}
              isSaving={isSavingConfiguration}
              isTesting={isTestingConnection}
              onSave={handleSaveConfiguration}
              onTest={handleTestConnection}
            />
            <ActivityPanel entries={activity} />
          </>
        ) : (
          <>
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
              <SettingsPanel
                bridgeStatus={bridgeStatus}
                lastRefreshedAt={formatLongTimestamp(syncState.lastRefreshedAt)}
                configState={configState}
                isClearingConfiguration={isClearingConfiguration}
                onEditConfiguration={() => setIsConfiguring(true)}
                onClearConfiguration={handleClearConfiguration}
              />
            </div>

            <ActivityPanel entries={activity} />
          </>
        )}
      </section>
    </NavShell>
  )
}
