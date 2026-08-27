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
  deleteLocalSkill: ReturnType<typeof vi.fn>
  openLocalSkillFolder: ReturnType<typeof vi.fn>
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
  distributePendingUpdate: vi.fn(),
  deleteLocalSkill: vi.fn(),
  openLocalSkillFolder: vi.fn()
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
  supportedAgentCount: 23,
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

function createReadyPreDistributionCheckSnapshot(
  pendingUpdates: Array<{
    remoteSkillId: string
    remoteVersion: string
    remoteContentHash?: string | null
  }>
) {
  return {
    results: Object.fromEntries(
      pendingUpdates.map((pendingUpdate) => [
        pendingUpdate.remoteSkillId,
        {
          codex: {
            ...defaultAgentDetection.agentStatuses[0],
            contentComparison: "not-installed" as const
          }
        }
      ])
    ),
    checkedAt: "2026-04-17T00:00:01.000Z",
    expiresAt: "2099-04-17T00:00:01.000Z",
    pendingUpdateFingerprint: pendingUpdates
      .map(
        (pendingUpdate) =>
          `${pendingUpdate.remoteSkillId}@${pendingUpdate.remoteVersion}@${pendingUpdate.remoteContentHash ?? ""}`
      )
      .sort()
      .join("|"),
    targetAgentIds: ["codex" as const],
    totalDurationMs: 1,
    globalErrors: []
  }
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
  mockDesktopClient.deleteLocalSkill.mockResolvedValue(defaultLocalSkillsSnapshot)
  mockDesktopClient.openLocalSkillFolder.mockResolvedValue(undefined)
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

const multiPathPrimaryRow = {
  ...defaultLocalSkillsSnapshot.rows[0],
  rowKey: "row-vibe-primary",
  name: "vibe-coding-launcher",
  packageRootPath: "C:\\Users\\test\\.agents\\skills\\vibe-coding-launcher",
  sourceAgents: ["codex" as const],
  sourceDisplayNames: ["Codex"]
}

const multiPathSecondaryRow = {
  ...defaultLocalSkillsSnapshot.rows[0],
  rowKey: "row-vibe-secondary",
  name: "vibe-coding-launcher",
  packageRootPath: "C:\\Users\\test\\.workbuddy\\skills\\vibe-coding-launcher",
  sourceAgents: ["workbuddy" as const],
  sourceDisplayNames: ["WorkBuddy"]
}

const multiPathLocalSkillsSnapshot = {
  ...defaultLocalSkillsSnapshot,
  rows: [multiPathPrimaryRow, multiPathSecondaryRow],
  groupedRows: [
    {
      groupKey: "group-vibe-coding-launcher",
      name: "vibe-coding-launcher",
      items: [multiPathPrimaryRow, multiPathSecondaryRow],
      primary: multiPathPrimaryRow,
      sourceDisplayNames: ["Codex", "WorkBuddy"],
      pathCount: 2,
      uploadable: false,
      hasVersionConflict: false
    }
  ]
}

const detailLocalSkillRow = {
  ...defaultLocalSkillsSnapshot.rows[0],
  rowKey: "row-frontend-design",
  name: "frontend-design",
  localVersion: "1.2.0",
  packageRootPath: "D:\\skills\\frontend-design",
  remoteSkillId: "frontend-design-id",
  remoteVersion: "1.0.0",
  serverState: "update-available" as const,
  uploadable: true
}

const detailLocalSkillsSnapshot = {
  ...defaultLocalSkillsSnapshot,
  rows: [detailLocalSkillRow],
  groupedRows: [
    {
      groupKey: "group-frontend-design",
      name: "frontend-design",
      items: [detailLocalSkillRow],
      primary: detailLocalSkillRow,
      sourceDisplayNames: ["Codex"],
      pathCount: 1,
      uploadable: true,
      hasVersionConflict: false
    }
  ]
}

async function openLocalSkillsView() {
  render(<App />)

  const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })
  await waitFor(() => {
    expect(within(navigation).getByRole("button", { name: "Local Skills" })).toBeInTheDocument()
  })

  fireEvent.click(within(navigation).getByRole("button", { name: "Local Skills" }))
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Local Skills" })).toBeInTheDocument()
  })
}

describe("App", () => {
  it("renders the shared sidebar shell with one navigation landmark and an active page", async () => {
    render(<App />)

    const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

    await waitFor(() => {
      expect(within(navigation).getAllByRole("button")).toHaveLength(4)
      expect(screen.getByText("Desktop bridge connected")).toBeInTheDocument()
    })

    expect(within(navigation).getByRole("button", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument()
    expect(navigation.closest(".app-sidebar")).toBeInTheDocument()
    expect(navigation.closest(".app-shell")?.querySelector(".app-workspace")).toBeInTheDocument()
    expect(navigation.closest(".app-shell")?.querySelector(".workspace-toolbar")).toBeInTheDocument()
    expect(navigation.closest(".app-shell")?.querySelector(".app-main")).toBeInTheDocument()
    expect(within(navigation).getByText("Home")).toHaveClass("btn__label")
  })

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
    expect(window.desktopClient?.deleteLocalSkill).toBeTypeOf("function")
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
    mockDesktopClient.deleteLocalSkill.mockResolvedValue(defaultLocalSkillsSnapshot)

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

    expect(screen.queryByRole("button", { name: "Distribute Skill A" })).not.toBeInTheDocument()
    expect(screen.queryByText("Skill D")).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Distribution targets" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Recent actions" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "View all updates" }))

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
      expect(screen.getAllByText(/Codex/).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole("button", { name: "Upload" }))

    await waitFor(() => {
      expect(mockDesktopClient.uploadLocalSkill).toHaveBeenCalledWith("row-local-only")
      expect(screen.getByText(/uploaded-skill/)).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument()
    })
  })

  it("shows contextual details for an inspected Local Skill group", async () => {
    mockDesktopClient.refreshLocalSkills.mockResolvedValueOnce(detailLocalSkillsSnapshot)

    await openLocalSkillsView()

    fireEvent.click(await screen.findByRole("button", { name: "Inspect frontend-design" }))
    expect(mockDesktopClient.openLocalSkillFolder).not.toHaveBeenCalled()

    const detail = screen.getByRole("complementary", { name: "frontend-design details" })
    expect(within(detail).getByRole("heading", { name: "frontend-design" })).toBeInTheDocument()
    expect(within(detail).getByText("D:\\skills\\frontend-design")).toBeInTheDocument()
    expect(within(detail).getByText(/Codex/)).toBeInTheDocument()
    expect(within(detail).getAllByText("Local 1.2.0")).not.toHaveLength(0)
    expect(within(detail).getByText("Remote 1.0.0")).toBeInTheDocument()
    expect(within(detail).getByText("Update available on server")).toBeInTheDocument()
    expect(within(detail).getByRole("button", { name: "Upload" })).toBeInTheDocument()
    expect(within(detail).getByRole("button", { name: "Open Folder" })).toBeInTheDocument()
    expect(within(detail).getByRole("button", { name: "Delete" })).toBeInTheDocument()

    fireEvent.click(within(detail).getByRole("button", { name: "Open Folder" }))
    await waitFor(() => {
      expect(mockDesktopClient.openLocalSkillFolder).toHaveBeenCalledWith({ rowKey: detailLocalSkillRow.rowKey })
    })
  })

  it.each(["Enter", " "]) ("selects the same Local Skill group with %s on Inspect", async (key) => {
    mockDesktopClient.refreshLocalSkills.mockResolvedValueOnce(detailLocalSkillsSnapshot)

    await openLocalSkillsView()

    const inspect = await screen.findByRole("button", { name: "Inspect frontend-design" })
    fireEvent.keyDown(inspect, { key })

    expect(screen.getByRole("complementary", { name: "frontend-design details" })).toBeInTheDocument()
  })

  it("opens a multi-path group dialog without opening a folder before confirmation", async () => {
    mockDesktopClient.refreshLocalSkills.mockResolvedValueOnce(multiPathLocalSkillsSnapshot)

    await openLocalSkillsView()

    const groupCard = screen.getByRole("heading", { name: "vibe-coding-launcher" }).closest("article")
    expect(groupCard).not.toBeNull()
    fireEvent.click(within(groupCard!).getByRole("button", { name: "Open Folder" }))

    const dialog = await screen.findByRole("dialog", { name: "Choose local path" })
    expect(dialog).toHaveTextContent(multiPathPrimaryRow.packageRootPath)
    expect(dialog).toHaveTextContent(multiPathSecondaryRow.packageRootPath)
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(screen.getAllByRole("radio")[0]).toBeChecked()
    expect(mockDesktopClient.openLocalSkillFolder).not.toHaveBeenCalled()
  })

  it("opens the selected path from a multi-path group", async () => {
    mockDesktopClient.refreshLocalSkills.mockResolvedValueOnce(multiPathLocalSkillsSnapshot)

    await openLocalSkillsView()

    const groupCard = screen.getByRole("heading", { name: "vibe-coding-launcher" }).closest("article")
    expect(groupCard).not.toBeNull()
    fireEvent.click(within(groupCard!).getByRole("button", { name: "Open Folder" }))
    await screen.findByRole("dialog", { name: "Choose local path" })

    fireEvent.click(screen.getAllByRole("radio")[1])
    expect(screen.getAllByRole("radio")[1]).toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: "Open path" }))

    await waitFor(() => {
      expect(mockDesktopClient.openLocalSkillFolder).toHaveBeenCalledTimes(1)
      expect(mockDesktopClient.openLocalSkillFolder).toHaveBeenCalledWith({ rowKey: multiPathSecondaryRow.rowKey })
      expect(screen.queryByRole("dialog", { name: "Choose local path" })).not.toBeInTheDocument()
    })
  })

  it("cancels a multi-path group dialog without opening a folder", async () => {
    mockDesktopClient.refreshLocalSkills.mockResolvedValueOnce(multiPathLocalSkillsSnapshot)

    await openLocalSkillsView()

    const groupCard = screen.getByRole("heading", { name: "vibe-coding-launcher" }).closest("article")
    expect(groupCard).not.toBeNull()
    fireEvent.click(within(groupCard!).getByRole("button", { name: "Open Folder" }))
    await screen.findByRole("dialog", { name: "Choose local path" })

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog", { name: "Choose local path" })).not.toBeInTheDocument()
    expect(mockDesktopClient.openLocalSkillFolder).not.toHaveBeenCalled()
  })

  it("opens a single-path group directly without showing a path picker", async () => {
    await openLocalSkillsView()

    const groupCard = screen.getByRole("heading", { name: "local-only" }).closest("article")
    expect(groupCard).not.toBeNull()
    fireEvent.click(within(groupCard!).getByRole("button", { name: "Open Folder" }))

    await waitFor(() => {
      expect(mockDesktopClient.openLocalSkillFolder).toHaveBeenCalledWith({ rowKey: "row-local-only" })
    })
    expect(screen.queryByRole("dialog", { name: "Choose local path" })).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByRole("button", { name: "Updates" }))
    await waitFor(() => {
      expect(screen.getByText("Target checks have not run")).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sync record Skill A" })
      ).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Distribute Skill A" })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Sync record Skill A" }))

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

    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce(
      createReadyPreDistributionCheckSnapshot([
        { remoteSkillId: "skill-a", remoteVersion: "1.0.0" }
      ])
    )
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
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

    await waitFor(() => {
      expect(screen.getByText("Skill A")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Distribute Skill A" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Distribute Skill A" }))

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Confirm distribution" })).toBeInTheDocument()
      expect(screen.getByText("Will write to")).toBeInTheDocument()
      expect(screen.getAllByText(/Codex/).length).toBeGreaterThan(0)
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
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce(
      createReadyPreDistributionCheckSnapshot([
        { remoteSkillId: "skill-a", remoteVersion: "1.0.0", remoteContentHash: "hash-new" }
      ])
    )

    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

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
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce(
      createReadyPreDistributionCheckSnapshot([
        { remoteSkillId: "skill-a", remoteVersion: "1.0.0" }
      ])
    )

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
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

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
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce(
      createReadyPreDistributionCheckSnapshot([
        { remoteSkillId: "skill-a", remoteVersion: "1.0.0" }
      ])
    )

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
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

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

  it("selected safe updates are distributed in pending order after one confirmation", async () => {
    const pendingUpdates = [
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        localVersion: null,
        localContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-a",
        reason: "not-installed" as const
      },
      {
        remoteSkillId: "skill-error",
        name: "Skill Error",
        localVersion: null,
        localContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-error",
        reason: "not-installed" as const
      },
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        localVersion: null,
        localContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-b",
        reason: "not-installed" as const
      }
    ]

    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      ...emptySyncState,
      pendingUpdates,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })
    const preDistributionCheckSnapshot = {
      results: {
        "skill-a": { codex: { ...defaultAgentDetection.agentStatuses[0], contentComparison: "not-installed" } },
        "skill-error": { codex: { ...defaultAgentDetection.agentStatuses[0], contentComparison: "error" } },
        "skill-b": { codex: { ...defaultAgentDetection.agentStatuses[0], contentComparison: "update" } }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0@hash-a|skill-b@1.0.0@hash-b|skill-error@1.0.0@hash-error",
      targetAgentIds: ["codex"],
      totalDurationMs: 1,
      globalErrors: []
    }
    mockDesktopClient.refreshPreDistributionCheck
      .mockResolvedValueOnce(preDistributionCheckSnapshot)
      .mockResolvedValueOnce(preDistributionCheckSnapshot)
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      ...emptySyncState,
      pendingUpdates,
      lastRefreshedAt: "2026-04-17T00:00:05.000Z"
    })
    mockDesktopClient.distributePendingUpdate.mockImplementation(async (skillId: string) => ({
      skillId,
      name: skillId,
      version: "1.0.0",
      extractedPath: null,
      targets: [],
      succeededAgentIds: ["codex"],
      failedAgentIds: [],
      syncedToLocalState: true
    }))

    render(<App />)

    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select all eligible updates" })).toBeInTheDocument()
    })
    expect(screen.getByRole("checkbox", { name: "Select Skill A" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select Skill B" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select Skill Error" })).toBeDisabled()
    expect(screen.getByText("2 selected of 2 eligible updates")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Distribute selected updates" }))
    const dialog = await screen.findByRole("dialog", { name: "Confirm batch distribution" })
    expect(dialog).toHaveTextContent("Skill A")
    expect(dialog).toHaveTextContent("Skill B")
    expect(dialog).not.toHaveTextContent("Skill Error")
    expect(mockDesktopClient.distributePendingUpdate).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm distribution" }))

    await waitFor(() => {
      expect(mockDesktopClient.distributePendingUpdate).toHaveBeenNthCalledWith(1, "skill-a")
      expect(mockDesktopClient.distributePendingUpdate).toHaveBeenNthCalledWith(2, "skill-b")
      expect(screen.getByText("Batch distribution completed")).toBeInTheDocument()
    })
    expect(screen.getByTestId("review-action-bar")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }))
    await waitFor(() => {
      expect(screen.queryByTestId("review-action-bar")).not.toBeInTheDocument()
      expect(screen.queryByTestId("review-batch-status")).not.toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Skill A" }))
    await waitFor(() => {
      expect(screen.getByTestId("review-action-bar")).toHaveTextContent("1 selected")
      expect(screen.getByTestId("review-action-bar")).not.toHaveTextContent("Batch distribution completed")
    })
    expect(mockDesktopClient.distributePendingUpdate).toHaveBeenCalledTimes(2)
    expect(mockDesktopClient.refreshSync).toHaveBeenCalledTimes(2)
  })

  it("continues after a rejected batch item and reports progress", async () => {
    const pendingUpdates = [
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        localVersion: null,
        localContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-a",
        reason: "not-installed" as const
      },
      {
        remoteSkillId: "skill-b",
        name: "Skill B",
        localVersion: null,
        localContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-b",
        reason: "not-installed" as const
      }
    ]
    mockDesktopClient.refreshSync.mockResolvedValueOnce({ ...emptySyncState, pendingUpdates })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce({
      results: {
        "skill-a": { codex: { ...defaultAgentDetection.agentStatuses[0], contentComparison: "not-installed" } },
        "skill-b": { codex: { ...defaultAgentDetection.agentStatuses[0], contentComparison: "not-installed" } }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0@hash-a|skill-b@1.0.0@hash-b",
      targetAgentIds: ["codex"],
      totalDurationMs: 1,
      globalErrors: []
    })
    mockDesktopClient.refreshSync.mockResolvedValueOnce(emptySyncState)
    mockDesktopClient.distributePendingUpdate
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        skillId: "skill-b",
        name: "Skill B",
        version: "1.0.0",
        extractedPath: null,
        targets: [],
        succeededAgentIds: ["codex"],
        failedAgentIds: [],
        syncedToLocalState: true
      })

    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Distribute selected updates" })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: "Distribute selected updates" }))
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Confirm batch distribution" })).getByRole(
        "button",
        { name: "Confirm distribution" }
      )
    )

    await waitFor(() => {
      expect(screen.getByText("Batch distribution completed with warnings")).toBeInTheDocument()
      expect(screen.getByText(/2 of 2 updates processed:/)).toBeInTheDocument()
    })
    expect(mockDesktopClient.distributePendingUpdate).toHaveBeenNthCalledWith(1, "skill-a")
    expect(mockDesktopClient.distributePendingUpdate).toHaveBeenNthCalledWith(2, "skill-b")
    expect(mockDesktopClient.refreshSync).toHaveBeenCalledTimes(2)
  })

  it("keeps a one-item batch on the single distribution activity path", async () => {
    mockDesktopClient.refreshSync
      .mockResolvedValueOnce({
        ...emptySyncState,
        pendingUpdates: [
          {
            remoteSkillId: "skill-a",
            name: "Skill A",
            localVersion: null,
            localContentHash: null,
            remoteVersion: "1.0.0",
            remoteContentHash: "hash-a",
            reason: "not-installed" as const
          }
        ]
      })
      .mockRejectedValueOnce(new Error("refresh unavailable"))
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce({
      results: {
        "skill-a": { codex: { ...defaultAgentDetection.agentStatuses[0], contentComparison: "not-installed" } }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0@hash-a",
      targetAgentIds: ["codex"],
      totalDurationMs: 1,
      globalErrors: []
    })
    mockDesktopClient.distributePendingUpdate.mockResolvedValueOnce({
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
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Select Skill A" })).toBeChecked()
    })

    fireEvent.click(screen.getByRole("button", { name: "Distribute selected updates" }))
    const dialog = await screen.findByRole("dialog", { name: "Confirm distribution" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm distribution" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Settings" })).toBeEnabled()
    })
    fireEvent.click(screen.getByRole("button", { name: "Settings" }))

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Desktop settings" })).toBeInTheDocument()
      expect(screen.getByText("Distribution completed with refresh warning")).toBeInTheDocument()
      expect(
        screen.getByText(
          "Skill A was sent to 1 configured agent target. Refreshing the review snapshot then failed: refresh unavailable"
        )
      ).toBeInTheDocument()
    })
  })

  it.each([
    {
      label: "the pre-distribution check is missing",
      snapshot: null
    },
    {
      label: "the pre-distribution check is stale",
      snapshot: {
        results: {
          "skill-a": {
            codex: { ...defaultAgentDetection.agentStatuses[0], contentComparison: "not-installed" }
          }
        },
        checkedAt: "2026-04-17T00:00:01.000Z",
        expiresAt: "2020-04-17T00:00:01.000Z",
        pendingUpdateFingerprint: "skill-a@1.0.0@hash-a",
        targetAgentIds: ["codex"],
        totalDurationMs: 1,
        globalErrors: []
      }
    },
    {
      label: "the pre-distribution check fingerprint changed",
      snapshot: {
        results: {
          "skill-a": {
            codex: { ...defaultAgentDetection.agentStatuses[0], contentComparison: "not-installed" }
          }
        },
        checkedAt: "2026-04-17T00:00:01.000Z",
        expiresAt: "2099-04-17T00:00:01.000Z",
        pendingUpdateFingerprint: "skill-a@1.0.0@hash-old",
        targetAgentIds: ["codex"],
        totalDurationMs: 1,
        globalErrors: []
      }
    },
    {
      label: "a target check reports an error",
      snapshot: {
        results: {
          "skill-a": {
            codex: {
              ...defaultAgentDetection.agentStatuses[0],
              contentComparison: "error",
              errorMessage: "Target path could not be read."
            }
          }
        },
        checkedAt: "2026-04-17T00:00:01.000Z",
        expiresAt: "2099-04-17T00:00:01.000Z",
        pendingUpdateFingerprint: "skill-a@1.0.0@hash-a",
        targetAgentIds: ["codex"],
        totalDurationMs: 1,
        globalErrors: []
      }
    }
  ])("does not distribute when $label", async ({ snapshot }) => {
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      ...emptySyncState,
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: null,
          localContentHash: null,
          remoteVersion: "1.0.0",
          remoteContentHash: "hash-a",
          reason: "not-installed" as const
        }
      ]
    })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce(
      snapshot ?? {
        results: {},
        checkedAt: "2026-04-17T00:00:01.000Z",
        expiresAt: "2099-04-17T00:00:01.000Z",
        pendingUpdateFingerprint: "",
        targetAgentIds: [],
        totalDurationMs: 1,
        globalErrors: []
      }
    )

    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

    await waitFor(() => {
      expect(screen.getByText("Skill A")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Distribute Skill A" })).not.toBeInTheDocument()
    })
    expect(mockDesktopClient.distributePendingUpdate).not.toHaveBeenCalled()
  })

  it("locks batch navigation while distribution is in progress", async () => {
    let resolveDistribution: ((value: unknown) => void) | undefined
    const distribution = new Promise((resolve) => {
      resolveDistribution = resolve
    })
    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      ...emptySyncState,
      pendingUpdates: [
        {
          remoteSkillId: "skill-a",
          name: "Skill A",
          localVersion: null,
          localContentHash: null,
          remoteVersion: "1.0.0",
          remoteContentHash: "hash-a",
          reason: "not-installed" as const
        }
      ]
    })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce({
      results: {
        "skill-a": { codex: { ...defaultAgentDetection.agentStatuses[0], contentComparison: "not-installed" } }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint: "skill-a@1.0.0@hash-a",
      targetAgentIds: ["codex"],
      totalDurationMs: 1,
      globalErrors: []
    })
    mockDesktopClient.distributePendingUpdate.mockReturnValueOnce(distribution)

    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Distribute selected updates" })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: "Distribute selected updates" }))
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Confirm distribution" })).getByRole(
        "button",
        { name: "Confirm distribution" }
      )
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Home" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Updates" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Local Skills" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Projects" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Settings" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Toggle theme" })).toBeDisabled()
      expect(screen.getByRole("checkbox", { name: "Select Skill A" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Select all eligible updates" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Clear selection" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Distribute selected updates" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Refresh Check" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Distribute Skill A" })).toBeDisabled()
      expect(screen.getByText("Distributing 1 of 1 updates")).toBeInTheDocument()
    })

    resolveDistribution?.({
      skillId: "skill-a",
      name: "Skill A",
      version: "1.0.0",
      extractedPath: null,
      targets: [],
      succeededAgentIds: ["codex"],
      failedAgentIds: [],
      syncedToLocalState: true
    })
    await waitFor(() => {
      expect(mockDesktopClient.refreshSync).toHaveBeenCalledTimes(2)
    })
  })

  it("renders the Updates review workspace with semantic table and safe selection controls", async () => {
    const pendingUpdates = [
      {
        remoteSkillId: "skill-a",
        name: "Skill A",
        localVersion: null,
        localContentHash: null,
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-a",
        reason: "not-installed" as const
      },
      {
        remoteSkillId: "skill-blocked",
        name: "Skill Blocked",
        localVersion: "0.9.0",
        localContentHash: "hash-old",
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-blocked",
        reason: "update" as const
      },
      {
        remoteSkillId: "skill-installed",
        name: "Skill Installed",
        localVersion: "1.0.0",
        localContentHash: "hash-installed",
        remoteVersion: "1.0.0",
        remoteContentHash: "hash-installed",
        reason: "update" as const
      }
    ]

    mockDesktopClient.refreshSync.mockResolvedValueOnce({
      ...emptySyncState,
      pendingUpdates,
      lastRefreshedAt: "2026-04-17T00:00:00.000Z"
    })
    mockDesktopClient.refreshPreDistributionCheck.mockResolvedValueOnce({
      results: {
        "skill-a": {
          codex: {
            ...defaultAgentDetection.agentStatuses[0],
            contentComparison: "not-installed"
          }
        },
        "skill-blocked": {
          codex: {
            ...defaultAgentDetection.agentStatuses[0],
            contentComparison: "error",
            errorMessage: "Target path could not be read."
          }
        },
        "skill-installed": {
          codex: {
            ...defaultAgentDetection.agentStatuses[0],
            contentComparison: "installed"
          }
        }
      },
      checkedAt: "2026-04-17T00:00:01.000Z",
      expiresAt: "2099-04-17T00:00:01.000Z",
      pendingUpdateFingerprint:
        "skill-a@1.0.0@hash-a|skill-blocked@1.0.0@hash-blocked|skill-installed@1.0.0@hash-installed",
      targetAgentIds: ["codex"],
      totalDurationMs: 1,
      globalErrors: []
    })

    render(<App />)
    fireEvent.click(screen.getByRole("button", { name: "Updates" }))

    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "Select" })).toBeInTheDocument()
    })

    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Change" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Targets" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Version" })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Select Skill A" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select Skill Blocked" })).not.toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Select Skill Blocked" })).toBeDisabled()
    expect(screen.getByText("1 item blocked by target checks")).toBeInTheDocument()
    expect(screen.getByText("Target path could not be read.")).toBeInTheDocument()
    expect(screen.getByText("Target checks reported errors")).toBeInTheDocument()
    expect(screen.getByTestId("review-action-bar")).toHaveTextContent("1 selected")
    expect(screen.getByTestId("review-action-bar")).toHaveTextContent("1 write target")
    expect(screen.getByRole("button", { name: "Select all eligible updates" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clear selection" })).toBeInTheDocument()
    expect(screen.getByText("Skill Installed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sync record Skill Installed" })).toBeInTheDocument()
  })

  describe("Local Skills delete confirmation", () => {
    it("shows delete confirmation dialog when delete button is clicked", async () => {
      render(<App />)

      const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

      await waitFor(() => {
        expect(within(navigation).getByRole("button", { name: "Local Skills" })).toBeInTheDocument()
      })

      fireEvent.click(within(navigation).getByRole("button", { name: "Local Skills" }))

      await waitFor(() => {
        expect(screen.getByText("local-only")).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0])

      const dialog = await screen.findByRole("dialog", { name: "Delete skill" })
      expect(dialog).toBeInTheDocument()

      expect(dialog).toHaveTextContent("C:\\Users\\test\\.agents\\skills\\local-only")
      expect(dialog).toHaveTextContent("Codex")
      expect(dialog).toHaveTextContent(/This action cannot be undone/)
      expect(dialog).toHaveTextContent(/permanently removed from disk/)

      const deleteButton = within(dialog).getByRole("button", { name: "Delete" })
      expect(deleteButton).toBeDisabled()

      expect(mockDesktopClient.deleteLocalSkill).not.toHaveBeenCalled()
    })

    it("enables delete button when correct skill name is typed", async () => {
      render(<App />)

      const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

      await waitFor(() => {
        expect(within(navigation).getByRole("button", { name: "Local Skills" })).toBeInTheDocument()
      })

      fireEvent.click(within(navigation).getByRole("button", { name: "Local Skills" }))

      await waitFor(() => {
        expect(screen.getByText("local-only")).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0])

      const dialog = await screen.findByRole("dialog", { name: "Delete skill" })

      const input = screen.getByLabelText("Type the skill name to confirm deletion:")
      fireEvent.change(input, { target: { value: "local-only" } })

      const deleteButton = within(dialog).getByRole("button", { name: "Delete" })
      expect(deleteButton).not.toBeDisabled()
    })

    it("does not enable delete button when wrong name is typed", async () => {
      render(<App />)

      const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

      await waitFor(() => {
        expect(within(navigation).getByRole("button", { name: "Local Skills" })).toBeInTheDocument()
      })

      fireEvent.click(within(navigation).getByRole("button", { name: "Local Skills" }))

      await waitFor(() => {
        expect(screen.getByText("local-only")).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0])

      const dialog = await screen.findByRole("dialog", { name: "Delete skill" })

      const input = screen.getByLabelText("Type the skill name to confirm deletion:")
      fireEvent.change(input, { target: { value: "wrong-name" } })

      const deleteButton = within(dialog).getByRole("button", { name: "Delete" })
      expect(deleteButton).toBeDisabled()
    })

    it("cancels delete without triggering deletion", async () => {
      render(<App />)

      const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

      await waitFor(() => {
        expect(within(navigation).getByRole("button", { name: "Local Skills" })).toBeInTheDocument()
      })

      fireEvent.click(within(navigation).getByRole("button", { name: "Local Skills" }))

      await waitFor(() => {
        expect(screen.getByText("local-only")).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0])

      await screen.findByRole("dialog", { name: "Delete skill" })

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      })

      expect(mockDesktopClient.deleteLocalSkill).not.toHaveBeenCalled()
    })

    it("confirms delete with correct name triggers deletion with correct groupRowKeys", async () => {
      render(<App />)

      const navigation = screen.getByRole("navigation", { name: "SkillDrive Desktop" })

      await waitFor(() => {
        expect(within(navigation).getByRole("button", { name: "Local Skills" })).toBeInTheDocument()
      })

      fireEvent.click(within(navigation).getByRole("button", { name: "Local Skills" }))

      await waitFor(() => {
        expect(screen.getByText("local-only")).toBeInTheDocument()
      })

      fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0])

      const dialog = await screen.findByRole("dialog", { name: "Delete skill" })

      const input = screen.getByLabelText("Type the skill name to confirm deletion:")
      fireEvent.change(input, { target: { value: "local-only" } })

      const deleteButton = within(dialog).getByRole("button", { name: "Delete" })
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(mockDesktopClient.deleteLocalSkill).toHaveBeenCalledWith({
          rowKey: "row-local-only",
          groupRowKeys: ["row-local-only"]
        })
      })
    })
  })
})
