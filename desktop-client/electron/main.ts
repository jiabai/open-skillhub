import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  ipcMain,
  nativeImage
} from "electron"

import type { AgentId } from "@/adapters/agents/base"
import { getAgentAdapter, listAgentAdapters } from "@/adapters/agents/registry"
import {
  createDistributionNotification,
  createDistributionService
} from "@/core/distribution/distribution-service"
import { createPackageService } from "@/core/distribution/package-service"
import {
  createRuntimeConfigManager,
  type DesktopRuntimeConfig,
  type RuntimeConfigurationState
} from "@/core/runtime/runtime-config-manager"
import { testApiConnection } from "@/core/runtime/api-connection"
import { ensureAppDirectories } from "@/core/storage/app-paths"
import { createSqliteStateStore } from "@/core/storage/state-db"
import { createSyncPollingController, createSyncService } from "@/core/sync/sync-service"
import type {
  AppLocale,
  ConfigurationPayload,
  ConfigurationState,
  DesktopSyncState,
  DownloadedSkillArtifact,
  RemoteSkillSummary,
  SkillDistributionResult,
  SkillPackageRequest
} from "@/types"
import { registerDesktopClientIpc } from "./ipc"

const preloadPath = fileURLToPath(new URL("./preload.js", import.meta.url))
const windowsIconPath = fileURLToPath(new URL("../resources/icons/icon.ico", import.meta.url))
const execFileAsync = promisify(execFile)
const APP_USER_MODEL_ID = "com.open-skillhub.desktop-client"

type TrayNotificationPayload = {
  title: string
  body: string
}

type ClientSkillDownloadPayload = {
  skill_uuid: string
  version: string
  encrypted_code: string
  checksum: string
  expires_at: string
  encryption_enabled: boolean
  download_filename: string
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let stateStore: Awaited<ReturnType<typeof createSqliteStateStore>> | null = null
let stopPolling: (() => void) | null = null
let isQuitting = false

function normalizeVersion(version: string | null | undefined): string | null {
  const trimmed = version?.trim()
  return trimmed ? trimmed : null
}

function sanitizeCacheSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_")
}

function computeSha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

function assertChecksum(bytes: Buffer, expectedChecksum: string): void {
  if (computeSha256(bytes) !== expectedChecksum.trim().toLowerCase()) {
    throw new Error("Downloaded skill package checksum verification failed")
  }
}

function assertNotExpired(expiresAt: string): void {
  const expiresAtMs = Date.parse(expiresAt)

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error("Downloaded skill package has expired")
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toConfigurationState(state: RuntimeConfigurationState): ConfigurationState {
  return {
    apiBaseUrl: state.config.apiBaseUrl,
    locale: state.config.locale,
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

function createWindowsIcon(size = 256) {
  if (!existsSync(windowsIconPath)) {
    return null
  }

  const icon = nativeImage.createFromPath(windowsIconPath)

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
  const window = new BrowserWindow({
    width: 460,
    height: 720,
    minWidth: 420,
    minHeight: 560,
    maxWidth: 560,
    maxHeight: 900,
    backgroundColor: "#f7f4ed",
    icon: createAppIcon(256),
    autoHideMenuBar: true,
    fullscreenable: false,
    maximizable: false,
    skipTaskbar: process.platform === "win32",
    show: true,
    title: "Open SkillHub",
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

function normalizeSkillSummary(item: unknown): RemoteSkillSummary | null {
  const record = item as Record<string, unknown>
  const versionRecord = record.latest_version as Record<string, unknown> | undefined
  const id = String(
    record.id ?? record.skill_uuid ?? record.skillUuid ?? record.remoteSkillId ?? ""
  ).trim()
  const name = String(record.name ?? "").trim()

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,
    version:
      normalizeVersion(
        String(record.version ?? record.current_version ?? record.currentVersion ?? "").trim() ||
          null
      ) ?? normalizeVersion(versionRecord?.version as string | null | undefined),
    updatedAt: String(
      record.updatedAt ?? record.updated_at ?? versionRecord?.updated_at ?? new Date().toISOString()
    )
  }
}

function createAuthHeaders(config: DesktopRuntimeConfig): Record<string, string> {
  if (!config.apiToken) {
    throw new Error("An Open SkillHub API token is required to connect the desktop client")
  }

  return {
    Authorization: `Bearer ${config.apiToken}`
  }
}

async function listRemoteSkills(config: DesktopRuntimeConfig): Promise<RemoteSkillSummary[]> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/client/skills`, {
    headers: createAuthHeaders(config)
  })

  if (!response.ok) {
    throw new Error(`Failed to load client skills: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as unknown
  const items = Array.isArray((payload as { items?: unknown }).items)
    ? ((payload as { items: unknown[] }).items as unknown[])
    : Array.isArray(payload)
      ? payload
      : []

  return items.map(normalizeSkillSummary).filter((item): item is RemoteSkillSummary => item !== null)
}

function parseDownloadPayload(payload: unknown): ClientSkillDownloadPayload {
  const record = payload as Record<string, unknown>

  return {
    skill_uuid: String(record.skill_uuid ?? "").trim(),
    version: String(record.version ?? "").trim(),
    encrypted_code: String(record.encrypted_code ?? "").trim(),
    checksum: String(record.checksum ?? "").trim().toLowerCase(),
    expires_at: String(record.expires_at ?? "").trim(),
    encryption_enabled: Boolean(record.encryption_enabled),
    download_filename: String(record.download_filename ?? "").trim()
  }
}

async function downloadSkillArtifact(
  config: DesktopRuntimeConfig,
  request: SkillPackageRequest
): Promise<DownloadedSkillArtifact> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/client/skills/download`, {
    method: "POST",
    headers: {
      ...createAuthHeaders(config),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      skill_uuid: request.skillId,
      version: request.version
    })
  })
  const payload = parseDownloadPayload(await response.json())

  if (!response.ok) {
    throw new Error(`Failed to download skill package: ${response.status} ${response.statusText}`)
  }

  if (!payload.skill_uuid || !payload.version || !payload.encrypted_code) {
    throw new Error("Client download response is missing required fields")
  }

  assertNotExpired(payload.expires_at)

  const archiveBytes = Buffer.from(payload.encrypted_code, "base64")
  assertChecksum(archiveBytes, payload.checksum)

  const fileName =
    payload.download_filename ||
    `${sanitizeCacheSegment(request.skillId)}-${sanitizeCacheSegment(payload.version)}${
      payload.encryption_enabled ? ".encrypted.bin" : ".zip"
    }`
  const artifactPath = join(config.cacheDirectory, fileName)

  await writeFile(artifactPath, archiveBytes)

  return {
    artifactPath,
    encrypted: payload.encryption_enabled
  }
}

async function extractArchive(artifactPath: string, extractedPath: string): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Archive extraction is currently implemented for Windows desktop only")
  }

  const escapedArtifactPath = artifactPath.replace(/'/g, "''")
  const escapedExtractedPath = extractedPath.replace(/'/g, "''")

  try {
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -LiteralPath '${escapedArtifactPath}' -DestinationPath '${escapedExtractedPath}' -Force`
      ],
      {
        windowsHide: true
      }
    )
  } catch (error) {
    throw new Error(`Failed to extract downloaded skill package: ${getErrorMessage(error)}`)
  }
}

function getEnabledAgentIds(config: DesktopRuntimeConfig): AgentId[] {
  return listAgentAdapters()
    .map((adapter) => adapter.id)
    .filter((agentId) => Boolean(config.agentSkillsPaths[agentId]))
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
  const runtimeConfigManager = createRuntimeConfigManager()
  const initialRuntimeState = await runtimeConfigManager.reload()
  const getRuntimeConfig = () => runtimeConfigManager.getState().config

  if (initialRuntimeState.bootstrap.warning) {
    console.warn(initialRuntimeState.bootstrap.warning)
  }

  stateStore = await createSqliteStateStore(appPaths.stateDbPath)

  tray = new Tray(createTrayImage())
  tray.setToolTip("SkillHub Desktop - starting up")

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
      tray?.setToolTip("SkillHub Desktop - sync unavailable")
    }
  })
  const packageService = createPackageService({
    downloadArtifact: (request) => downloadSkillArtifact(getRuntimeConfig(), request),
    extractArtifact: (artifact, extractedPath) => extractArchive(artifact.artifactPath, extractedPath),
    createTempDirectory: async () => mkdtemp(join(tmpdir(), "open-skillhub-package-"))
  })
  const distributionService = createDistributionService({
    packageService,
    stateStore,
    resolveAgentAdapter: (agentId) => getAgentAdapter(agentId as AgentId),
    resolveInstallContext: (agentId) => {
      const skillsPath = getRuntimeConfig().agentSkillsPaths[agentId as AgentId]
      return skillsPath ? { skillsPath } : null
    }
  })

  stopPolling = pollingController.stop

  Menu.setApplicationMenu(null)

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open Open SkillHub",
        click: () => showMainWindow()
      },
      {
        label: "Refresh now",
        click: () => {
          void pollingController.refreshNow().catch((error: unknown) => {
            console.error("Manual sync failed", error)
            tray?.setToolTip("SkillHub Desktop - sync unavailable")
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
      tray?.setToolTip("SkillHub Desktop - configure API token")
      return
    }

    await pollingController.start()
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
        tray?.setToolTip("SkillHub Desktop - sync unavailable")
      }

      return toConfigurationState(nextState)
    },
    saveLocale: async (locale: AppLocale): Promise<ConfigurationState> => {
      const nextState = await runtimeConfigManager.saveLocale(locale)

      return toConfigurationState(nextState)
    },
    clearConfiguration: async (): Promise<ConfigurationState> => {
      const nextState = await runtimeConfigManager.clearConfiguration()
      pollingController.stop()
      tray?.setToolTip("SkillHub Desktop - configure API token")

      return toConfigurationState(nextState)
    },
    testConnection: (payload: ConfigurationPayload) =>
      testApiConnection(payload, getRuntimeConfig().apiToken),
    refreshSync: () => pollingController.refreshNow(),
    distributePendingUpdate: async (pendingUpdateId: string): Promise<SkillDistributionResult> => {
      const normalizedPendingUpdateId = pendingUpdateId.trim()

      if (!normalizedPendingUpdateId) {
        throw new Error("pendingUpdateId cannot be empty")
      }

      const currentState = await stateStore?.readState()

      if (!currentState) {
        throw new Error("State store unavailable")
      }

      const pendingUpdate = currentState.pendingUpdates.find(
        (update) =>
          update.remoteSkillId === normalizedPendingUpdateId || update.name === normalizedPendingUpdateId
      )

      if (!pendingUpdate) {
        throw new Error(`Unknown pending update: ${normalizedPendingUpdateId}`)
      }

      const enabledAgentIds = getEnabledAgentIds(getRuntimeConfig())

      if (enabledAgentIds.length === 0) {
        throw new Error(
          "No supported agent skills directories were detected. Configure OPEN_SKILLHUB_*_SKILLS_PATH to continue."
        )
      }

      const result = await distributionService.distribute({
        skillId: pendingUpdate.remoteSkillId,
        name: pendingUpdate.name,
        version: pendingUpdate.remoteVersion,
        packageSource: {
          source: "client-download"
        },
        enabledAgentIds
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
    tray.setToolTip("SkillHub Desktop - sync unavailable")
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
