import { useEffect, useMemo, useRef, useState } from "react"

import { AppShell, type AppView } from "@/components/app-shell"
import { HomeView } from "@/components/home-view"
import { SettingsDrawer } from "@/components/settings-drawer"
import { UpdatesView } from "@/components/updates-view"
import { formatDateTime } from "@/i18n/format-date"
import { getDictionary } from "@/i18n/get-dictionary"
import { I18nProvider } from "@/i18n/i18n-provider"
import { resolveLocale } from "@/i18n/config"
import { desktopClient } from "@/lib/ipc-client"
import type {
  AppLocale,
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
  successfulDistributionCount: 0,
  lastRefreshedAt: null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
    timestamp: new Date().toISOString()
  }
}

function createDistributionDetail(locale: AppLocale, result: SkillDistributionResult): string {
  const succeededCount = result.succeededAgentIds.length
  const succeededLabel = succeededCount === 1 ? "1 configured agent target" : `${succeededCount} configured agent targets`

  if (locale === "zh-CN") {
    if (result.failedAgentIds.length === 0) {
      return `${result.name} 已发送到 ${succeededCount} 个已配置代理目标。`
    }

    return `${result.name} 已到达 ${succeededCount} 个代理目标，但在 ${result.failedAgentIds.join("、")} 上失败。`
  }

  if (result.failedAgentIds.length === 0) {
    return `${result.name} was sent to ${succeededLabel}.`
  }

  return `${result.name} reached ${succeededCount} agent target${
    succeededCount === 1 ? "" : "s"
  }, but failed on ${result.failedAgentIds.join(", ")}.`
}

function createBridgeUnavailableMessage(locale: AppLocale, action: string): string {
  return getDictionary(locale).common.bridgeUnavailable(action)
}

function formatLongTimestamp(locale: AppLocale, value: string | null, fallback: string): string {
  return formatDateTime(locale, value, {
    dateStyle: "medium",
    timeStyle: "short"
  }, fallback)
}

export function App() {
  const bridgeAvailable = desktopClient.isAvailable()
  const initialLocale = resolveLocale(typeof navigator !== "undefined" ? navigator.language : null)
  const initialDictionary = getDictionary(initialLocale)

  const [syncState, setSyncState] = useState<DesktopSyncState>(initialState)
  const [activity, setActivity] = useState<ActivityEntry[]>([
    createActivityEntry(
      initialDictionary.activity.consoleReadyTitle,
      initialDictionary.activity.consoleReadyDetail,
      "neutral"
    )
  ])
  const [isLoading, setIsLoading] = useState(true)
  const [busyUpdateId, setBusyUpdateId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [configState, setConfigState] = useState<ConfigurationState | null>(null)
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false)
  const [isSavingLocale, setIsSavingLocale] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isClearingConfiguration, setIsClearingConfiguration] = useState(false)
  const [connectionTestResult, setConnectionTestResult] = useState<ConnectionTestResult | null>(
    null
  )
  const [activeView, setActiveView] = useState<AppView>("home")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedLocale, setSelectedLocale] = useState<AppLocale>(initialLocale)
  const hasLocaleOverride = useRef(false)

  const dictionary = useMemo(() => getDictionary(selectedLocale), [selectedLocale])
  const configurationReady = Boolean(configState?.hasToken)

  useEffect(() => {
    document.documentElement.lang = selectedLocale
  }, [selectedLocale])

  const bridgeStatus = useMemo(() => {
    if (!bridgeAvailable) {
      return dictionary.appShell.bridgeStatus.unavailable
    }

    if (isLoading && configState === null) {
      return dictionary.appShell.bridgeStatus.loadingConfiguration
    }

    if (isConfiguring || !configurationReady) {
      return configurationReady
        ? dictionary.appShell.bridgeStatus.editingConfiguration
        : dictionary.appShell.bridgeStatus.tokenRequired
    }

    if (errorMessage) {
      return dictionary.appShell.bridgeStatus.error(errorMessage)
    }

    if (isLoading) {
      return dictionary.appShell.bridgeStatus.loadingReviewState
    }

    const pendingUpdateCount = syncState.pendingUpdates.length
    return dictionary.appShell.bridgeStatus.connectedWithPending(pendingUpdateCount)
  }, [
    bridgeAvailable,
    configState,
    configurationReady,
    dictionary.appShell.bridgeStatus,
    errorMessage,
    isLoading,
    isConfiguring,
    syncState.pendingUpdates.length
  ])

  useEffect(() => {
    let active = true
    let loadedLocale = initialLocale

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
        setSelectedLocale((currentLocale) =>
          hasLocaleOverride.current ? currentLocale : configuration.locale
        )
        loadedLocale = configuration.locale

        const localizedDictionary = getDictionary(loadedLocale)

        if (!configuration.hasToken) {
          setIsConfiguring(true)
          setActiveView("home")
          setErrorMessage(null)
          setIsLoading(false)
          setActivity((current) =>
            [
              createActivityEntry(
                localizedDictionary.activity.apiTokenNeededTitle,
                localizedDictionary.activity.apiTokenNeededDetail,
                "warning"
              ),
              ...current
            ].slice(0, 5)
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
              localizedDictionary.activity.reviewSnapshotLoadedTitle,
              localizedDictionary.activity.reviewSnapshotLoadedDetail(state.pendingUpdates.length),
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
        const localizedDictionary = getDictionary(loadedLocale)
        setErrorMessage(message)
        setIsLoading(false)
        setActivity((current) =>
          [
            createActivityEntry(
              localizedDictionary.activity.refreshFailedTitle,
              localizedDictionary.activity.refreshFailedDetail(message),
              "warning"
            ),
            ...current
          ].slice(0, 5)
        )
      }
    })()

    return () => {
      active = false
    }
  }, [bridgeAvailable, initialLocale])

  const handleRefresh = async () => {
    if (!bridgeAvailable) {
      return
    }

    if (!configurationReady) {
      setIsConfiguring(true)
      setActiveView("home")
      setSettingsOpen(true)
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
            dictionary.activity.reviewSnapshotRefreshedTitle,
            dictionary.activity.reviewSnapshotRefreshedDetail(state.pendingUpdates.length),
            "neutral"
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
            dictionary.activity.refreshFailedTitle,
            dictionary.activity.refreshFailedDetail(message),
            "warning"
          ),
          ...current
        ].slice(0, 5)
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveConfiguration = async (payload: ConfigurationPayload) => {
    if (!bridgeAvailable) {
      const message = createBridgeUnavailableMessage(selectedLocale, dictionary.configPanel.saveAction)
      setConnectionTestResult(null)
      setErrorMessage(message)
      return
    }

    setIsSavingConfiguration(true)
    setErrorMessage(null)
    setConnectionTestResult(null)

    try {
      const nextConfiguration = await desktopClient.saveConfiguration(payload)
      setConfigState(nextConfiguration)
      hasLocaleOverride.current = true
      setSelectedLocale(nextConfiguration.locale)
      setConnectionTestResult(null)
      setIsConfiguring(false)
      setSettingsOpen(false)
      setActiveView("home")

      const localizedDictionary = getDictionary(nextConfiguration.locale)
      setActivity((current) =>
        [
          createActivityEntry(
            localizedDictionary.activity.configurationSavedTitle,
            localizedDictionary.activity.configurationSavedDetail,
            "success"
          ),
          ...current
        ].slice(0, 5)
      )

      if (nextConfiguration.hasToken) {
        setIsLoading(true)
        try {
          const state = await desktopClient.refreshSync()
          setSyncState(state)
          setActivity((current) =>
            [
              createActivityEntry(
                localizedDictionary.activity.reviewSnapshotRefreshedTitle,
                localizedDictionary.activity.reviewSnapshotRefreshedDetail(state.pendingUpdates.length),
                "neutral"
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
                localizedDictionary.activity.refreshFailedTitle,
                localizedDictionary.activity.refreshFailedDetail(message),
                "warning"
              ),
              ...current
            ].slice(0, 5)
          )
        } finally {
          setIsLoading(false)
        }
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setErrorMessage(message)
      setActivity((current) =>
        [
          createActivityEntry(
            dictionary.activity.configurationSaveFailedTitle,
            dictionary.activity.configurationSaveFailedDetail(message),
            "warning"
          ),
          ...current
        ].slice(0, 5)
      )
    } finally {
      setIsSavingConfiguration(false)
    }
  }

  const handleChangeLocale = async (locale: AppLocale) => {
    hasLocaleOverride.current = true
    setSelectedLocale(locale)

    if (!bridgeAvailable) {
      return
    }

    setIsSavingLocale(true)
    setErrorMessage(null)

    try {
      const nextConfiguration = await desktopClient.saveLocale(locale)
      setConfigState(nextConfiguration)
      hasLocaleOverride.current = true
      setSelectedLocale(nextConfiguration.locale)
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setErrorMessage(message)
    } finally {
      setIsSavingLocale(false)
    }
  }

  const handleTestConnection = async (payload: ConfigurationPayload) => {
    if (!bridgeAvailable) {
      setErrorMessage(null)
      setConnectionTestResult({
        ok: false,
        message: createBridgeUnavailableMessage(selectedLocale, dictionary.configPanel.testAction)
      })
      return
    }

    setIsTestingConnection(true)
    setErrorMessage(null)
    setConnectionTestResult(null)

    try {
      const result = await desktopClient.testConnection(payload)
      setConnectionTestResult(result)
      setActivity((current) =>
        [
          createActivityEntry(
            result.ok
              ? dictionary.activity.connectionTestSucceededTitle
              : dictionary.activity.connectionTestFailedTitle,
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
        [
          createActivityEntry(dictionary.activity.connectionTestFailedTitle, message, "warning"),
          ...current
        ].slice(0, 5)
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
      hasLocaleOverride.current = true
      setSelectedLocale(nextConfiguration.locale)
      setSyncState(initialState)
      setConnectionTestResult(null)
      setErrorMessage(null)
      setIsConfiguring(true)
      setActiveView("home")
      setSettingsOpen(true)

      const localizedDictionary = getDictionary(nextConfiguration.locale)
      setActivity((current) =>
        [
          createActivityEntry(
            localizedDictionary.activity.configurationClearedTitle,
            localizedDictionary.activity.configurationClearedDetail,
            "warning"
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
            dictionary.activity.configurationClearFailedTitle,
            dictionary.activity.configurationClearFailedDetail(message),
            "warning"
          ),
          ...current
        ].slice(0, 5)
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
        const detail = createDistributionDetail(selectedLocale, distributionResult)
        setActivity((current) =>
          [
            createActivityEntry(
              distributionResult.failedAgentIds.length === 0
                ? dictionary.activity.distributionCompletedTitle
                : dictionary.activity.distributionCompletedWithWarningsTitle,
              dictionary.activity.distributionCompletedDetail(detail),
              distributionResult.failedAgentIds.length === 0 ? "success" : "warning"
            ),
            ...current
          ].slice(0, 5)
        )
      } catch (error: unknown) {
        const message = getErrorMessage(error)
        setErrorMessage(message)
        const detail = createDistributionDetail(selectedLocale, distributionResult)
        setActivity((current) =>
          [
            createActivityEntry(
              dictionary.activity.distributionCompletedWithRefreshWarningTitle,
              dictionary.activity.distributionCompletedWithRefreshWarningDetail(detail, message),
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
            dictionary.activity.distributionFailedTitle,
            dictionary.activity.distributionFailedDetail(pendingUpdate.name, message),
            "warning"
          ),
          ...current
        ].slice(0, 5)
      )
    } finally {
      setBusyUpdateId(null)
    }
  }

  const formattedLastRefreshedAt = formatLongTimestamp(
    selectedLocale,
    syncState.lastRefreshedAt,
    dictionary.common.notRefreshedYet
  )

  return (
    <I18nProvider locale={selectedLocale} dictionary={dictionary}>
      <AppShell
        activeView={activeView}
        bridgeStatus={bridgeStatus}
        pendingUpdateCount={syncState.pendingUpdates.length}
        isRefreshing={isLoading}
        canRefresh={configurationReady}
        onNavigate={setActiveView}
        onOpenSettings={() => setSettingsOpen(true)}
        onRefresh={handleRefresh}
      >
        {activeView === "home" ? (
          <HomeView
            bridgeAvailable={bridgeAvailable}
            configurationReady={configurationReady}
            errorMessage={errorMessage}
            isLoading={isLoading}
            lastRefreshedAt={formattedLastRefreshedAt}
            successfulDistributionCount={syncState.successfulDistributionCount}
            pendingUpdates={syncState.pendingUpdates}
            busyUpdateId={busyUpdateId}
            onDistribute={handleDistribute}
            onOpenSettings={() => setSettingsOpen(true)}
            onRefresh={handleRefresh}
            onViewUpdates={() => setActiveView("updates")}
          />
        ) : (
          <UpdatesView
            isLoading={isLoading}
            pendingUpdates={syncState.pendingUpdates}
            busyUpdateId={busyUpdateId}
            onDistribute={handleDistribute}
            onRefresh={handleRefresh}
          />
        )}

        <SettingsDrawer
          activity={activity}
          bridgeStatus={bridgeStatus}
          configState={configState}
          connectionTestResult={connectionTestResult}
          errorMessage={errorMessage}
          isClearingConfiguration={isClearingConfiguration}
          isSavingLocale={isSavingLocale}
          isOpen={settingsOpen}
          isSavingConfiguration={isSavingConfiguration}
          isTestingConnection={isTestingConnection}
          lastRefreshedAt={formattedLastRefreshedAt}
          currentLocale={selectedLocale}
          onChangeLocale={handleChangeLocale}
          onClearConfiguration={handleClearConfiguration}
          onClose={() => setSettingsOpen(false)}
          onSaveConfiguration={handleSaveConfiguration}
          onTestConnection={handleTestConnection}
        />
      </AppShell>
    </I18nProvider>
  )
}
