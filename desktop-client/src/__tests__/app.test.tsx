import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { App } from "@/app/App"
import { desktopClient } from "@/lib/ipc-client"

type MockDesktopClientBridge = {
  getConfiguration: ReturnType<typeof vi.fn>
  saveConfiguration: ReturnType<typeof vi.fn>
  saveLocale: ReturnType<typeof vi.fn>
  saveTheme: ReturnType<typeof vi.fn>
  clearConfiguration: ReturnType<typeof vi.fn>
  testConnection: ReturnType<typeof vi.fn>
  getAgentPathsConfig: ReturnType<typeof vi.fn>
  saveAgentPathsConfig: ReturnType<typeof vi.fn>
  openAgentPathsConfigDir: ReturnType<typeof vi.fn>
  refreshSync: ReturnType<typeof vi.fn>
  refreshAgentDetection: ReturnType<typeof vi.fn>
  refreshPreDistributionCheck: ReturnType<typeof vi.fn>
  refreshLocalSkills: ReturnType<typeof vi.fn>
  uploadLocalSkill: ReturnType<typeof vi.fn>
  listProjects: ReturnType<typeof vi.fn>
  addProject: ReturnType<typeof vi.fn>
  renameProject: ReturnType<typeof vi.fn>
  removeProject: ReturnType<typeof vi.fn>
  selectProjectFolder: ReturnType<typeof vi.fn>
  openProjectFolder: ReturnType<typeof vi.fn>
  scanProjectSkills: ReturnType<typeof vi.fn>
  selectProjectSkillFolder: ReturnType<typeof vi.fn>
  validateProjectSkillFolder: ReturnType<typeof vi.fn>
  importProjectSkill: ReturnType<typeof vi.fn>
  reconcileInstalledSkill: ReturnType<typeof vi.fn>
  distributePendingUpdate: ReturnType<typeof vi.fn>
}

const mockDesktopClient = {
  getConfiguration: vi.fn(),
  saveConfiguration: vi.fn(),
  saveLocale: vi.fn(),
  saveTheme: vi.fn(),
  clearConfiguration: vi.fn(),
  testConnection: vi.fn(),
  getAgentPathsConfig: vi.fn(),
  saveAgentPathsConfig: vi.fn(),
  openAgentPathsConfigDir: vi.fn(),
  refreshSync: vi.fn(),
  refreshAgentDetection: vi.fn(),
  refreshPreDistributionCheck: vi.fn(),
  refreshLocalSkills: vi.fn(),
  uploadLocalSkill: vi.fn(),
  listProjects: vi.fn(),
  addProject: vi.fn(),
  renameProject: vi.fn(),
  removeProject: vi.fn(),
  selectProjectFolder: vi.fn(),
  openProjectFolder: vi.fn(),
  scanProjectSkills: vi.fn(),
  selectProjectSkillFolder: vi.fn(),
  validateProjectSkillFolder: vi.fn(),
  importProjectSkill: vi.fn(),
  reconcileInstalledSkill: vi.fn(),
  distributePendingUpdate: vi.fn()
} satisfies MockDesktopClientBridge

const configuredState = {
  apiBaseUrl: "http://localhost:8001",
  locale: "en-US" as const,
  theme: "dark" as const,
  hasToken: true,
  tokenSource: "secret-store" as const,
  persistedEnvironmentToken: false,
  secretStoreAvailable: true
}

const emptySyncState = {
  localRecords: [],
  pendingUpdates: [],
  successfulDistributionCount: 0,
  lastRefreshedAt: null
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
      source: "auto-detected",
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
      source: "auto-detected"
    }
  ]
}

const defaultLocalSkillsSnapshot = {
  checkedAt: "2026-05-02T00:00:00.000Z",
  rows: [
    {
      rowKey: "row-local-only",
      name: "local-only",
      localVersion: "0.1.0",
      packageRootPath: "C:\\Users\\test\\.agents\\skills\\local-only",
      sourceAgents: ["codex" as const],
      sourceDisplayNames: ["Codex"],
      validationState: "valid" as const,
      validationMessage: null,
      serverState: "missing" as const,
      remoteSkillId: null,
      remoteVersion: null,
      uploadable: true
    }
  ],
  serverLookupStatus: "ok" as const,
  serverLookupMessage: null
}

const defaultProjectsSnapshot = {
  checkedAt: "2026-05-07T00:00:00.000Z",
  projects: [
    {
      id: "project-1",
      name: "Example Project",
      path: "D:\\Projects\\Example",
      addedAt: "2026-05-07T00:00:00.000Z",
      updatedAt: "2026-05-07T00:00:00.000Z"
    }
  ]
}

const defaultProjectScanSnapshot = {
  projectId: "project-1",
  checkedAt: "2026-05-07T00:01:00.000Z",
  project: defaultProjectsSnapshot.projects[0],
  targets: [
    {
      targetId: "target-claude",
      targetPath: "D:\\Projects\\Example\\.claude\\skills",
      relativePath: ".claude\\skills",
      primaryAgentId: "claude-code" as const,
      coveredAgentIds: ["claude-code" as const],
      writableAgentIds: ["claude-code" as const],
      displayNames: ["Claude Code"],
      sharedPathKey: null,
      writable: true
    }
  ],
  rows: [
    {
      rowKey: "project-row",
      identity: "project-skill",
      version: "1.0.0",
      description: "Project skill",
      source: "project" as const,
      agentIds: ["claude-code" as const],
      sourceDisplayNames: ["Claude Code"],
      skillPath: "D:\\Projects\\Example\\.claude\\skills\\project-skill",
      relativePath: ".claude\\skills\\project-skill",
      validationState: "valid" as const,
      validationMessage: null
    },
    {
      rowKey: "global-row",
      identity: "global-only",
      version: "0.1.0",
      description: null,
      source: "global" as const,
      agentIds: ["codex" as const],
      sourceDisplayNames: ["Codex"],
      skillPath: "C:\\Users\\test\\.agents\\skills\\global-only",
      relativePath: null,
      validationState: "valid" as const,
      validationMessage: null
    }
  ],
  errors: []
}

beforeEach(() => {
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: "en-US"
  })
  mockDesktopClient.getConfiguration.mockResolvedValue(configuredState)
  mockDesktopClient.saveConfiguration.mockResolvedValue(configuredState)
  mockDesktopClient.saveLocale.mockResolvedValue(configuredState)
  mockDesktopClient.saveTheme.mockResolvedValue(configuredState)
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
  mockDesktopClient.getAgentPathsConfig.mockResolvedValue({})
  mockDesktopClient.saveAgentPathsConfig.mockResolvedValue({})
  mockDesktopClient.openAgentPathsConfigDir.mockResolvedValue(undefined)
  mockDesktopClient.refreshSync.mockResolvedValue(emptySyncState)
  mockDesktopClient.refreshPreDistributionCheck.mockResolvedValue({
    results: {},
    checkedAt: "2026-04-17T00:00:00.000Z",
    expiresAt: "2099-04-17T00:00:00.000Z",
    pendingUpdateFingerprint: "",
    targetAgentIds: [],
    totalDurationMs: 0,
    globalErrors: []
  })
  mockDesktopClient.refreshLocalSkills.mockResolvedValue(defaultLocalSkillsSnapshot)
  mockDesktopClient.uploadLocalSkill.mockResolvedValue({
    rowKey: "row-local-only",
    uploadedSkillId: "uploaded-skill",
    name: "local-only",
    version: "0.1.0",
    refreshedSnapshot: defaultLocalSkillsSnapshot
  })
  mockDesktopClient.listProjects.mockResolvedValue(defaultProjectsSnapshot)
  mockDesktopClient.addProject.mockResolvedValue(defaultProjectsSnapshot)
  mockDesktopClient.renameProject.mockResolvedValue(defaultProjectsSnapshot)
  mockDesktopClient.removeProject.mockResolvedValue({
    checkedAt: "2026-05-07T00:00:00.000Z",
    projects: []
  })
  mockDesktopClient.selectProjectFolder.mockResolvedValue({
    canceled: false,
    path: "D:\\Projects\\Example"
  })
  mockDesktopClient.openProjectFolder.mockResolvedValue(undefined)
  mockDesktopClient.scanProjectSkills.mockResolvedValue(defaultProjectScanSnapshot)
  mockDesktopClient.selectProjectSkillFolder.mockResolvedValue({
    canceled: false,
    path: "C:\\Users\\test\\.agents\\skills\\project-skill"
  })
  mockDesktopClient.validateProjectSkillFolder.mockResolvedValue({
    valid: true,
    identity: "project-skill",
    version: "1.0.0",
    description: "Project skill",
    sourcePath: "C:\\Users\\test\\.agents\\skills\\project-skill",
    validationState: "valid",
    validationMessage: null
  })
  mockDesktopClient.importProjectSkill.mockResolvedValue({
    projectId: "project-1",
    identity: "project-skill",
    targetPath: "D:\\Projects\\Example\\.claude\\skills\\project-skill",
    overwritten: false
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
  document.documentElement.classList.remove("dark")
  document.documentElement.style.colorScheme = ""
  vi.clearAllMocks()
})

describe("App", () => {
  it("exposes a desktop client API surface", () => {
    expect(window.desktopClient).toBeDefined()
    expect(window.desktopClient?.getConfiguration).toBeTypeOf("function")
    expect(window.desktopClient?.saveConfiguration).toBeTypeOf("function")
    expect(window.desktopClient?.saveLocale).toBeTypeOf("function")
    expect(window.desktopClient?.saveTheme).toBeTypeOf("function")
    expect(window.desktopClient?.clearConfiguration).toBeTypeOf("function")
    expect(window.desktopClient?.testConnection).toBeTypeOf("function")
    expect(window.desktopClient?.getAgentPathsConfig).toBeTypeOf("function")
    expect(window.desktopClient?.saveAgentPathsConfig).toBeTypeOf("function")
    expect(window.desktopClient?.openAgentPathsConfigDir).toBeTypeOf("function")
    expect(window.desktopClient?.refreshSync).toBeTypeOf("function")
    expect(window.desktopClient?.refreshAgentDetection).toBeTypeOf("function")
    expect(window.desktopClient?.refreshPreDistributionCheck).toBeTypeOf("function")
    expect(window.desktopClient?.refreshLocalSkills).toBeTypeOf("function")
    expect(window.desktopClient?.uploadLocalSkill).toBeTypeOf("function")
    expect(window.desktopClient?.listProjects).toBeTypeOf("function")
    expect(window.desktopClient?.addProject).toBeTypeOf("function")
    expect(window.desktopClient?.renameProject).toBeTypeOf("function")
    expect(window.desktopClient?.removeProject).toBeTypeOf("function")
    expect(window.desktopClient?.selectProjectFolder).toBeTypeOf("function")
    expect(window.desktopClient?.openProjectFolder).toBeTypeOf("function")
    expect(window.desktopClient?.scanProjectSkills).toBeTypeOf("function")
    expect(window.desktopClient?.selectProjectSkillFolder).toBeTypeOf("function")
    expect(window.desktopClient?.validateProjectSkillFolder).toBeTypeOf("function")
    expect(window.desktopClient?.importProjectSkill).toBeTypeOf("function")
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
    mockDesktopClient.saveTheme.mockResolvedValue({
      ...configuredState,
      theme: "light"
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
    mockDesktopClient.getAgentPathsConfig.mockResolvedValue({
      codex: {
        targetPath: "C:\\Users\\test\\.codex\\skills"
      }
    })
    mockDesktopClient.saveAgentPathsConfig.mockResolvedValue({
      codex: {
        targetPath: "C:\\Users\\test\\.codex\\skills"
      }
    })
    mockDesktopClient.openAgentPathsConfigDir.mockResolvedValue(undefined)
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
    mockDesktopClient.refreshLocalSkills.mockResolvedValue(defaultLocalSkillsSnapshot)
    mockDesktopClient.uploadLocalSkill.mockResolvedValue({
      rowKey: "row-local-only",
      uploadedSkillId: "uploaded-skill",
      name: "local-only",
      version: "0.1.0",
      refreshedSnapshot: defaultLocalSkillsSnapshot
    })
    mockDesktopClient.listProjects.mockResolvedValue(defaultProjectsSnapshot)
    mockDesktopClient.addProject.mockResolvedValue(defaultProjectsSnapshot)
    mockDesktopClient.renameProject.mockResolvedValue(defaultProjectsSnapshot)
    mockDesktopClient.removeProject.mockResolvedValue({
      checkedAt: "2026-05-07T00:00:00.000Z",
      projects: []
    })
    mockDesktopClient.selectProjectFolder.mockResolvedValue({
      canceled: false,
      path: "D:\\Projects\\Example"
    })
    mockDesktopClient.openProjectFolder.mockResolvedValue(undefined)
    mockDesktopClient.scanProjectSkills.mockResolvedValue(defaultProjectScanSnapshot)
    mockDesktopClient.selectProjectSkillFolder.mockResolvedValue({
      canceled: false,
      path: "C:\\Users\\test\\.agents\\skills\\project-skill"
    })
    mockDesktopClient.validateProjectSkillFolder.mockResolvedValue({
      valid: true,
      identity: "project-skill",
      version: "1.0.0",
      description: "Project skill",
      sourcePath: "C:\\Users\\test\\.agents\\skills\\project-skill",
      validationState: "valid",
      validationMessage: null
    })
    mockDesktopClient.importProjectSkill.mockResolvedValue({
      projectId: "project-1",
      identity: "project-skill",
      targetPath: "D:\\Projects\\Example\\.claude\\skills\\project-skill",
      overwritten: false
    })
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
    await expect(desktopClient.saveTheme("light")).resolves.toEqual({
      ...configuredState,
      theme: "light"
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
    await expect(desktopClient.getAgentPathsConfig()).resolves.toEqual({
      codex: {
        targetPath: "C:\\Users\\test\\.codex\\skills"
      }
    })
    await expect(
      desktopClient.saveAgentPathsConfig({
        codex: {
          targetPath: "C:\\Users\\test\\.codex\\skills"
        }
      })
    ).resolves.toEqual({
      codex: {
        targetPath: "C:\\Users\\test\\.codex\\skills"
      }
    })
    await expect(desktopClient.openAgentPathsConfigDir()).resolves.toBeUndefined()
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
    await expect(desktopClient.refreshLocalSkills()).resolves.toEqual(defaultLocalSkillsSnapshot)
    await expect(desktopClient.uploadLocalSkill("row-local-only")).resolves.toEqual({
      rowKey: "row-local-only",
      uploadedSkillId: "uploaded-skill",
      name: "local-only",
      version: "0.1.0",
      refreshedSnapshot: defaultLocalSkillsSnapshot
    })
    await expect(desktopClient.listProjects()).resolves.toEqual(defaultProjectsSnapshot)
    await expect(
      desktopClient.addProject({
        name: "Example Project",
        path: "D:\\Projects\\Example"
      })
    ).resolves.toEqual(defaultProjectsSnapshot)
    await expect(
      desktopClient.renameProject({
        projectId: "project-1",
        name: "Example Project"
      })
    ).resolves.toEqual(defaultProjectsSnapshot)
    await expect(desktopClient.removeProject({ projectId: "project-1" })).resolves.toEqual({
      checkedAt: "2026-05-07T00:00:00.000Z",
      projects: []
    })
    await expect(desktopClient.selectProjectFolder()).resolves.toEqual({
      canceled: false,
      path: "D:\\Projects\\Example"
    })
    await expect(
      desktopClient.openProjectFolder({ projectId: "project-1" })
    ).resolves.toBeUndefined()
    await expect(
      desktopClient.scanProjectSkills({ projectId: "project-1" })
    ).resolves.toEqual(defaultProjectScanSnapshot)
    await expect(desktopClient.selectProjectSkillFolder()).resolves.toEqual({
      canceled: false,
      path: "C:\\Users\\test\\.agents\\skills\\project-skill"
    })
    await expect(
      desktopClient.validateProjectSkillFolder({
        sourcePath: "C:\\Users\\test\\.agents\\skills\\project-skill"
      })
    ).resolves.toEqual({
      valid: true,
      identity: "project-skill",
      version: "1.0.0",
      description: "Project skill",
      sourcePath: "C:\\Users\\test\\.agents\\skills\\project-skill",
      validationState: "valid",
      validationMessage: null
    })
    await expect(
      desktopClient.importProjectSkill({
        projectId: "project-1",
        sourcePath: "C:\\Users\\test\\.agents\\skills\\project-skill",
        targetAgentId: "claude-code",
        overwrite: false
      })
    ).resolves.toEqual({
      projectId: "project-1",
      identity: "project-skill",
      targetPath: "D:\\Projects\\Example\\.claude\\skills\\project-skill",
      overwritten: false
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
    expect(mockDesktopClient.saveTheme).toHaveBeenCalledWith("light")
    expect(mockDesktopClient.clearConfiguration).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.testConnection).toHaveBeenCalledWith({
      apiBaseUrl: "http://localhost:8001",
      apiToken: "ask_live"
    })
    expect(mockDesktopClient.getAgentPathsConfig).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.saveAgentPathsConfig).toHaveBeenCalledWith({
      codex: {
        targetPath: "C:\\Users\\test\\.codex\\skills"
      }
    })
    expect(mockDesktopClient.openAgentPathsConfigDir).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.refreshSync).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.refreshAgentDetection).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.refreshPreDistributionCheck).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.refreshLocalSkills).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.uploadLocalSkill).toHaveBeenCalledWith("row-local-only")
    expect(mockDesktopClient.listProjects).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.addProject).toHaveBeenCalledWith({
      name: "Example Project",
      path: "D:\\Projects\\Example"
    })
    expect(mockDesktopClient.renameProject).toHaveBeenCalledWith({
      projectId: "project-1",
      name: "Example Project"
    })
    expect(mockDesktopClient.removeProject).toHaveBeenCalledWith({ projectId: "project-1" })
    expect(mockDesktopClient.selectProjectFolder).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.openProjectFolder).toHaveBeenCalledWith({ projectId: "project-1" })
    expect(mockDesktopClient.scanProjectSkills).toHaveBeenCalledWith({ projectId: "project-1" })
    expect(mockDesktopClient.selectProjectSkillFolder).toHaveBeenCalledTimes(1)
    expect(mockDesktopClient.validateProjectSkillFolder).toHaveBeenCalledWith({
      sourcePath: "C:\\Users\\test\\.agents\\skills\\project-skill"
    })
    expect(mockDesktopClient.importProjectSkill).toHaveBeenCalledWith({
      projectId: "project-1",
      sourcePath: "C:\\Users\\test\\.agents\\skills\\project-skill",
      targetAgentId: "claude-code",
      overwrite: false
    })
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

  it("applies the configured dark theme to the document root", async () => {
    mockDesktopClient.getConfiguration.mockResolvedValueOnce(configuredState)

    render(<App />)

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark")
      expect(document.documentElement).toHaveStyle({ colorScheme: "dark" })
    })
  })

  it("persists a one-click theme switch and applies light mode", async () => {
    mockDesktopClient.getConfiguration.mockResolvedValueOnce(configuredState)
    mockDesktopClient.saveTheme.mockResolvedValueOnce({
      ...configuredState,
      theme: "light"
    })

    render(<App />)

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark")
    })

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }))

    await waitFor(() => {
      expect(mockDesktopClient.saveTheme).toHaveBeenCalledWith("light")
      expect(document.documentElement).not.toHaveClass("dark")
      expect(document.documentElement).toHaveStyle({ colorScheme: "light" })
    })
  })

  it("rolls back the theme when persistence fails", async () => {
    mockDesktopClient.getConfiguration.mockResolvedValueOnce(configuredState)
    mockDesktopClient.saveTheme.mockRejectedValueOnce(new Error("theme store unavailable"))

    render(<App />)

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark")
    })

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }))

    await waitFor(() => {
      expect(mockDesktopClient.saveTheme).toHaveBeenCalledWith("light")
      expect(document.documentElement).toHaveClass("dark")
      expect(screen.getByText("Desktop bridge error: theme store unavailable")).toBeInTheDocument()
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
          localContentHash: null,
          remoteVersion: "1.0.0",
          remoteContentHash: "hash-remote",
          reason: "not-installed"
        },
        {
          remoteSkillId: "skill-b",
          name: "Skill B",
          localVersion: "1.0.0",
          remoteVersion: "1.1.0",
          reason: "update"
        },
        {
          remoteSkillId: "skill-c",
          name: "Skill C",
          localVersion: null,
          remoteVersion: "1.0.0",
          reason: "not-installed"
        },
        {
          remoteSkillId: "skill-d",
          name: "Skill D",
          localVersion: "1.0.0",
          remoteVersion: "2.0.0",
          reason: "update"
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

  it("shows Local Skills between Home and Updates and uploads a missing local skill", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-05-02T00:00:00.000Z"
    })
    mockDesktopClient.uploadLocalSkill.mockResolvedValueOnce({
      rowKey: "row-local-only",
      uploadedSkillId: "uploaded-skill",
      name: "local-only",
      version: "0.1.0",
      refreshedSnapshot: {
        ...defaultLocalSkillsSnapshot,
        rows: [
          {
            ...defaultLocalSkillsSnapshot.rows[0],
            serverState: "existing",
            remoteSkillId: "uploaded-skill",
            remoteVersion: "0.1.0",
            uploadable: false
          }
        ]
      }
    })

    render(<App />)

    const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

    await waitFor(() => {
      expect(within(navigation).getByRole("button", { name: "Local Skills" })).toBeInTheDocument()
    })

    expect(within(navigation).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Home",
      "Updates",
      "Local Skills",
      "Projects"
    ])

    fireEvent.click(within(navigation).getByRole("button", { name: "Local Skills" }))

    await waitFor(() => {
      expect(mockDesktopClient.refreshLocalSkills).toHaveBeenCalledTimes(1)
      expect(screen.getByRole("heading", { name: "Local Skills" })).toBeInTheDocument()
      expect(screen.getByText("local-only")).toBeInTheDocument()
      expect(screen.getByText(/Codex/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Upload" }))

    await waitFor(() => {
      expect(mockDesktopClient.uploadLocalSkill).toHaveBeenCalledWith("row-local-only")
      expect(screen.getByText(/uploaded-skill/)).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument()
    })
  })

  it("refreshes Local Skills after an upload conflict", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-05-02T00:00:00.000Z"
    })
    mockDesktopClient.refreshLocalSkills
      .mockResolvedValueOnce(defaultLocalSkillsSnapshot)
      .mockResolvedValueOnce({
        ...defaultLocalSkillsSnapshot,
        rows: [
          {
            ...defaultLocalSkillsSnapshot.rows[0],
            serverState: "existing",
            remoteSkillId: "uploaded-skill",
            remoteVersion: "0.1.0",
            uploadable: false
          }
        ]
      })
    mockDesktopClient.uploadLocalSkill.mockRejectedValueOnce(
      new Error("DUPLICATE_SKILL_NAME: A server skill with this name already exists")
    )

    render(<App />)

    const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

    await waitFor(() => {
      expect(within(navigation).getByRole("button", { name: "Local Skills" })).toBeInTheDocument()
    })

    fireEvent.click(within(navigation).getByRole("button", { name: "Local Skills" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Upload" }))

    await waitFor(() => {
      expect(mockDesktopClient.uploadLocalSkill).toHaveBeenCalledWith("row-local-only")
      expect(mockDesktopClient.refreshLocalSkills).toHaveBeenCalledTimes(2)
      expect(screen.getByText(/uploaded-skill/)).toBeInTheDocument()
    })
  })

  it("shows Projects after Updates and renders the empty project state", async () => {
    mockDesktopClient.listProjects.mockResolvedValueOnce({
      checkedAt: "2026-05-07T00:00:00.000Z",
      projects: []
    })

    render(<App />)

    const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

    await waitFor(() => {
      expect(within(navigation).getByRole("button", { name: "Projects" })).toBeInTheDocument()
    })

    expect(within(navigation).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Home",
      "Updates",
      "Local Skills",
      "Projects"
    ])

    fireEvent.click(within(navigation).getByRole("button", { name: "Projects" }))

    await waitFor(() => {
      expect(mockDesktopClient.listProjects).toHaveBeenCalledTimes(1)
      expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument()
      expect(screen.getByText("No projects have been added yet.")).toBeInTheDocument()
    })
  })

  it("opens a project detail view and imports a validated project skill", async () => {
    render(<App />)

    const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

    await waitFor(() => {
      expect(within(navigation).getByRole("button", { name: "Projects" })).toBeInTheDocument()
    })

    fireEvent.click(within(navigation).getByRole("button", { name: "Projects" }))

    await waitFor(() => {
      expect(screen.getByText("Example Project")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Open" }))

    await waitFor(() => {
      expect(mockDesktopClient.scanProjectSkills).toHaveBeenCalledWith({ projectId: "project-1" })
      expect(screen.getByRole("heading", { name: "Example Project" })).toBeInTheDocument()
      expect(screen.getByText("project-skill")).toBeInTheDocument()
      expect(screen.getByText("global-only")).toBeInTheDocument()
      expect(screen.getByText("Project")).toBeInTheDocument()
      expect(screen.getByText("Global")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Add Skill" }))

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Add skill to project" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Browse" }))

    await waitFor(() => {
      expect(mockDesktopClient.selectProjectSkillFolder).toHaveBeenCalledTimes(1)
      expect(mockDesktopClient.validateProjectSkillFolder).toHaveBeenCalledWith({
        sourcePath: "C:\\Users\\test\\.agents\\skills\\project-skill"
      })
      expect(screen.getAllByText("project-skill").length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole("button", { name: "Import" }))

    await waitFor(() => {
      expect(mockDesktopClient.importProjectSkill).toHaveBeenCalledWith({
        projectId: "project-1",
        sourcePath: "C:\\Users\\test\\.agents\\skills\\project-skill",
        targetAgentId: "claude-code",
        overwrite: false
      })
      expect(mockDesktopClient.scanProjectSkills).toHaveBeenCalledTimes(2)
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
      expect(screen.getAllByText("Detected or configured").length).toBeGreaterThan(0)
      expect(screen.getByText(/D:\\Claude\\skills/)).toBeInTheDocument()
      expect(screen.getByText("Gemini CLI")).toBeInTheDocument()
      expect(screen.getAllByText("Not installed").length).toBeGreaterThan(0)
    })
  })

  it("opens the agent paths configuration directory from settings", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })
    mockDesktopClient.refreshAgentDetection.mockResolvedValueOnce(defaultAgentDetection)

    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Settings" })[0]).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0])

    const openConfigButton = await screen.findByRole("button", {
      name: "Open Agent Paths Config"
    })
    fireEvent.click(openConfigButton)

    await waitFor(() => {
      expect(mockDesktopClient.openAgentPathsConfigDir).toHaveBeenCalledTimes(1)
    })
  })

  it("runs a content-based pre-distribution check after loading pending updates", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: "2.0.0",
          localContentHash: "hash-local",
          remoteVersion: "1.0.0",
          remoteContentHash: "hash-remote",
          reason: "update"
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
            installedContentHash: "hash-local",
            remoteVersion: "1.0.0",
            remoteContentHash: "hash-remote",
            installedVersionFormat: "semver",
            remoteVersionFormat: "semver",
            contentComparison: "update",
            checkedAt: "2026-04-17T00:00:01.000Z",
            durationMs: 4,
            errorCode: null,
            errorMessage: null
          }
        }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0@hash-remote",
      targetAgentIds: ["codex"],
      totalDurationMs: 4,
      globalErrors: []
    })

    render(<App />)

    await waitFor(() => {
      expect(mockDesktopClient.refreshPreDistributionCheck).toHaveBeenCalledTimes(1)
      expect(screen.getByText("Codex: Update")).toBeInTheDocument()
      expect(
        screen.queryByText("Review target warnings before distributing.")
      ).not.toBeInTheDocument()
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
          localContentHash: null,
          remoteVersion: "1.0.0",
          remoteContentHash: "hash-new",
          reason: "not-installed"
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
            installedContentHash: "hash-old",
            remoteVersion: "1.0.0",
            remoteContentHash: "hash-old",
            installedVersionFormat: "semver",
            remoteVersionFormat: "semver",
            contentComparison: "installed",
            checkedAt: "2026-04-17T00:00:01.000Z",
            durationMs: 4,
            errorCode: null,
            errorMessage: null
          }
        }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-old@1.0.0@hash-old",
      targetAgentIds: ["codex"],
      totalDurationMs: 4,
      globalErrors: []
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText("Refresh check to read installed target content before distribution.")).toBeInTheDocument()
      expect(screen.queryByText("Codex: Installed")).not.toBeInTheDocument()
    })
  })

  it("syncs the local record instead of distributing when every target already has the remote content", async () => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      localRecords: [],
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: null,
          localContentHash: null,
          remoteVersion: "1.0.0",
          remoteContentHash: "hash-remote",
          reason: "not-installed"
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
            installedContentHash: "hash-remote",
            remoteVersion: "1.0.0",
            remoteContentHash: "hash-remote",
            installedVersionFormat: "semver",
            remoteVersionFormat: "semver",
            contentComparison: "installed",
            checkedAt: "2026-04-17T00:00:01.000Z",
            durationMs: 4,
            errorCode: null,
            errorMessage: null
          }
        }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0@hash-remote",
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
          installedContentHash: "hash-remote",
          remoteVersion: "1.0.0",
          remoteContentHash: "hash-remote",
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
          reason: "not-installed"
        }
      ],
      successfulDistributionCount: 0,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValue({
      results: {},
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0@hash-remote",
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
            reason: "not-installed"
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
          localContentHash: null,
          remoteVersion: "1.0.0",
          remoteContentHash: "hash-new",
          reason: "not-installed"
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
            reason: "not-installed"
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
            reason: "not-installed"
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
            reason: "not-installed"
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
