import { existsSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  Notification,
  Tray,
  ipcMain,
  nativeImage,
  screen,
  shell
} from "electron"
import type { OpenDialogOptions } from "electron"

import { getAgentAdapter } from "@/adapters/agents/registry"
import { createClientSkillApi } from "@/core/client-skills/client-skill-api"
import {
  createDistributionNotification,
  createDistributionService
} from "@/core/distribution/distribution-service"
import { extractZipArchive } from "@/core/distribution/archive-extraction"
import { createPackageService } from "@/core/distribution/package-service"
import { uploadLocalSkillPackage } from "@/core/local-skills/local-skill-client-api"
import { createLocalSkillInventoryService } from "@/core/local-skills/local-skill-inventory-service"
import { prepareLocalSkillUploadPackage } from "@/core/local-skills/local-skill-upload-package"
import { createPreDistributionCheckService } from "@/core/pre-distribution-check/pre-distribution-check-service"
import { createProjectSkillImportService } from "@/core/projects/project-skill-import-service"
import { createProjectSkillScanService } from "@/core/projects/project-skill-scan-service"
import {
  createRuntimeConfigManager,
  type DesktopRuntimeConfig,
  type RuntimeConfigurationState
} from "@/core/runtime/runtime-config-manager"
import { testApiConnection } from "@/core/runtime/api-connection"
import { ensureAppDirectories } from "@/core/storage/app-paths"
import { createAgentPathsConfigStore } from "@/core/storage/agent-paths-config"
import { createProjectConfigStore } from "@/core/storage/project-config"
import { createSqliteStateStore } from "@/core/storage/state-db"
import { createSyncPollingController, createSyncService } from "@/core/sync/sync-service"
import type {
  AgentDetectionSnapshot,
  AgentPathsConfig,
  AppLocale,
  AppTheme,
  AgentId,
  ConfigurationPayload,
  ConfigurationState,
  DesktopSyncState,
  LocalSkillServerLookupStatus,
  LocalSkillsInventorySnapshot,
  LocalSkillUploadResult,
  LocalSkillDeletePayload,
  LocalSkillOpenFolderPayload,
  PendingSyncUpdate,
  PreDistributionCheckSnapshot,
  DirectorySelectionResult,
  ProjectImportSkillPayload,
  ProjectListSnapshot,
  ProjectOpenFolderPayload,
  ProjectScanPayload,
  ProjectSkillFolderValidation,
  ProjectSkillImportResult,
  ProjectSkillScanSnapshot,
  ProjectValidateSkillFolderPayload,
  RemoteSkillSummary,
  SkillDistributionTarget,
  SkillDistributionResult,
  SkillPackageRequest
} from "@/types"
import { registerDesktopClientIpc } from "./ipc"
import { createDecryptArtifactFromEnv } from "./encryption"

const preloadPath = fileURLToPath(new URL("./preload.js", import.meta.url))
const devWindowsIconPath = fileURLToPath(new URL("../resources/icons/icon.ico", import.meta.url))
const APP_USER_MODEL_ID = "com.skilldrive.skilldrive-desktop"
const TARGET_RENDERER_PHYSICAL_SIZE = {
  width: 1984,
  height: 1168
} as const

type TrayNotificationPayload = {
  title: string
  body: string
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let stateStore: Awaited<ReturnType<typeof createSqliteStateStore>> | null = null
let stopPolling: (() => void) | null = null
let isQuitting = false

function getTargetWindowContentSize() {
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1

  return {
    width: Math.round(TARGET_RENDERER_PHYSICAL_SIZE.width / scaleFactor),
    height: Math.round(TARGET_RENDERER_PHYSICAL_SIZE.height / scaleFactor)
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function classifyLocalSkillServerLookupError(error: unknown): LocalSkillServerLookupStatus {
  const message = getErrorMessage(error).toLowerCase()

  if (message.includes("api token")) {
    return "configuration-missing"
  }

  if (message.includes("401") || message.includes("403")) {
    return "auth-failed"
  }

  if (
    error instanceof TypeError ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  ) {
    return "network-error"
  }

  return "error"
}

function toConfigurationState(state: RuntimeConfigurationState): ConfigurationState {
  return {
    apiBaseUrl: state.config.apiBaseUrl,
    locale: state.config.locale,
    theme: state.config.theme,
    hasToken: Boolean(state.config.apiToken),
    tokenSource: state.bootstrap.source,
    persistedEnvironmentToken: state.bootstrap.persistedEnvironmentToken,
    secretStoreAvailable: state.bootstrap.secretStoreAvailable,
    warning: state.bootstrap.warning ?? undefined
  }
}

function createEmbeddedIcon(size = 256) {
  // Build-time embedded SVG sourced from resources/icons/icon.svg.
  const svg = Buffer.from(__EMBEDDED_ICON_SVG__, "utf8").toString("base64")

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${svg}`).resize({
    height: size,
    width: size
  })
}

function resolveWindowsIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "icons", "icon.ico")
  }

  return devWindowsIconPath
}

function createWindowsIcon(size = 256) {
  const iconPath = resolveWindowsIconPath()
  if (!existsSync(iconPath)) {
    return null
  }

  const icon = nativeImage.createFromPath(iconPath)

  if (icon.isEmpty()) {
    return null
  }

  return icon.resize({
    height: size,
    width: size
  })
}

function createAppIcon(size = 256) {
  if (process.platform === "win32") {
    return createWindowsIcon(size) ?? createEmbeddedIcon(size)
  }

  return createEmbeddedIcon(size)
}

function createTrayImage() {
  return createAppIcon(process.platform === "win32" ? 16 : 18)
}

function createNotification(payload: TrayNotificationPayload): void {
  if (Notification.isSupported()) {
    new Notification(payload).show()
  }
}

function createWindow(): BrowserWindow {
  const initialContentSize = getTargetWindowContentSize()
  const window = new BrowserWindow({
    width: initialContentSize.width,
    height: initialContentSize.height,
    useContentSize: true,
    backgroundColor: "#f7f4ed",
    icon: createAppIcon(256),
    autoHideMenuBar: true,
    fullscreenable: false,
    maximizable: true,
    resizable: true,
    skipTaskbar: false,
    show: true,
    title: "SkillDrive",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath
    }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL

  if (devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(fileURLToPath(new URL("../dist/index.html", import.meta.url)))
  }

  return window
}

async function listRemoteSkills(config: DesktopRuntimeConfig): Promise<RemoteSkillSummary[]> {
  return createClientSkillApi({
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    cacheDirectory: config.cacheDirectory
  }).listRemoteSkills()
}

async function downloadSkillArtifact(
  config: DesktopRuntimeConfig,
  request: SkillPackageRequest
) {
  return createClientSkillApi({
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    cacheDirectory: config.cacheDirectory
  }).downloadSkillArtifact(request)
}

async function extractArchive(artifactPath: string, extractedPath: string): Promise<void> {
  try {
    await extractZipArchive(artifactPath, extractedPath)
  } catch (error) {
    throw new Error(`Failed to extract downloaded skill package: ${getErrorMessage(error)}`)
  }
}

function getPreDistributionCheckTargets(config: DesktopRuntimeConfig) {
  return config.agentDetection.uniqueTargets.map((target) => {
    const adapter = getAgentAdapter(target.primaryAgentId)
    const coveredAdapters = target.coveredAgentIds.map((agentId) => {
      const coveredAdapter = getAgentAdapter(agentId)

      return {
        id: coveredAdapter.id,
        displayName: coveredAdapter.displayName
      }
    })

    return {
      adapter,
      coveredAdapters,
      target,
      installContext: {
        skillsPath: target.targetPath,
        ...(target.skillLayout ? { skillLayout: target.skillLayout } : {})
      }
    }
  })
}

function getDistributionTargets(
  config: DesktopRuntimeConfig,
  snapshot?: PreDistributionCheckSnapshot,
  pendingUpdateId?: string
): SkillDistributionTarget[] {
  const resultsByAgent =
    snapshot && pendingUpdateId ? snapshot.results[pendingUpdateId] ?? {} : {}

  return config.agentDetection.uniqueTargets.map((target) => ({
    ...target,
    writeMode:
      target.coveredAgentIds.length > 0 &&
      target.coveredAgentIds.every(
        (agentId) => resultsByAgent[agentId]?.contentComparison === "installed"
      )
        ? "skip-installed-content"
        : "write"
  }))
}

function findPendingUpdate(state: DesktopSyncState, pendingUpdateId: string): PendingSyncUpdate | null {
  return (
    state.pendingUpdates.find(
      (update) => update.remoteSkillId === pendingUpdateId || update.name === pendingUpdateId
    ) ?? null
  )
}

function reconcileStateAfterInstalled(
  currentState: DesktopSyncState,
  pendingUpdate: PendingSyncUpdate,
  comparedAt: string
): DesktopSyncState {
  const nextLocalRecords = [...currentState.localRecords]
  const existingRecordIndex = nextLocalRecords.findIndex(
    (record) => record.remoteSkillId === pendingUpdate.remoteSkillId
  )
  const nextRecord = {
    remoteSkillId: pendingUpdate.remoteSkillId,
    name: pendingUpdate.name,
    installedVersion: pendingUpdate.remoteVersion,
    installedContentHash: pendingUpdate.remoteContentHash,
    remoteVersion: pendingUpdate.remoteVersion,
    remoteContentHash: pendingUpdate.remoteContentHash,
    lastComparedAt: comparedAt
  }

  if (existingRecordIndex >= 0) {
    nextLocalRecords[existingRecordIndex] = nextRecord
  } else {
    nextLocalRecords.push(nextRecord)
  }

  return {
    localRecords: nextLocalRecords,
    pendingUpdates: currentState.pendingUpdates.filter(
      (update) => update.remoteSkillId !== pendingUpdate.remoteSkillId
    ),
    successfulDistributionCount: currentState.successfulDistributionCount,
    lastRefreshedAt: currentState.lastRefreshedAt
  }
}

function configureWindowLifecycle(window: BrowserWindow): void {
  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })
  window.on("closed", () => {
    mainWindow = null
  })
}

function showMainWindow(): void {
  if (!mainWindow) {
    mainWindow = createWindow()
    configureWindowLifecycle(mainWindow)
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }

  mainWindow.focus()
}

function toggleMainWindow(): void {
  if (mainWindow?.isVisible()) {
    mainWindow.hide()
    return
  }

  showMainWindow()
}

async function closeStateStore(): Promise<void> {
  if (!stateStore) {
    return
  }

  const currentStateStore = stateStore
  stateStore = null
  await currentStateStore.close()
}

async function createApplicationServices(): Promise<void> {
  const appPaths = ensureAppDirectories()
  const agentPathsConfigStore = createAgentPathsConfigStore(appPaths.agentPathsFilePath)
  const projectConfigStore = createProjectConfigStore(appPaths.projectsFilePath)
  const runtimeConfigManager = createRuntimeConfigManager()
  const initialRuntimeState = await runtimeConfigManager.reload()
  const getRuntimeConfig = () => runtimeConfigManager.getState().config

  if (initialRuntimeState.bootstrap.warning) {
    console.warn(initialRuntimeState.bootstrap.warning)
  }

  stateStore = await createSqliteStateStore(appPaths.stateDbPath)

  tray = new Tray(createTrayImage())
  tray.setToolTip("SkillDrive Desktop - starting up")

  const syncService = createSyncService({
    apiClient: {
      listClientSkills: () => listRemoteSkills(getRuntimeConfig())
    },
    stateStore
  })
  const pollingController = createSyncPollingController({
    syncService,
    tray,
    createNotification: (options) => new Notification(options),
    pollIntervalMs: getRuntimeConfig().pollIntervalMs,
    onError: (error: unknown) => {
      console.error("Background sync failed", error)
      tray?.setToolTip("SkillDrive Desktop - sync unavailable")
    }
  })
  const packageService = createPackageService({
    downloadArtifact: (request) => downloadSkillArtifact(getRuntimeConfig(), request),
    decryptArtifact: createDecryptArtifactFromEnv(process.env),
    extractArtifact: (artifact, extractedPath) => extractArchive(artifact.artifactPath, extractedPath),
    createTempDirectory: async () => mkdtemp(join(tmpdir(), "skilldrive-package-"))
  })
  const localSkillInventoryService = createLocalSkillInventoryService()
  const projectSkillScanService = createProjectSkillScanService()
  const projectSkillImportService = createProjectSkillImportService()
  const distributionService = createDistributionService({
    packageService,
    stateStore,
    resolveAgentAdapter: (agentId) => getAgentAdapter(agentId as AgentId)
  })

  stopPolling = pollingController.stop

  Menu.setApplicationMenu(null)

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open SkillDrive",
        click: () => showMainWindow()
      },
      {
        label: "Refresh now",
        click: () => {
          void pollingController.refreshNow().catch((error: unknown) => {
            console.error("Manual sync failed", error)
            tray?.setToolTip("SkillDrive Desktop - sync unavailable")
          })
        }
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true
          stopPolling?.()
          void closeStateStore()
          app.quit()
        }
      }
    ])
  )

  tray.on("click", () => toggleMainWindow())

  showMainWindow()

  const startPollingIfConfigured = async () => {
    if (!getRuntimeConfig().apiToken) {
      pollingController.stop()
      tray?.setToolTip("SkillDrive Desktop - configure API token")
      return
    }

    await pollingController.start()
  }

  const refreshLocalSkillsSnapshot = async (): Promise<LocalSkillsInventorySnapshot> => {
    const runtimeState = await runtimeConfigManager.reload()
    const runtimeConfig = runtimeState.config
    let remoteSkills: RemoteSkillSummary[] = []
    let serverLookupStatus: LocalSkillServerLookupStatus = "ok"
    let serverLookupMessage: string | null = null

    if (!runtimeConfig.apiToken) {
      serverLookupStatus = "configuration-missing"
      serverLookupMessage = "API token is required to compare local skills with the server."
    } else {
      try {
        remoteSkills = await listRemoteSkills(runtimeConfig)
      } catch (error) {
        serverLookupStatus = classifyLocalSkillServerLookupError(error)
        serverLookupMessage = getErrorMessage(error)
      }
    }

    return localSkillInventoryService.refresh({
      detectionSnapshot: runtimeConfig.agentDetection,
      remoteSkills,
      serverLookupStatus,
      serverLookupMessage
    })
  }

  const uploadLocalSkillByRowKey = async (rowKey: string): Promise<LocalSkillUploadResult> => {
    const normalizedRowKey = String(rowKey ?? "").trim()

    if (!normalizedRowKey) {
      throw new Error("rowKey cannot be empty")
    }

    if (normalizedRowKey.length > 128) {
      throw new Error("rowKey is too long")
    }

    const snapshot = await refreshLocalSkillsSnapshot()

    if (snapshot.serverLookupStatus !== "ok") {
      throw new Error(
        `Cannot upload local skill while server lookup is unavailable: ${
          snapshot.serverLookupMessage ?? snapshot.serverLookupStatus
        }`
      )
    }

    const row = snapshot.rows.find((item) => item.rowKey === normalizedRowKey)

    if (!row) {
      throw new Error(`Unknown local skill row: ${normalizedRowKey}`)
    }

    if (!row.name || !row.uploadable) {
      throw new Error("Local skill is not eligible for upload")
    }

    const runtimeConfig = runtimeConfigManager.getState().config
    const preparedPackage = await prepareLocalSkillUploadPackage({
      packageRootPath: row.packageRootPath,
      skillName: row.name,
      cacheDirectory: runtimeConfig.cacheDirectory
    })

    try {
      const uploadedSkill = await uploadLocalSkillPackage({
        apiBaseUrl: runtimeConfig.apiBaseUrl,
        apiToken: runtimeConfig.apiToken,
        artifactPath: preparedPackage.artifactPath,
        fileName: preparedPackage.fileName
      })
      const refreshedSnapshot = await refreshLocalSkillsSnapshot()

      return {
        rowKey: row.rowKey,
        uploadedSkillId: uploadedSkill.id,
        name: uploadedSkill.name,
        version: uploadedSkill.version,
        refreshedSnapshot
      }
    } finally {
      await preparedPackage.cleanup().catch((error: unknown) => {
        console.warn("Failed to clean up local skill upload package", error)
      })
    }
  }

  const deleteLocalSkillByRowKey = async (payload: LocalSkillDeletePayload): Promise<LocalSkillsInventorySnapshot> => {
    const normalizedRowKey = String(payload.rowKey ?? "").trim()

    if (!normalizedRowKey) {
      throw new Error("rowKey cannot be empty")
    }

    const snapshot = await refreshLocalSkillsSnapshot()

    const rowKeysToDelete: string[] = []
    if (payload.groupRowKeys && payload.groupRowKeys.length > 0) {
      rowKeysToDelete.push(...payload.groupRowKeys)
    } else {
      rowKeysToDelete.push(normalizedRowKey)
    }

    for (const rk of rowKeysToDelete) {
      const row = snapshot.rows.find((item) => item.rowKey === rk)
      if (row) {
        await rm(row.packageRootPath, { recursive: true, force: true })
      }
    }

    return refreshLocalSkillsSnapshot()
  }

  const openLocalSkillFolder = async (payload: LocalSkillOpenFolderPayload): Promise<void> => {
    const normalizedRowKey = String(payload.rowKey ?? "").trim()

    if (!normalizedRowKey) {
      throw new Error("rowKey cannot be empty")
    }

    const snapshot = await refreshLocalSkillsSnapshot()
    const row = snapshot.rows.find((item) => item.rowKey === normalizedRowKey)

    if (!row) {
      throw new Error(`Unknown local skill row: ${normalizedRowKey}`)
    }

    const openError = await shell.openPath(row.packageRootPath)

    if (openError) {
      throw new Error(`Failed to open local skill folder: ${openError}`)
    }
  }

  const openAgentPathsConfigDir = async (): Promise<void> => {
    await agentPathsConfigStore.ensureFile()

    try {
      shell.showItemInFolder(appPaths.agentPathsFilePath)
    } catch {
      const openError = await shell.openPath(appPaths.configDir)

      if (openError) {
        throw new Error(`Failed to open agent paths config directory: ${openError}`)
      }
    }
  }

  const selectDirectory = async (): Promise<DirectorySelectionResult> => {
    const options: OpenDialogOptions = {
      properties: ["openDirectory"]
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return {
        canceled: true,
        path: null
      }
    }

    return {
      canceled: false,
      path: result.filePaths[0]
    }
  }

  const scanProjectSkillsById = async (
    payload: ProjectScanPayload
  ): Promise<ProjectSkillScanSnapshot> => {
    const project = await projectConfigStore.getProject(payload.projectId)
    const globalSnapshot = await refreshLocalSkillsSnapshot().catch((error: unknown) => {
      console.warn("Failed to load global local skills while scanning project", error)
      return null
    })

    return projectSkillScanService.scan({
      project,
      globalSnapshot
    })
  }

  const openProjectFolder = async (payload: ProjectOpenFolderPayload): Promise<void> => {
    const project = await projectConfigStore.getProject(payload.projectId)
    const openError = await shell.openPath(project.path)

    if (openError) {
      throw new Error(`Failed to open project folder: ${openError}`)
    }
  }

  const validateProjectSkillFolder = (
    payload: ProjectValidateSkillFolderPayload
  ): Promise<ProjectSkillFolderValidation> =>
    projectSkillImportService.validateSkillFolder({
      sourcePath: payload.sourcePath
    })

  const importProjectSkill = async (
    payload: ProjectImportSkillPayload
  ): Promise<ProjectSkillImportResult> => {
    const project = await projectConfigStore.getProject(payload.projectId)

    return projectSkillImportService.importSkill({
      project,
      sourcePath: payload.sourcePath,
      targetAgentId: payload.targetAgentId,
      overwrite: Boolean(payload.overwrite)
    })
  }

  registerDesktopClientIpc(ipcMain, {
    getConfiguration: () => toConfigurationState(runtimeConfigManager.getState()),
    saveConfiguration: async (payload: ConfigurationPayload): Promise<ConfigurationState> => {
      const nextState = await runtimeConfigManager.saveConfiguration(payload)

      if (nextState.bootstrap.warning) {
        console.warn(nextState.bootstrap.warning)
      }

      try {
        await startPollingIfConfigured()
      } catch (error) {
        console.error("Failed to restart background sync after saving configuration", error)
        tray?.setToolTip("SkillDrive Desktop - sync unavailable")
      }

      return toConfigurationState(nextState)
    },
    saveLocale: async (locale: AppLocale): Promise<ConfigurationState> => {
      const nextState = await runtimeConfigManager.saveLocale(locale)

      return toConfigurationState(nextState)
    },
    saveTheme: async (theme: AppTheme): Promise<ConfigurationState> => {
      const nextState = await runtimeConfigManager.saveTheme(theme)

      return toConfigurationState(nextState)
    },
    clearConfiguration: async (): Promise<ConfigurationState> => {
      const nextState = await runtimeConfigManager.clearConfiguration()
      pollingController.stop()
      tray?.setToolTip("SkillDrive Desktop - configure API token")

      return toConfigurationState(nextState)
    },
    testConnection: (payload: ConfigurationPayload) =>
      testApiConnection(payload, getRuntimeConfig().apiToken),
    getAgentPathsConfig: () => agentPathsConfigStore.read(),
    saveAgentPathsConfig: async (config: AgentPathsConfig): Promise<AgentPathsConfig> => {
      await agentPathsConfigStore.write(config)
      const nextConfig = await agentPathsConfigStore.read()
      await runtimeConfigManager.reload()

      return nextConfig
    },
    openAgentPathsConfigDir,
    refreshSync: async (): Promise<DesktopSyncState> => {
      await pollingController.refreshNow()

      const currentStateStore = stateStore

      if (!currentStateStore) {
        throw new Error("State store unavailable")
      }

      return currentStateStore.readState()
    },
    refreshAgentDetection: async (): Promise<AgentDetectionSnapshot> => {
      const nextRuntimeState = await runtimeConfigManager.reload()

      return nextRuntimeState.config.agentDetection
    },
    refreshLocalSkills: () => refreshLocalSkillsSnapshot(),
    uploadLocalSkill: (rowKey: string) => uploadLocalSkillByRowKey(rowKey),
    deleteLocalSkill: (payload: LocalSkillDeletePayload) => deleteLocalSkillByRowKey(payload),
    openLocalSkillFolder: (payload: LocalSkillOpenFolderPayload) => openLocalSkillFolder(payload),
    listProjects: (): Promise<ProjectListSnapshot> => projectConfigStore.listProjects(),
    addProject: (payload) => projectConfigStore.addProject(payload),
    renameProject: (payload) => projectConfigStore.renameProject(payload),
    removeProject: (payload) => projectConfigStore.removeProject(payload),
    selectProjectFolder: () => selectDirectory(),
    openProjectFolder,
    scanProjectSkills: (payload: ProjectScanPayload) => scanProjectSkillsById(payload),
    selectProjectSkillFolder: () => selectDirectory(),
    validateProjectSkillFolder,
    importProjectSkill,
    refreshPreDistributionCheck: async (): Promise<PreDistributionCheckSnapshot> => {
      const currentStateStore = stateStore

      if (!currentStateStore) {
        throw new Error("State store unavailable")
      }

      const runtimeConfig = (await runtimeConfigManager.reload()).config
      const preDistributionCheckService = createPreDistributionCheckService({
        stateStore: currentStateStore,
        targets: getPreDistributionCheckTargets(runtimeConfig)
      })

      return preDistributionCheckService.refresh()
    },
    reconcileInstalledSkill: async (pendingUpdateId: string): Promise<DesktopSyncState> => {
      const normalizedPendingUpdateId = pendingUpdateId.trim()

      if (!normalizedPendingUpdateId) {
        throw new Error("pendingUpdateId cannot be empty")
      }

      const currentStateStore = stateStore

      if (!currentStateStore) {
        throw new Error("State store unavailable")
      }

      const currentState = await currentStateStore.readState()
      const pendingUpdate = findPendingUpdate(currentState, normalizedPendingUpdateId)

      if (!pendingUpdate) {
        throw new Error(`Unknown pending update: ${normalizedPendingUpdateId}`)
      }

      const runtimeConfig = (await runtimeConfigManager.reload()).config
      const preDistributionCheckService = createPreDistributionCheckService({
        stateStore: currentStateStore,
        targets: getPreDistributionCheckTargets(runtimeConfig)
      })
      const snapshot = await preDistributionCheckService.refresh()
      const results = Object.values(snapshot.results[pendingUpdate.remoteSkillId] ?? {}).filter(
        (result) => result !== undefined
      )

      if (snapshot.targetAgentIds.length === 0) {
        throw new Error("No supported agent skills directories were detected.")
      }

      if (
        results.length !== snapshot.targetAgentIds.length ||
        !results.every((result) => result.contentComparison === "installed")
      ) {
        throw new Error("Installed target contents are not all identical to the remote content hash.")
      }

      const nextState = reconcileStateAfterInstalled(
        currentState,
        pendingUpdate,
        new Date().toISOString()
      )
      await currentStateStore.writeState(nextState)

      return nextState
    },
    distributePendingUpdate: async (pendingUpdateId: string): Promise<SkillDistributionResult> => {
      const normalizedPendingUpdateId = pendingUpdateId.trim()

      if (!normalizedPendingUpdateId) {
        throw new Error("pendingUpdateId cannot be empty")
      }

      const currentStateStore = stateStore

      if (!currentStateStore) {
        throw new Error("State store unavailable")
      }

      const currentState = await currentStateStore.readState()
      const pendingUpdate = findPendingUpdate(currentState, normalizedPendingUpdateId)

      if (!pendingUpdate) {
        throw new Error(`Unknown pending update: ${normalizedPendingUpdateId}`)
      }

      const runtimeConfig = (await runtimeConfigManager.reload()).config
      const preDistributionCheckService = createPreDistributionCheckService({
        stateStore: currentStateStore,
        targets: getPreDistributionCheckTargets(runtimeConfig)
      })
      const preDistributionCheckSnapshot = await preDistributionCheckService.refresh()
      const distributionTargets = getDistributionTargets(
        runtimeConfig,
        preDistributionCheckSnapshot,
        pendingUpdate.remoteSkillId
      )

      if (distributionTargets.length === 0) {
        throw new Error(
          "No supported agent skills directories were detected. Configure agent-paths.json or install a supported agent to continue."
        )
      }

      const result = await distributionService.distribute({
        skillId: pendingUpdate.remoteSkillId,
        name: pendingUpdate.name,
        version: pendingUpdate.remoteVersion,
        contentHash: pendingUpdate.remoteContentHash,
        packageSource: {
          source: "client-download"
        },
        targets: distributionTargets
      })
      const notification = createDistributionNotification(result)
      createNotification({
        title: notification.title,
        body: notification.body
      })
      return result
    }
  })

  try {
    await startPollingIfConfigured()
  } catch (error) {
    console.error("Failed to perform the initial background refresh", error)
    tray.setToolTip("SkillDrive Desktop - sync unavailable")
  }
}

app.setAppUserModelId(APP_USER_MODEL_ID)

const singleInstanceLock = app.requestSingleInstanceLock()

if (!singleInstanceLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (app.isReady()) {
      showMainWindow()
    }
  })

  app.whenReady().then(() => {
    void createApplicationServices().catch((error: unknown) => {
      console.error("Failed to bootstrap the desktop client", error)
      app.exit(1)
    })

    app.on("activate", () => {
      showMainWindow()
    })
  })
}

app.on("before-quit", () => {
  isQuitting = true
  stopPolling?.()
  void closeStateStore()
})
