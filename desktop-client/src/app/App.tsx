import { useEffect, useMemo, useRef, useState } from "react"

import { AppShell, type AppView } from "@/components/app-shell"
import { HomeView } from "@/components/home-view"
import { LocalSkillsView } from "@/components/local-skills-view"
import { SettingsDrawer } from "@/components/settings-drawer"
import { UpdatesView } from "@/components/updates-view"
import { Button, Dialog } from "@/components/ui-primitives"
import { formatDateTime } from "@/i18n/format-date"
import { getDictionary } from "@/i18n/get-dictionary"
import { I18nProvider } from "@/i18n/i18n-provider"
import { resolveLocale } from "@/i18n/config"
import { desktopClient } from "@/lib/ipc-client"
import type {
  AppLocale,
  AgentDetectionSnapshot,
  AgentId,
  ConfigurationPayload,
  ConfigurationState,
  ConnectionTestResult,
  DesktopSyncState,
  LocalSkillInventoryRow,
  LocalSkillsInventorySnapshot,
  PendingSyncUpdate,
  PreDistributionCheckSnapshot,
  SkillDistributionResult
} from "@/types"

type ActivityEntry = {
  id: string
  title: string
  detail: string
  timestamp: string
  tone: "neutral" | "success" | "warning"
}

type DistributionConfirmationSummary = {
  writeTargets: string[]
  skippedTargets: string[]
  missingAgents: string[]
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

function createPendingUpdateFingerprint(pendingUpdates: PendingSyncUpdate[]): string {
  return pendingUpdates
    .map((update) => `${update.remoteSkillId}@${update.remoteVersion}`)
    .sort()
    .join("|")
}

function getAgentDisplayName(snapshot: AgentDetectionSnapshot, agentId: AgentId): string {
  return (
    snapshot.agentStatuses.find((status) => status.agentId === agentId)?.displayName ?? agentId
  )
}

function createDistributionTargetLabel(
  snapshot: AgentDetectionSnapshot,
  coveredAgentIds: AgentId[],
  targetPath: string
): string {
  const names = coveredAgentIds.map((agentId) => getAgentDisplayName(snapshot, agentId)).join(", ")

  return `${names} (${targetPath})`
}

function createDistributionConfirmationSummary(
  pendingUpdate: PendingSyncUpdate,
  detectionSnapshot: AgentDetectionSnapshot | null,
  preDistributionCheckSnapshot: PreDistributionCheckSnapshot | null,
  isPreDistributionCheckStale: boolean
): DistributionConfirmationSummary {
  if (!detectionSnapshot) {
    return {
      writeTargets: [],
      skippedTargets: [],
      missingAgents: []
    }
  }

  const resultsByAgent =
    preDistributionCheckSnapshot && !isPreDistributionCheckStale
      ? preDistributionCheckSnapshot.results[pendingUpdate.remoteSkillId] ?? {}
      : {}

  const writeTargets: string[] = []
  const skippedTargets: string[] = []

  for (const target of detectionSnapshot.uniqueTargets) {
    const targetLabel = createDistributionTargetLabel(
      detectionSnapshot,
      target.coveredAgentIds,
      target.targetPath
    )
    const everyCoveredAgentIsSame =
      target.coveredAgentIds.length > 0 &&
      target.coveredAgentIds.every(
        (agentId) => resultsByAgent[agentId]?.versionComparison === "same"
      )

    if (everyCoveredAgentIsSame) {
      skippedTargets.push(targetLabel)
    } else {
      writeTargets.push(targetLabel)
    }
  }

  return {
    writeTargets,
    skippedTargets,
    missingAgents: detectionSnapshot.agentStatuses
      .filter((status) => !status.installed)
      .map((status) => status.displayName)
  }
}

function renderDialogList(items: string[], fallback: string) {
  if (items.length === 0) {
    return <p className="card__description">{fallback}</p>
  }

  return (
    <ul className="dialog-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function App() {
  const bridgeAvailable = desktopClient.isAvailable()
  const initialLocale = resolveLocale(typeof navigator !== "undefined" ? navigator.language : null)
  const initialDictionary = getDictionary(initialLocale)

  const [syncState, setSyncState] = useState<DesktopSyncState>(initialState)
  const [preDistributionCheckSnapshot, setPreDistributionCheckSnapshot] =
    useState<PreDistributionCheckSnapshot | null>(null)
  const [localSkillsSnapshot, setLocalSkillsSnapshot] =
    useState<LocalSkillsInventorySnapshot | null>(null)
  const [agentDetectionSnapshot, setAgentDetectionSnapshot] =
    useState<AgentDetectionSnapshot | null>(null)
  const [isPreDistributionChecking, setIsPreDistributionChecking] = useState(false)
  const [isAgentDetectionRefreshing, setIsAgentDetectionRefreshing] = useState(false)
  const [isLocalSkillsRefreshing, setIsLocalSkillsRefreshing] = useState(false)
  const [preDistributionCheckClock, setPreDistributionCheckClock] = useState(() => Date.now())
  const [activity, setActivity] = useState<ActivityEntry[]>([
    createActivityEntry(
      initialDictionary.activity.consoleReadyTitle,
      initialDictionary.activity.consoleReadyDetail,
      "neutral"
    )
  ])
  const [isLoading, setIsLoading] = useState(true)
  const [busyUpdateId, setBusyUpdateId] = useState<string | null>(null)
  const [busyLocalSkillRowKey, setBusyLocalSkillRowKey] = useState<string | null>(null)
  const [pendingDistributionConfirmation, setPendingDistributionConfirmation] =
    useState<PendingSyncUpdate | null>(null)
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
  const pendingUpdateFingerprint = useMemo(
    () => createPendingUpdateFingerprint(syncState.pendingUpdates),
    [syncState.pendingUpdates]
  )
  const isPreDistributionCheckExpired =
    preDistributionCheckSnapshot !== null &&
    Number.isFinite(Date.parse(preDistributionCheckSnapshot.expiresAt)) &&
    Date.parse(preDistributionCheckSnapshot.expiresAt) <= preDistributionCheckClock
  const isPreDistributionCheckStale =
    preDistributionCheckSnapshot !== null &&
    (preDistributionCheckSnapshot.pendingUpdateFingerprint !== pendingUpdateFingerprint ||
      isPreDistributionCheckExpired)

  useEffect(() => {
    document.documentElement.lang = selectedLocale
  }, [selectedLocale])

  useEffect(() => {
    if (!preDistributionCheckSnapshot) {
      return
    }

    const expiresAtMs = Date.parse(preDistributionCheckSnapshot.expiresAt)

    if (!Number.isFinite(expiresAtMs)) {
      return
    }

    const delayMs = Math.max(0, expiresAtMs - Date.now())
    const maxBrowserTimeoutMs = 2_147_483_647
    const timeout = window.setTimeout(() => {
      setPreDistributionCheckClock(Date.now())
    }, Math.min(delayMs, maxBrowserTimeoutMs))

    return () => window.clearTimeout(timeout)
  }, [preDistributionCheckSnapshot])

  const refreshPreDistributionCheckForState = async (
    state: DesktopSyncState,
    localizedDictionary = dictionary
  ) => {
    if (!bridgeAvailable || state.pendingUpdates.length === 0) {
      setPreDistributionCheckSnapshot(null)
      setIsPreDistributionChecking(false)
      return
    }

    setIsPreDistributionChecking(true)

    try {
      const snapshot = await desktopClient.refreshPreDistributionCheck()
      const expectedFingerprint = createPendingUpdateFingerprint(state.pendingUpdates)

      setPreDistributionCheckClock(Date.now())
      setPreDistributionCheckSnapshot(
        snapshot.pendingUpdateFingerprint === expectedFingerprint ? snapshot : null
      )
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setPreDistributionCheckSnapshot(null)
      setActivity((current) =>
        [
          createActivityEntry(
            localizedDictionary.activity.refreshFailedTitle,
            localizedDictionary.activity.refreshFailedDetail(`Pre-distribution check: ${message}`),
            "warning"
          ),
          ...current
        ].slice(0, 5)
      )
    } finally {
      setIsPreDistributionChecking(false)
    }
  }

  const refreshAgentDetectionState = async (localizedDictionary = dictionary) => {
    if (!bridgeAvailable) {
      setAgentDetectionSnapshot(null)
      setIsAgentDetectionRefreshing(false)
      return null
    }

    setIsAgentDetectionRefreshing(true)

    try {
      const snapshot = await desktopClient.refreshAgentDetection()
      setAgentDetectionSnapshot(snapshot)
      return snapshot
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setActivity((current) =>
        [
          createActivityEntry(
            localizedDictionary.activity.refreshFailedTitle,
            localizedDictionary.activity.refreshFailedDetail(`Agent detection: ${message}`),
            "warning"
          ),
          ...current
        ].slice(0, 5)
      )
      return null
    } finally {
      setIsAgentDetectionRefreshing(false)
    }
  }

  const refreshLocalSkillsState = async (localizedDictionary = dictionary) => {
    if (!bridgeAvailable || !configurationReady) {
      setLocalSkillsSnapshot(null)
      setIsLocalSkillsRefreshing(false)
      return null
    }

    setIsLocalSkillsRefreshing(true)

    try {
      const snapshot = await desktopClient.refreshLocalSkills()
      setLocalSkillsSnapshot(snapshot)
      return snapshot
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setActivity((current) =>
        [
          createActivityEntry(
            localizedDictionary.activity.refreshFailedTitle,
            localizedDictionary.activity.refreshFailedDetail(`Local skills: ${message}`),
            "warning"
          ),
          ...current
        ].slice(0, 5)
      )
      return null
    } finally {
      setIsLocalSkillsRefreshing(false)
    }
  }

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
    return dictionary.appShell.bridgeStatus.connected
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
        await refreshAgentDetectionState(localizedDictionary)

        if (!active) {
          return
        }

        if (!configuration.hasToken) {
          setIsConfiguring(true)
          setActiveView("home")
          setErrorMessage(null)
          setPreDistributionCheckSnapshot(null)
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
        await refreshPreDistributionCheckForState(state, localizedDictionary)
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
      await refreshAgentDetectionState()
      setSyncState(state)
      setErrorMessage(null)
      await refreshPreDistributionCheckForState(state)
      if (activeView === "local-skills") {
        await refreshLocalSkillsState()
      }
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
          await refreshAgentDetectionState(localizedDictionary)
          setSyncState(state)
          await refreshPreDistributionCheckForState(state, localizedDictionary)
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
      setAgentDetectionSnapshot(null)
      setLocalSkillsSnapshot(null)
      setPreDistributionCheckSnapshot(null)
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

  const requestDistributionConfirmation = (pendingUpdate: PendingSyncUpdate) => {
    setPendingDistributionConfirmation(pendingUpdate)
  }

  const executeDistribution = async (pendingUpdate: PendingSyncUpdate) => {
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
        await refreshPreDistributionCheckForState(refreshedState)
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

  const handleConfirmDistribution = async () => {
    if (!pendingDistributionConfirmation) {
      return
    }

    const pendingUpdate = pendingDistributionConfirmation
    setPendingDistributionConfirmation(null)
    await executeDistribution(pendingUpdate)
  }

  const handleReconcileInstalled = async (pendingUpdate: PendingSyncUpdate) => {
    if (!bridgeAvailable) {
      return
    }

    setBusyUpdateId(pendingUpdate.remoteSkillId)

    try {
      const refreshedState = await desktopClient.reconcileInstalledSkill(
        pendingUpdate.remoteSkillId
      )

      setSyncState(refreshedState)
      setErrorMessage(null)
      await refreshPreDistributionCheckForState(refreshedState)
      setActivity((current) =>
        [
          createActivityEntry(
            dictionary.activity.localRecordSyncedTitle,
            dictionary.activity.localRecordSyncedDetail(pendingUpdate.name),
            "success"
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
            dictionary.activity.localRecordSyncFailedTitle,
            dictionary.activity.localRecordSyncFailedDetail(pendingUpdate.name, message),
            "warning"
          ),
          ...current
        ].slice(0, 5)
      )
    } finally {
      setBusyUpdateId(null)
    }
  }

  const handleRefreshPreDistributionCheck = async () => {
    await refreshPreDistributionCheckForState(syncState)
  }

  const handleRefreshAgentDetection = async () => {
    await refreshAgentDetectionState()
  }

  const handleNavigate = (view: AppView) => {
    setActiveView(view)

    if (view === "local-skills" && configurationReady && localSkillsSnapshot === null) {
      void refreshLocalSkillsState()
    }
  }

  const handleRefreshLocalSkills = async () => {
    if (!configurationReady) {
      setIsConfiguring(true)
      setSettingsOpen(true)
      return
    }

    await refreshLocalSkillsState()
  }

  const handleUploadLocalSkill = async (row: LocalSkillInventoryRow) => {
    if (!bridgeAvailable || !row.uploadable || !row.name) {
      return
    }

    setBusyLocalSkillRowKey(row.rowKey)

    try {
      const result = await desktopClient.uploadLocalSkill(row.rowKey)
      setLocalSkillsSnapshot(result.refreshedSnapshot)
      setActivity((current) =>
        [
          createActivityEntry(
            dictionary.activity.localSkillUploadedTitle,
            dictionary.activity.localSkillUploadedDetail(result.name),
            "success"
          ),
          ...current
        ].slice(0, 5)
      )
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      setActivity((current) =>
        [
          createActivityEntry(
            dictionary.activity.localSkillUploadFailedTitle,
            dictionary.activity.localSkillUploadFailedDetail(row.name ?? row.packageRootPath, message),
            "warning"
          ),
          ...current
        ].slice(0, 5)
      )
      await refreshLocalSkillsState()
    } finally {
      setBusyLocalSkillRowKey(null)
    }
  }

  const formattedLastRefreshedAt = formatLongTimestamp(
    selectedLocale,
    syncState.lastRefreshedAt,
    dictionary.common.notRefreshedYet
  )
  const distributionConfirmationSummary = pendingDistributionConfirmation
    ? createDistributionConfirmationSummary(
        pendingDistributionConfirmation,
        agentDetectionSnapshot,
        preDistributionCheckSnapshot,
        isPreDistributionCheckStale
      )
    : null

  return (
    <I18nProvider locale={selectedLocale} dictionary={dictionary}>
      <AppShell
        activeView={activeView}
        bridgeStatus={bridgeStatus}
        pendingUpdateCount={syncState.pendingUpdates.length}
        isRefreshing={isLoading}
        canRefresh={configurationReady}
        onNavigate={handleNavigate}
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
            installedAgentCount={agentDetectionSnapshot?.installedAgentIds.length ?? 0}
            pendingUpdates={syncState.pendingUpdates}
            preDistributionCheckSnapshot={preDistributionCheckSnapshot}
            isPreDistributionChecking={isPreDistributionChecking}
            isPreDistributionCheckStale={isPreDistributionCheckStale}
            busyUpdateId={busyUpdateId}
            onDistribute={requestDistributionConfirmation}
            onReconcileInstalled={handleReconcileInstalled}
            onOpenSettings={() => setSettingsOpen(true)}
            onRefresh={handleRefresh}
            onViewUpdates={() => setActiveView("updates")}
          />
        ) : activeView === "local-skills" ? (
          <LocalSkillsView
            snapshot={localSkillsSnapshot}
            bridgeAvailable={bridgeAvailable}
            configurationReady={configurationReady}
            isRefreshing={isLocalSkillsRefreshing}
            uploadingRowKey={busyLocalSkillRowKey}
            onRefresh={handleRefreshLocalSkills}
            onUpload={handleUploadLocalSkill}
          />
        ) : (
          <UpdatesView
            isLoading={isLoading}
            isPreDistributionChecking={isPreDistributionChecking}
            isPreDistributionCheckStale={isPreDistributionCheckStale}
            pendingUpdates={syncState.pendingUpdates}
            preDistributionCheckSnapshot={preDistributionCheckSnapshot}
            busyUpdateId={busyUpdateId}
            onDistribute={requestDistributionConfirmation}
            onReconcileInstalled={handleReconcileInstalled}
            onRefreshPreDistributionCheck={handleRefreshPreDistributionCheck}
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
          agentDetectionSnapshot={agentDetectionSnapshot}
          isAgentDetectionRefreshing={isAgentDetectionRefreshing}
          currentLocale={selectedLocale}
          onChangeLocale={handleChangeLocale}
          onClearConfiguration={handleClearConfiguration}
          onClose={() => setSettingsOpen(false)}
          onRefreshAgentDetection={handleRefreshAgentDetection}
          onSaveConfiguration={handleSaveConfiguration}
          onTestConnection={handleTestConnection}
        />
        {pendingDistributionConfirmation && distributionConfirmationSummary ? (
          <Dialog
            open
            title={dictionary.distributionConfirmation.title}
            description={dictionary.distributionConfirmation.description(
              pendingDistributionConfirmation.name
            )}
            closeLabel={dictionary.common.close}
            onClose={() => setPendingDistributionConfirmation(null)}
            footer={
              <div className="dialog-actions">
                <Button variant="outline" onClick={() => setPendingDistributionConfirmation(null)}>
                  {dictionary.distributionConfirmation.cancel}
                </Button>
                <Button variant="destructive" onClick={handleConfirmDistribution}>
                  {dictionary.distributionConfirmation.confirm}
                </Button>
              </div>
            }
          >
            <div className="callout callout--warning">
              <strong>{dictionary.preDistributionCheck.warningBeforeDistribute}</strong>
              <span>{dictionary.distributionConfirmation.destructiveWarning}</span>
            </div>
            <div className="dialog-section">
              <h3 className="dialog-section__title">
                {dictionary.distributionConfirmation.writeTargetsTitle}
              </h3>
              {renderDialogList(
                distributionConfirmationSummary.writeTargets,
                dictionary.distributionConfirmation.noWriteTargets
              )}
            </div>
            <div className="dialog-section">
              <h3 className="dialog-section__title">
                {dictionary.distributionConfirmation.skippedTargetsTitle}
              </h3>
              {renderDialogList(
                distributionConfirmationSummary.skippedTargets,
                dictionary.distributionConfirmation.noSkippedTargets
              )}
            </div>
            <div className="dialog-section">
              <h3 className="dialog-section__title">
                {dictionary.distributionConfirmation.missingAgentsTitle}
              </h3>
              {renderDialogList(
                distributionConfirmationSummary.missingAgents,
                dictionary.distributionConfirmation.noMissingAgents
              )}
            </div>
          </Dialog>
        ) : null}
      </AppShell>
    </I18nProvider>
  )
}
