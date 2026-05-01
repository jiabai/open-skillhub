import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "@/app/App"
import { desktopClient } from "@/lib/ipc-client"

type MockDesktopClientBridge = {
  getConfiguration: ReturnType<typeof vi.fn>
  saveConfiguration: ReturnType<typeof vi.fn>
  saveLocale: ReturnType<typeof vi.fn>
  clearConfiguration: ReturnType<typeof vi.fn>
  testConnection: ReturnType<typeof vi.fn>
  refreshSync: ReturnType<typeof vi.fn>
  refreshAgentDetection: ReturnType<typeof vi.fn>
  refreshPreDistributionCheck: ReturnType<typeof vi.fn>
  reconcileInstalledSkill: ReturnType<typeof vi.fn>
  distributePendingUpdate: ReturnType<typeof vi.fn>
}

const mockDesktopClient = {
  getConfiguration: vi.fn(),
  saveConfiguration: vi.fn(),
  saveLocale: vi.fn(),
  clearConfiguration: vi.fn(),
  testConnection: vi.fn(),
  refreshSync: vi.fn(),
  refreshAgentDetection: vi.fn(),
  refreshPreDistributionCheck: vi.fn(),
  reconcileInstalledSkill: vi.fn(),
  distributePendingUpdate: vi.fn()
} satisfies MockDesktopClientBridge

const configuredState = {
  apiBaseUrl: "http://localhost:8001",
  locale: "en-US" as const,
  hasToken: true,
  tokenSource: "secret-store" as const,
  persistedEnvironmentToken: false,
  secretStoreAvailable: true
}

const defaultAgentDetection = {
  checkedAt: "2026-04-28T00:00:00.000Z",
  supportedAgentCount: 20,
  installedAgentIds: ["codex", "claude-code"],
  agentStatuses: [
    {
      agentId: "codex",
      displayName: "Codex",
      installed: true,
      source: "auto-detected",
      detectionDirs: ["C:\\Users\\test\\.codex"],
      targetPaths: ["C:\\Users\\test\\.codex\\skills"],
      compatibleReadPaths: ["C:\\Users\\test\\.agents\\skills"],
      reason: null
    },
    {
      agentId: "claude-code",
      displayName: "Claude Code",
      installed: true,
      source: "environment",
      detectionDirs: ["C:\\Users\\test\\.claude"],
      targetPaths: ["D:\\Claude\\skills"],
      compatibleReadPaths: [],
      reason: null
    },
    {
      agentId: "gemini-cli",
      displayName: "Gemini CLI",
      installed: false,
      source: "missing",
      detectionDirs: ["C:\\Users\\test\\.gemini"],
      targetPaths: [],
      compatibleReadPaths: [],
      reason: "No detection directory found."
    }
  ],
  uniqueTargets: [
    {
      targetId: "target-codex",
      targetPath: "C:\\Users\\test\\.codex\\skills",
      primaryAgentId: "codex",
      coveredAgentIds: ["codex"],
      sharedPathKey: null,
      source: "auto-detected"
    },
    {
      targetId: "target-claude",
      targetPath: "D:\\Claude\\skills",
      primaryAgentId: "claude-code",
      coveredAgentIds: ["claude-code"],
      sharedPathKey: null,
      source: "environment"
    }
  ]
}

beforeEach(() => {
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: "en-US"
  })
  mockDesktopClient.getConfiguration.mockResolvedValue(configuredState)
  mockDesktopClient.saveConfiguration.mockResolvedValue(configuredState)
  mockDesktopClient.saveLocale.mockResolvedValue(configuredState)
  mockDesktopClient.clearConfiguration.mockResolvedValue({
    ...configuredState,
    hasToken: false,
    tokenSource: "missing" as const
  })
  mockDesktopClient.testConnection.mockResolvedValue({
    ok: true,
    status: 200,
    message: "Connection succeeded."
  })
  mockDesktopClient.refreshPreDistributionCheck.mockResolvedValue({
    results: {},
    checkedAt: "2026-04-17T00:00:00.000Z",
    expiresAt: "2099-04-17T00:00:00.000Z",
    pendingUpdateFingerprint: "",
    targetAgentIds: [],
    totalDurationMs: 0,
    globalErrors: []
  })
  mockDesktopClient.refreshAgentDetection.mockResolvedValue(defaultAgentDetection)
  mockDesktopClient.reconcileInstalledSkill.mockResolvedValue({
    localRecords: [],
    pendingUpdates: [],
    successfulDistributionCount: 0,
    lastRefreshedAt: "2026-04-17T00:00:00.000Z"
  })

  Object.defineProperty(window, "desktopClient", {
    configurable: true,
    value: mockDesktopClient
  })
})

afterEach(() => {
  delete window.desktopClient
  vi.clearAllMocks()
})

describe("App", () => {
  it("exposes a desktop client API surface", () => {
    expect(window.desktopClient).toBeDefined()
    expect(window.desktopClient?.getConfiguration).toBeTypeOf("function")
    expect(window.desktopClient?.saveConfiguration).toBeTypeOf("function")
    expect(window.desktopClient?.saveLocale).toBeTypeOf("function")
    expect(window.desktopClient?.clearConfiguration).toBeTypeOf("function")
    expect(window.desktopClient?.testConnection).toBeTypeOf("function")
    expect(window.desktopClient?.refreshSync).toBeTypeOf("function")
    expect(window.desktopClient?.refreshAgentDetection).toBeTypeOf("function")
    expect(window.desktopClient?.refreshPreDistributionCheck).toBeTypeOf("function")
    expect(window.desktopClient?.reconcileInstalledSkill).toBeTypeOf("function")
    expect(window.desktopClient?.distributePendingUpdate).toBeTypeOf("function")
  })

  it("surfaces a bridge unavailable error when configuration actions run outside Electron", async () => {
    delete window.desktopClient

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Desktop bridge unavailable")
    })

    fireEvent.click(screen.getByRole("button", { name: "Configure API" }))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "API token" })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/API Token/), {
      target: { value: "ask_live_saved" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }))

    await waitFor(() => {
      expect(
        screen.getByText(
          "Desktop bridge unavailable. Launch the Electron runtime with `npm run start:electron` to save configuration."
        )
      ).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))

    await waitFor(() => {
      expect(
        screen.getByText(
          "Desktop bridge unavailable. Launch the Electron runtime with `npm run start:electron` to test the connection."
        )
      ).toBeInTheDocument()
    })
  })

  it("proxies the preload bridge through the renderer wrapper", async () => {
    mockDesktopClient.getConfiguration.mockResolvedValue(configuredState)
    mockDesktopClient.saveConfiguration.mockResolvedValue(configuredState)
    mockDesktopClient.saveLocale.mockResolvedValue({
      ...configuredState,
      locale: "zh-CN"
    })
    mockDesktopClient.clearConfiguration.mockResolvedValue({
      ...configuredState,
      hasToken: false,
      tokenSource: "missing" as const
    })
    mockDesktopClient.testConnection.mockResolvedValue({
      ok: true,
      status: 200,
      message: "Connection succeeded."
    })
    mockDesktopClient.refreshSync.mockResolvedValue({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: null
    })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValue({
      results: {},
      checkedAt: "2026-04-17T00:00:00.000Z",
      expiresAt: "2099-04-17T00:00:00.000Z",
      pendingUpdateFingerprint: "",
      targetAgentIds: [],
      totalDurationMs: 0,
      globalErrors: []
    })
    mockDesktopClient.refreshAgentDetection.mockResolvedValue(defaultAgentDetection)
    mockDesktopClient.reconcileInstalledSkill.mockResolvedValue({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: null
    })
    mockDesktopClient.distributePendingUpdate.mockResolvedValue({
      skillId: "skill-a",
      name: "Skill A",
      version: "1.0.0",
      extractedPath: null,
      targets: [{ agentId: "codex", success: true, errorMessage: null }],
      succeededAgentIds: ["codex"],
      failedAgentIds: [],
      syncedToLocalState: true
    })

    await expect(desktopClient.getConfiguration()).resolves.toEqual(configuredState)
    await expect(
      desktopClient.saveConfiguration({
        apiBaseUrl: "http://localhost:8001",
        apiToken: "ask_live"
      })
    ).resolves.toEqual(configuredState)
    await expect(desktopClient.saveLocale("zh-CN")).resolves.toEqual({
      ...configuredState,
      locale: "zh-CN"
    })
    await expect(desktopClient.clearConfiguration()).resolves.toEqual({
      ...configuredState,
      locale: "en-US",
      hasToken: false,
      tokenSource: "missing"
    })
    await expect(
      desktopClient.testConnection({
        apiBaseUrl: "http://localhost:8001",
        apiToken: "ask_live"
      })
    ).resolves.toEqual({
      ok: true,
      status: 200,
      message: "Connection succeeded."
    })
    await expect(desktopClient.refreshSync()).resolves.toEqual({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: null
    })
    await expect(desktopClient.refreshAgentDetection()).resolves.toEqual(defaultAgentDetection)
    await expect(desktopClient.refreshPreDistributionCheck()).resolves.toEqual({
      results: {},
      checkedAt: "2026-04-17T00:00:00.000Z",
      expiresAt: "2099-04-17T00:00:00.000Z",
      pendingUpdateFingerprint: "",
      targetAgentIds: [],
      totalDurationMs: 0,
      globalErrors: []
    })
    await expect(desktopClient.reconcileInstalledSkill("skill-a")).resolves.toEqual({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: null
    })
    await expect(desktopClient.distributePendingUpdate("skill-a")).resolves.toEqual({
      skillId: "skill-a",
      name: "Skill A",
      version: "1.0.0",
      extractedPath: null,
      targets: [{ agentId: "codex", success: true, errorMessage: null }],
      succeededAgentIds: ["codex"],
      failedAgentIds: [],
      syncedToLocalState: true
    })

    expect(mockDesktopClient.getConfiguration).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.saveConfiguration).toHaveBeenCalledWith({
      apiBaseUrl: "http://localhost:8001",
      apiToken: "ask_live"
    })
    expect(mockDesktopClient.saveLocale).toHaveBeenCalledWith("zh-CN")
    expect(mockDesktopClient.clearConfiguration).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.testConnection).toHaveBeenCalledWith({
      apiBaseUrl: "http://localhost:8001",
      apiToken: "ask_live"
    })
    expect(mockDesktopClient.refreshSync).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.refreshAgentDetection).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.refreshPreDistributionCheck).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.reconcileInstalledSkill).toHaveBeenCalledWith("skill-a")
    expect(mockDesktopClient.distributePendingUpdate).toHaveBeenCalledWith("skill-a")
  })

  it("shows API configuration before sync when no token is available", async () => {
    mockDesktopClient.getConfiguration.mockResolvedValueOnce({
      ...configuredState,
      hasToken: false,
      tokenSource: "missing" as const
    })
    mockDesktopClient.saveConfiguration.mockResolvedValueOnce(configuredState)
    mockDesktopClient.saveLocale.mockResolvedValueOnce(configuredState)
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-23T00:00:00.000Z"
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText("API token needed")).toBeInTheDocument()
    })
    expect(mockDesktopClient.refreshSync).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Configure API" }))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "API token" })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/API Token/), {
      target: { value: "ask_live_saved" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Save configuration" }))

    await waitFor(() => {
      expect(mockDesktopClient.saveConfiguration).toHaveBeenCalledWith({
        apiBaseUrl: "http://localhost:8001",
        apiToken: "ask_live_saved"
      })
      expect(mockDesktopClient.refreshSync).toHaveBeenCalledTimes(1)
      expect(screen.getByRole("heading", { name: "Needs review" })).toBeInTheDocument()
    })
  })

  it("persists a language switch through the locale bridge", async () => {
    mockDesktopClient.getConfiguration.mockResolvedValueOnce(configuredState)
    mockDesktopClient.saveLocale = vi.fn(async () => ({
      ...configuredState,
      locale: "zh-CN"
    }))
    Object.defineProperty(window, "desktopClient", {
      configurable: true,
      value: mockDesktopClient
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Settings" })[0]).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0])

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Desktop settings" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Switch to Chinese" }))

    await waitFor(() => {
      expect(mockDesktopClient.saveLocale).toHaveBeenCalledWith("zh-CN")
      expect(screen.getByRole("heading", { name: "审核更新" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "切换到中文" })).toBeInTheDocument()
    })
  })

  it("keeps the home page focused and moves the full queue to Updates", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "missing-local-record"
        },
        {
          remoteSkillId: "skill-b",
          name: "Skill B",
          localVersion: "1.0.0",
          remoteVersion: "1.1.0",
          reason: "version-mismatch"
        },
        {
          remoteSkillId: "skill-c",
          name: "Skill C",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "missing-local-record"
        },
        {
          remoteSkillId: "skill-d",
          name: "Skill D",
          localVersion: "1.0.0",
          remoteVersion: "2.0.0",
          reason: "version-mismatch"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Needs review" })).toBeInTheDocument()
      expect(screen.getByText("Skill A")).toBeInTheDocument()
      expect(screen.getByText("Skill C")).toBeInTheDocument()
    })

    expect(screen.queryByText("Skill D")).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Distribution targets" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Recent actions" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "All pending updates" })).toBeInTheDocument()
      expect(screen.getByText("Skill D")).toBeInTheDocument()
    })
  })

  it("shows detected agent counts and dynamic agent status", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })
    mockDesktopClient.refreshAgentDetection.mockResolvedValueOnce(defaultAgentDetection)

    render(<App />)

    await waitFor(() => {
      expect(mockDesktopClient.refreshAgentDetection).toHaveBeenCalledTimes(1)
      expect(screen.getByText("Installed agents")).toBeInTheDocument()
      expect(screen.getByText("2")).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0])

    await waitFor(() => {
      expect(screen.getByText("Claude Code")).toBeInTheDocument()
      expect(screen.getByText("Configured by environment")).toBeInTheDocument()
      expect(screen.getByText(/D:\\Claude\\skills/)).toBeInTheDocument()
      expect(screen.getByText("Gemini CLI")).toBeInTheDocument()
      expect(screen.getAllByText("Not installed").length).toBeGreaterThan(0)
    })
  })

  it("runs a pre-distribution check after loading pending updates", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: "2.0.0",
          remoteVersion: "1.0.0",
          reason: "version-mismatch"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce({
      results: {
        "skill-a": {
          codex: {
            agentId: "codex",
            displayName: "Codex",
            skillDir: "C:\\Users\\test\\.codex\\skills\\skill-a",
            exists: true,
            installedVersion: "2.0.0",
            installedVersionSource: "skill-frontmatter",
            remoteVersion: "1.0.0",
            installedVersionFormat: "semver",
            remoteVersionFormat: "semver",
            versionComparison: "installed-newer",
            checkedAt: "2026-04-17T00:00:01.000Z",
            durationMs: 4,
            errorCode: null,
            errorMessage: null
          }
        }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0",
      targetAgentIds: ["codex"],
      totalDurationMs: 4,
      globalErrors: []
    })

    render(<App />)

    await waitFor(() => {
      expect(mockDesktopClient.refreshPreDistributionCheck).toHaveBeenCalledTimes(1)
      expect(screen.getByText("Review target warnings before distributing.")).toBeInTheDocument()
      expect(screen.getByText("Codex: 2.0.0")).toBeInTheDocument()
    })
  })

  it("does not show stale pre-distribution claims when the fingerprint mismatches", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "missing-local-record"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce({
      results: {
        "skill-old": {
          codex: {
            agentId: "codex",
            displayName: "Codex",
            skillDir: "C:\\Users\\test\\.codex\\skills\\skill-old",
            exists: true,
            installedVersion: "9.0.0",
            installedVersionSource: "skill-frontmatter",
            remoteVersion: "1.0.0",
            installedVersionFormat: "semver",
            remoteVersionFormat: "semver",
            versionComparison: "installed-newer",
            checkedAt: "2026-04-17T00:00:01.000Z",
            durationMs: 4,
            errorCode: null,
            errorMessage: null
          }
        }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-old@1.0.0",
      targetAgentIds: ["codex"],
      totalDurationMs: 4,
      globalErrors: []
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText("Refresh check to read installed target versions before distribution.")).toBeInTheDocument()
      expect(screen.queryByText("Codex: 9.0.0")).not.toBeInTheDocument()
    })
  })

  it("syncs the local record instead of distributing when every target already has the remote version", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "missing-local-record"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce({
      results: {
        "skill-a": {
          codex: {
            agentId: "codex",
            displayName: "Codex",
            skillDir: "C:\\Users\\test\\.codex\\skills\\skill-a",
            exists: true,
            installedVersion: "1.0.0",
            installedVersionSource: "skill-frontmatter",
            remoteVersion: "1.0.0",
            installedVersionFormat: "semver",
            remoteVersionFormat: "semver",
            versionComparison: "same",
            checkedAt: "2026-04-17T00:00:01.000Z",
            durationMs: 4,
            errorCode: null,
            errorMessage: null
          }
        }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0",
      targetAgentIds: ["codex"],
      totalDurationMs: 4,
      globalErrors: []
    })
    mockDesktopClient.reconcileInstalledSkill.mockResolvedValueOnce({
      localRecords: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          installedVersion: "1.0.0",
          remoteVersion: "1.0.0",
          lastComparedAt: "2026-04-17T00:00:05.000Z"
        }
      ],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:05.000Z"
    })

    render(<App />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sync local record for Skill A" })
      ).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Distribute Skill A" })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Sync local record for Skill A" }))

    await waitFor(() => {
      expect(mockDesktopClient.reconcileInstalledSkill).toHaveBeenCalledWith("skill-a")
      expect(mockDesktopClient.distributePendingUpdate).not.toHaveBeenCalled()
      expect(screen.getByText("No pending updates are waiting for review.")).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0])

    await waitFor(() => {
      expect(screen.getByText("Local record synced")).toBeInTheDocument()
    })
  })

  it("refreshes the pre-distribution check without reloading the remote queue", async () => {
    mockDesktopClient.refreshSync.mockResolvedValue({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "missing-local-record"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValue({
      results: {},
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0",
      targetAgentIds: [],
      totalDurationMs: 1,
      globalErrors: ["No configured agent skill directories are available for pre-distribution checks."]
    })

    render(<App />)

    await waitFor(() => {
      expect(mockDesktopClient.refreshSync).toHaveBeenCalledTimes(1)
      expect(mockDesktopClient.refreshPreDistributionCheck).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh Check" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Refresh Check" }))

    await waitFor(() => {
      expect(mockDesktopClient.refreshSync).toHaveBeenCalledTimes(1)
      expect(mockDesktopClient.refreshPreDistributionCheck).toHaveBeenCalledTimes(2)
    })
  })

  it("centers pending updates and drives the distribute flow", async () => {
    mockDesktopClient.refreshSync
      .mockResolvedValueOnce({
        localRecords: [],
        pendingUpdates: [
          {
            remoteSkillId: "skill-a",
            name: "Skill A",
            localVersion: null,
            remoteVersion: "1.0.0",
            reason: "missing-local-record"
          }
        ],
        successfulDistributionCount: 0,
        lastRefreshedAt: "2026-04-17T00:00:00.000Z"
      })
      .mockResolvedValueOnce({
        localRecords: [
          {
            remoteSkillId: "skill-a",
            name: "Skill A",
            installedVersion: "1.0.0",
            remoteVersion: "1.0.0",
            lastComparedAt: "2026-04-17T00:00:05.000Z"
          }
        ],
        pendingUpdates: [],
        successfulDistributionCount: 1,
        lastRefreshedAt: "2026-04-17T00:00:05.000Z"
      })

    mockDesktopClient.distributePendingUpdate.mockResolvedValue({
      skillId: "skill-a",
      name: "Skill A",
      version: "1.0.0",
      extractedPath: null,
      targets: [{ agentId: "codex", success: true, errorMessage: null }],
      succeededAgentIds: ["codex"],
      failedAgentIds: [],
      syncedToLocalState: true
    })

    render(<App />)

    expect(screen.getByRole("heading", { name: "Review updates" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Updates" })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("Skill A")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Distribute Skill A" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Distribute Skill A" }))

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Confirm distribution" })).toBeInTheDocument()
      expect(screen.getByText("Will write to")).toBeInTheDocument()
      expect(screen.getByText(/Codex/)).toBeInTheDocument()
      expect(screen.getByText(/Claude Code/)).toBeInTheDocument()
      expect(screen.getByText("Missing assistants skipped")).toBeInTheDocument()
      expect(screen.getByText("Gemini CLI")).toBeInTheDocument()
      expect(mockDesktopClient.distributePendingUpdate).not.toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole("button", { name: "Confirm distribution" }))

    await waitFor(() => {
      expect(mockDesktopClient.distributePendingUpdate).toHaveBeenCalledWith("skill-a")
      expect(screen.getByText("No pending updates are waiting for review.")).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0])

    await waitFor(() => {
      expect(screen.getByText("Distribution completed")).toBeInTheDocument()
    })
  })

  it("renders distribution confirmation actions in the dialog footer", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "missing-local-record"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Distribute Skill A" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Distribute Skill A" }))

    const dialog = await screen.findByRole("dialog", { name: "Confirm distribution" })
    const body = dialog.querySelector(".dialog-panel__body")
    const footer = dialog.querySelector(".dialog-panel__footer")
    const cancelButton = screen.getByRole("button", { name: "Cancel" })
    const confirmButton = screen.getByRole("button", { name: "Confirm distribution" })

    expect(body).not.toContainElement(cancelButton)
    expect(body).not.toContainElement(confirmButton)
    expect(footer).toContainElement(cancelButton)
    expect(footer).toContainElement(confirmButton)
    expect(mockDesktopClient.distributePendingUpdate).not.toHaveBeenCalled()
  })

  it("keeps a successful distribution distinct from a refresh failure", async () => {
    mockDesktopClient.refreshSync
      .mockResolvedValueOnce({
        localRecords: [],
        pendingUpdates: [
          {
            remoteSkillId: "skill-a",
            name: "Skill A",
            localVersion: null,
            remoteVersion: "1.0.0",
            reason: "missing-local-record"
          }
        ],
        successfulDistributionCount: 0,
        lastRefreshedAt: "2026-04-17T00:00:00.000Z"
      })
      .mockRejectedValueOnce(new Error("refresh unavailable"))

    mockDesktopClient.distributePendingUpdate.mockResolvedValue({
      skillId: "skill-a",
      name: "Skill A",
      version: "1.0.0",
      extractedPath: null,
      targets: [{ agentId: "codex", success: true, errorMessage: null }],
      succeededAgentIds: ["codex"],
      failedAgentIds: [],
      syncedToLocalState: true
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Distribute Skill A" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Distribute Skill A" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm distribution" }))

    fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0])

    await waitFor(() => {
      expect(screen.getByText("Distribution completed with refresh warning")).toBeInTheDocument()
      expect(
        screen.getByText(
          "Skill A was sent to 1 configured agent target. Refreshing the review snapshot then failed: refresh unavailable"
        )
      ).toBeInTheDocument()
    })
  })

  it("surfaces partial distribution results as warnings", async () => {
    mockDesktopClient.refreshSync
      .mockResolvedValueOnce({
        localRecords: [],
        pendingUpdates: [
          {
            remoteSkillId: "skill-a",
            name: "Skill A",
            localVersion: null,
            remoteVersion: "1.0.0",
            reason: "missing-local-record"
          }
        ],
        successfulDistributionCount: 0,
        lastRefreshedAt: "2026-04-17T00:00:00.000Z"
      })
      .mockResolvedValueOnce({
        localRecords: [],
        pendingUpdates: [
          {
            remoteSkillId: "skill-a",
            name: "Skill A",
            localVersion: null,
            remoteVersion: "1.0.0",
            reason: "missing-local-record"
          }
        ],
        successfulDistributionCount: 0,
        lastRefreshedAt: "2026-04-17T00:00:05.000Z"
      })

    mockDesktopClient.distributePendingUpdate.mockResolvedValue({
      skillId: "skill-a",
      name: "Skill A",
      version: "1.0.0",
      extractedPath: null,
      targets: [
        { agentId: "codex", success: true, errorMessage: null },
        { agentId: "gemini-cli", success: false, errorMessage: "Invalid install path" }
      ],
      succeededAgentIds: ["codex"],
      failedAgentIds: ["gemini-cli"],
      syncedToLocalState: false
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Distribute Skill A" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Distribute Skill A" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm distribution" }))

    fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0])

    await waitFor(() => {
      expect(screen.getByText("Distribution completed with warnings")).toBeInTheDocument()
      expect(
        screen.getByText("Skill A reached 1 agent target, but failed on gemini-cli.")
      ).toBeInTheDocument()
    })
  })
})
