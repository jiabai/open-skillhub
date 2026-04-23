import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "@/app/App"
import { desktopClient } from "@/lib/ipc-client"

type MockDesktopClientBridge = {
  getConfiguration: ReturnType<typeof vi.fn>
  saveConfiguration: ReturnType<typeof vi.fn>
  clearConfiguration: ReturnType<typeof vi.fn>
  testConnection: ReturnType<typeof vi.fn>
  refreshSync: ReturnType<typeof vi.fn>
  distributePendingUpdate: ReturnType<typeof vi.fn>
}

const mockDesktopClient = {
  getConfiguration: vi.fn(),
  saveConfiguration: vi.fn(),
  clearConfiguration: vi.fn(),
  testConnection: vi.fn(),
  refreshSync: vi.fn(),
  distributePendingUpdate: vi.fn()
} satisfies MockDesktopClientBridge

const configuredState = {
  apiBaseUrl: "http://localhost:8001",
  hasToken: true,
  tokenSource: "secret-store" as const,
  persistedEnvironmentToken: false,
  secretStoreAvailable: true
}

beforeEach(() => {
  mockDesktopClient.getConfiguration.mockResolvedValue(configuredState)
  mockDesktopClient.saveConfiguration.mockResolvedValue(configuredState)
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
    expect(window.desktopClient?.clearConfiguration).toBeTypeOf("function")
    expect(window.desktopClient?.testConnection).toBeTypeOf("function")
    expect(window.desktopClient?.refreshSync).toBeTypeOf("function")
    expect(window.desktopClient?.distributePendingUpdate).toBeTypeOf("function")
  })

  it("proxies the preload bridge through the renderer wrapper", async () => {
    mockDesktopClient.getConfiguration.mockResolvedValue(configuredState)
    mockDesktopClient.saveConfiguration.mockResolvedValue(configuredState)
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
    await expect(desktopClient.clearConfiguration()).resolves.toEqual({
      ...configuredState,
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
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [],
      lastRefreshedAt: "2026-04-23T00:00:00.000Z"
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "API token" })).toBeInTheDocument()
    })
    expect(mockDesktopClient.refreshSync).not.toHaveBeenCalled()

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
      expect(screen.getByRole("heading", { name: "Pending updates" })).toBeInTheDocument()
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

    expect(screen.getByRole("heading", { name: "Pending updates" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Review snapshot" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Distribution targets" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Review controls" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Recent actions" })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("Skill A")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Distribute Skill A" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Distribute Skill A" }))

    await waitFor(() => {
      expect(mockDesktopClient.distributePendingUpdate).toHaveBeenCalledWith("skill-a")
      expect(screen.getByText("Distribution completed")).toBeInTheDocument()
      expect(screen.getByText("No pending updates are waiting for review.")).toBeInTheDocument()
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

    await waitFor(() => {
      expect(screen.getByText("Distribution completed with warnings")).toBeInTheDocument()
      expect(
        screen.getByText("Skill A reached 1 agent target, but failed on gemini-cli.")
      ).toBeInTheDocument()
    })
  })
})
