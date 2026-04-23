import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
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
  type RuntimeConfigurationState,
  validateApiBaseUrl
} from "@/core/runtime/runtime-config-manager"
import { ensureAppDirectories } from "@/core/storage/app-paths"
import { createSqliteStateStore } from "@/core/storage/state-db"
import { createSyncPollingController, createSyncService } from "@/core/sync/sync-service"
import type {
  ConfigurationPayload,
  ConfigurationState,
  ConnectionTestResult,
  DesktopSyncState,
  DownloadedSkillArtifact,
  RemoteSkillSummary,
  SkillDistributionResult,
  SkillPackageRequest
} from "@/types"
import { registerDesktopClientIpc } from "./ipc"

const preloadPath = fileURLToPath(new URL("./preload.js", import.meta.url))
const execFileAsync = promisify(execFile)

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
    hasToken: Boolean(state.config.apiToken),
    tokenSource: state.bootstrap.source,
    persistedEnvironmentToken: state.bootstrap.persistedEnvironmentToken,
    secretStoreAvailable: state.bootstrap.secretStoreAvailable,
    warning: state.bootstrap.warning ?? undefined
  }
}

async function testApiConnection(
  payload: ConfigurationPayload,
  fallbackToken?: string | null
): Promise<ConnectionTestResult> {
  let apiBaseUrl: string

  try {
    apiBaseUrl = validateApiBaseUrl(payload.apiBaseUrl)
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error)
    }
  }

  const apiToken = payload.apiToken.trim() || fallbackToken?.trim() || ""

  if (!apiToken) {
    return {
      ok: false,
      message: "API token is required."
    }
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/client/skills?limit=1`, {
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    })

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: `Connection failed: ${response.status} ${response.statusText}`
      }
    }

    return {
      ok: true,
      status: response.status,
      message: "Connection succeeded."
    }
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error)
    }
  }
}

function createTrayImage() {
  const svg = Buffer.from(
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#60a5fa"/>
            <stop offset="100%" stop-color="#34d399"/>
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="48" height="48" rx="14" fill="#0f172a"/>
        <path d="M18 38c0-8 6.5-14 14-14s14 6 14 14" fill="none" stroke="url(#g)" stroke-width="6" stroke-linecap="round"/>
        <circle cx="32" cy="20" r="5" fill="#f8fafc"/>
        <circle cx="25" cy="28" r="3" fill="#93c5fd"/>
        <circle cx="39" cy="28" r="3" fill="#6ee7b7"/>
      </svg>
    `.trim()
  ).toString("base64")

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${svg}`)
}

function createWindowIcon() {
  // Embedded 256x256 icon for window/taskbar
  const svg = Buffer.from(
    `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#60a5fa"/>
            <stop offset="100%" stop-color="#34d399"/>
          </linearGradient>
        </defs>
        <rect x="32" y="32" width="192" height="192" rx="56" fill="#0f172a"/>
        <path d="M72 152c0-32 26-56 56-56s56 24 56 56" fill="none" stroke="url(#grad)" stroke-width="24" stroke-linecap="round"/>
        <circle cx="128" cy="80" r="20" fill="#f8fafc"/>
        <circle cx="100" cy="112" r="12" fill="#93c5fd"/>
        <circle cx="156" cy="112" r="12" fill="#6ee7b7"/>
      </svg>
    `.trim()
  ).toString("base64")

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${svg}`)
}

function createNotification(payload: TrayNotificationPayload): void {
  if (Notification.isSupported()) {
    new Notification(payload).show()
  }
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    backgroundColor: "#0b1020",
    icon: createWindowIcon(),
    show: true,
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

  const refreshWindow = () => {
    if (!mainWindow) {
      mainWindow = createWindow()
      configureWindowLifecycle(mainWindow)
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.show()
    mainWindow.focus()
  }

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open Open SkillHub",
        click: () => refreshWindow()
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

  tray.on("double-click", () => refreshWindow())
  tray.on("click", () => refreshWindow())

  mainWindow = createWindow()
  configureWindowLifecycle(mainWindow)

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

app.setAppUserModelId("OpenSkillHub")

app.whenReady().then(() => {
  void createApplicationServices().catch((error: unknown) => {
    console.error("Failed to bootstrap the desktop client", error)
    app.exit(1)
  })

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      configureWindowLifecycle(mainWindow)
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
})

app.on("before-quit", () => {
  isQuitting = true
  stopPolling?.()
  void closeStateStore()
})
