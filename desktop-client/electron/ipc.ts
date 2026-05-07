import type { IpcMain } from "electron"
import type {
  AppLocale,
  AppTheme,
  AgentDetectionSnapshot,
  AgentPathsConfig,
  ConfigurationPayload,
  ConfigurationState,
  ConnectionTestResult,
  DesktopSyncState,
  LocalSkillUploadResult,
  LocalSkillsInventorySnapshot,
  PreDistributionCheckSnapshot,
  DirectorySelectionResult,
  ProjectAddPayload,
  ProjectImportSkillPayload,
  ProjectListSnapshot,
  ProjectOpenFolderPayload,
  ProjectRemovePayload,
  ProjectRenamePayload,
  ProjectScanPayload,
  ProjectSkillFolderValidation,
  ProjectSkillImportResult,
  ProjectSkillScanSnapshot,
  ProjectValidateSkillFolderPayload,
  SkillDistributionResult
} from "@/types"

export const desktopClientIpcChannels = {
  getConfiguration: "configuration:get",
  saveConfiguration: "configuration:save",
  saveLocale: "configuration:save-locale",
  saveTheme: "configuration:save-theme",
  clearConfiguration: "configuration:clear",
  testConnection: "configuration:test-connection",
  getAgentPathsConfig: "agent-paths:read",
  saveAgentPathsConfig: "agent-paths:save",
  openAgentPathsConfigDir: "agent-paths:open-config-dir",
  refreshSync: "sync:refresh",
  refreshAgentDetection: "agent-detection:refresh",
  refreshPreDistributionCheck: "pre-distribution-check:refresh",
  refreshLocalSkills: "local-skills:refresh",
  uploadLocalSkill: "local-skills:upload",
  projectsList: "projects:list",
  projectsAdd: "projects:add",
  projectsRename: "projects:rename",
  projectsRemove: "projects:remove",
  projectsSelectFolder: "projects:select-folder",
  projectsOpenFolder: "projects:open-folder",
  projectsScanSkills: "projects:scan-skills",
  projectsSelectSkillFolder: "projects:select-skill-folder",
  projectsValidateSkillFolder: "projects:validate-skill-folder",
  projectsImportSkill: "projects:import-skill",
  reconcileInstalledSkill: "distribution:reconcile-installed",
  distributePendingUpdate: "distribution:run"
} as const

export interface DesktopClientBridge {
  getConfiguration(): Promise<ConfigurationState>
  saveConfiguration(payload: ConfigurationPayload): Promise<ConfigurationState>
  saveLocale(locale: AppLocale): Promise<ConfigurationState>
  saveTheme(theme: AppTheme): Promise<ConfigurationState>
  clearConfiguration(): Promise<ConfigurationState>
  testConnection(payload: ConfigurationPayload): Promise<ConnectionTestResult>
  getAgentPathsConfig(): Promise<AgentPathsConfig>
  saveAgentPathsConfig(config: AgentPathsConfig): Promise<AgentPathsConfig>
  openAgentPathsConfigDir(): Promise<void>
  refreshSync(): Promise<DesktopSyncState>
  refreshAgentDetection(): Promise<AgentDetectionSnapshot>
  refreshPreDistributionCheck(): Promise<PreDistributionCheckSnapshot>
  refreshLocalSkills(): Promise<LocalSkillsInventorySnapshot>
  uploadLocalSkill(rowKey: string): Promise<LocalSkillUploadResult>
  listProjects(): Promise<ProjectListSnapshot>
  addProject(payload: ProjectAddPayload): Promise<ProjectListSnapshot>
  renameProject(payload: ProjectRenamePayload): Promise<ProjectListSnapshot>
  removeProject(payload: ProjectRemovePayload): Promise<ProjectListSnapshot>
  selectProjectFolder(): Promise<DirectorySelectionResult>
  openProjectFolder(payload: ProjectOpenFolderPayload): Promise<void>
  scanProjectSkills(payload: ProjectScanPayload): Promise<ProjectSkillScanSnapshot>
  selectProjectSkillFolder(): Promise<DirectorySelectionResult>
  validateProjectSkillFolder(
    payload: ProjectValidateSkillFolderPayload
  ): Promise<ProjectSkillFolderValidation>
  importProjectSkill(payload: ProjectImportSkillPayload): Promise<ProjectSkillImportResult>
  reconcileInstalledSkill(pendingUpdateId: string): Promise<DesktopSyncState>
  distributePendingUpdate(pendingUpdateId: string): Promise<SkillDistributionResult>
}

export interface DesktopClientIpcHandlers {
  getConfiguration(): Promise<ConfigurationState> | ConfigurationState
  saveConfiguration(payload: ConfigurationPayload): Promise<ConfigurationState>
  saveLocale(locale: AppLocale): Promise<ConfigurationState>
  saveTheme(theme: AppTheme): Promise<ConfigurationState>
  clearConfiguration(): Promise<ConfigurationState>
  testConnection(payload: ConfigurationPayload): Promise<ConnectionTestResult>
  getAgentPathsConfig(): Promise<AgentPathsConfig>
  saveAgentPathsConfig(config: AgentPathsConfig): Promise<AgentPathsConfig>
  openAgentPathsConfigDir(): Promise<void>
  refreshSync(): Promise<DesktopSyncState>
  refreshAgentDetection(): Promise<AgentDetectionSnapshot>
  refreshPreDistributionCheck(): Promise<PreDistributionCheckSnapshot>
  refreshLocalSkills(): Promise<LocalSkillsInventorySnapshot>
  uploadLocalSkill(rowKey: string): Promise<LocalSkillUploadResult>
  listProjects(): Promise<ProjectListSnapshot>
  addProject(payload: ProjectAddPayload): Promise<ProjectListSnapshot>
  renameProject(payload: ProjectRenamePayload): Promise<ProjectListSnapshot>
  removeProject(payload: ProjectRemovePayload): Promise<ProjectListSnapshot>
  selectProjectFolder(): Promise<DirectorySelectionResult>
  openProjectFolder(payload: ProjectOpenFolderPayload): Promise<void>
  scanProjectSkills(payload: ProjectScanPayload): Promise<ProjectSkillScanSnapshot>
  selectProjectSkillFolder(): Promise<DirectorySelectionResult>
  validateProjectSkillFolder(
    payload: ProjectValidateSkillFolderPayload
  ): Promise<ProjectSkillFolderValidation>
  importProjectSkill(payload: ProjectImportSkillPayload): Promise<ProjectSkillImportResult>
  reconcileInstalledSkill(pendingUpdateId: string): Promise<DesktopSyncState>
  distributePendingUpdate(pendingUpdateId: string): Promise<SkillDistributionResult>
}

export function registerDesktopClientIpc(
  ipcMain: Pick<IpcMain, "handle" | "removeHandler">,
  handlers: DesktopClientIpcHandlers
): void {
  ipcMain.removeHandler(desktopClientIpcChannels.getConfiguration)
  ipcMain.removeHandler(desktopClientIpcChannels.saveConfiguration)
  ipcMain.removeHandler(desktopClientIpcChannels.saveLocale)
  ipcMain.removeHandler(desktopClientIpcChannels.saveTheme)
  ipcMain.removeHandler(desktopClientIpcChannels.clearConfiguration)
  ipcMain.removeHandler(desktopClientIpcChannels.testConnection)
  ipcMain.removeHandler(desktopClientIpcChannels.getAgentPathsConfig)
  ipcMain.removeHandler(desktopClientIpcChannels.saveAgentPathsConfig)
  ipcMain.removeHandler(desktopClientIpcChannels.openAgentPathsConfigDir)
  ipcMain.removeHandler(desktopClientIpcChannels.refreshSync)
  ipcMain.removeHandler(desktopClientIpcChannels.refreshAgentDetection)
  ipcMain.removeHandler(desktopClientIpcChannels.refreshPreDistributionCheck)
  ipcMain.removeHandler(desktopClientIpcChannels.refreshLocalSkills)
  ipcMain.removeHandler(desktopClientIpcChannels.uploadLocalSkill)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsList)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsAdd)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsRename)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsRemove)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsSelectFolder)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsOpenFolder)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsScanSkills)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsSelectSkillFolder)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsValidateSkillFolder)
  ipcMain.removeHandler(desktopClientIpcChannels.projectsImportSkill)
  ipcMain.removeHandler(desktopClientIpcChannels.reconcileInstalledSkill)
  ipcMain.removeHandler(desktopClientIpcChannels.distributePendingUpdate)

  ipcMain.handle(desktopClientIpcChannels.getConfiguration, async () => handlers.getConfiguration())
  ipcMain.handle(desktopClientIpcChannels.saveConfiguration, async (_event, payload: ConfigurationPayload) =>
    handlers.saveConfiguration(payload)
  )
  ipcMain.handle(desktopClientIpcChannels.saveLocale, async (_event, locale: AppLocale) =>
    handlers.saveLocale(locale)
  )
  ipcMain.handle(desktopClientIpcChannels.saveTheme, async (_event, theme: AppTheme) =>
    handlers.saveTheme(theme)
  )
  ipcMain.handle(desktopClientIpcChannels.clearConfiguration, async () => handlers.clearConfiguration())
  ipcMain.handle(desktopClientIpcChannels.testConnection, async (_event, payload: ConfigurationPayload) =>
    handlers.testConnection(payload)
  )
  ipcMain.handle(desktopClientIpcChannels.getAgentPathsConfig, async () =>
    handlers.getAgentPathsConfig()
  )
  ipcMain.handle(desktopClientIpcChannels.saveAgentPathsConfig, async (_event, config: AgentPathsConfig) =>
    handlers.saveAgentPathsConfig(config)
  )
  ipcMain.handle(desktopClientIpcChannels.openAgentPathsConfigDir, async () =>
    handlers.openAgentPathsConfigDir()
  )
  ipcMain.handle(desktopClientIpcChannels.refreshSync, async () => handlers.refreshSync())
  ipcMain.handle(desktopClientIpcChannels.refreshAgentDetection, async () =>
    handlers.refreshAgentDetection()
  )
  ipcMain.handle(desktopClientIpcChannels.refreshPreDistributionCheck, async () =>
    handlers.refreshPreDistributionCheck()
  )
  ipcMain.handle(desktopClientIpcChannels.refreshLocalSkills, async () =>
    handlers.refreshLocalSkills()
  )
  ipcMain.handle(desktopClientIpcChannels.uploadLocalSkill, async (_event, rowKey: string) =>
    handlers.uploadLocalSkill(rowKey)
  )
  ipcMain.handle(desktopClientIpcChannels.projectsList, async () => handlers.listProjects())
  ipcMain.handle(desktopClientIpcChannels.projectsAdd, async (_event, payload: ProjectAddPayload) =>
    handlers.addProject(payload)
  )
  ipcMain.handle(
    desktopClientIpcChannels.projectsRename,
    async (_event, payload: ProjectRenamePayload) => handlers.renameProject(payload)
  )
  ipcMain.handle(
    desktopClientIpcChannels.projectsRemove,
    async (_event, payload: ProjectRemovePayload) => handlers.removeProject(payload)
  )
  ipcMain.handle(desktopClientIpcChannels.projectsSelectFolder, async () =>
    handlers.selectProjectFolder()
  )
  ipcMain.handle(
    desktopClientIpcChannels.projectsOpenFolder,
    async (_event, payload: ProjectOpenFolderPayload) => handlers.openProjectFolder(payload)
  )
  ipcMain.handle(
    desktopClientIpcChannels.projectsScanSkills,
    async (_event, payload: ProjectScanPayload) => handlers.scanProjectSkills(payload)
  )
  ipcMain.handle(desktopClientIpcChannels.projectsSelectSkillFolder, async () =>
    handlers.selectProjectSkillFolder()
  )
  ipcMain.handle(
    desktopClientIpcChannels.projectsValidateSkillFolder,
    async (_event, payload: ProjectValidateSkillFolderPayload) =>
      handlers.validateProjectSkillFolder(payload)
  )
  ipcMain.handle(
    desktopClientIpcChannels.projectsImportSkill,
    async (_event, payload: ProjectImportSkillPayload) => handlers.importProjectSkill(payload)
  )
  ipcMain.handle(
    desktopClientIpcChannels.reconcileInstalledSkill,
    async (_event, pendingUpdateId: string) => handlers.reconcileInstalledSkill(pendingUpdateId)
  )
  ipcMain.handle(
    desktopClientIpcChannels.distributePendingUpdate,
    async (_event, pendingUpdateId: string) => handlers.distributePendingUpdate(pendingUpdateId)
  )
}
