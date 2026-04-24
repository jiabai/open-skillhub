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
  distributePendingUpdate: ReturnType<typeof vi.fn>
}

const mockDesktopClient = {
  getConfiguration: vi.fn(),
  saveConfiguration: vi.fn(),
  saveLocale: vi.fn(),
  clearConfiguration: vi.fn(),
  testConnection: vi.fn(),
  refreshSync: vi.fn(),
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
      expect(mockDesktopClient.distributePendingUpdate).toHaveBeenCalledWith("skill-a")
      expect(screen.getByText("No pending updates are waiting for review.")).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0])

    await waitFor(() => {
      expect(screen.getByText("Distribution completed")).toBeInTheDocument()
    })
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

    fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0])

    await waitFor(() => {
      expect(screen.getByText("Distribution completed with warnings")).toBeInTheDocument()
      expect(
        screen.getByText("Skill A reached 1 agent target, but failed on gemini-cli.")
      ).toBeInTheDocument()
    })
  })
})
