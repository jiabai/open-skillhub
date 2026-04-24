import type { IpcMain } from "electron"
import type {
  AppLocale,
  ConfigurationPayload,
  ConfigurationState,
  ConnectionTestResult,
  DesktopSyncState,
  SkillDistributionResult
} from "@/types"

export const desktopClientIpcChannels = {
  getConfiguration: "configuration:get",
  saveConfiguration: "configuration:save",
  saveLocale: "configuration:save-locale",
  clearConfiguration: "configuration:clear",
  testConnection: "configuration:test-connection",
  refreshSync: "sync:refresh",
  distributePendingUpdate: "distribution:run"
} as const

export interface DesktopClientBridge {
  getConfiguration(): Promise<ConfigurationState>
  saveConfiguration(payload: ConfigurationPayload): Promise<ConfigurationState>
  saveLocale(locale: AppLocale): Promise<ConfigurationState>
  clearConfiguration(): Promise<ConfigurationState>
  testConnection(payload: ConfigurationPayload): Promise<ConnectionTestResult>
  refreshSync(): Promise<DesktopSyncState>
  distributePendingUpdate(pendingUpdateId: string): Promise<SkillDistributionResult>
}

export interface DesktopClientIpcHandlers {
  getConfiguration(): Promise<ConfigurationState> | ConfigurationState
  saveConfiguration(payload: ConfigurationPayload): Promise<ConfigurationState>
  saveLocale(locale: AppLocale): Promise<ConfigurationState>
  clearConfiguration(): Promise<ConfigurationState>
  testConnection(payload: ConfigurationPayload): Promise<ConnectionTestResult>
  refreshSync(): Promise<DesktopSyncState>
  distributePendingUpdate(pendingUpdateId: string): Promise<SkillDistributionResult>
}

export function registerDesktopClientIpc(
  ipcMain: Pick<IpcMain, "handle" | "removeHandler">,
  handlers: DesktopClientIpcHandlers
): void {
  ipcMain.removeHandler(desktopClientIpcChannels.getConfiguration)
  ipcMain.removeHandler(desktopClientIpcChannels.saveConfiguration)
  ipcMain.removeHandler(desktopClientIpcChannels.saveLocale)
  ipcMain.removeHandler(desktopClientIpcChannels.clearConfiguration)
  ipcMain.removeHandler(desktopClientIpcChannels.testConnection)
  ipcMain.removeHandler(desktopClientIpcChannels.refreshSync)
  ipcMain.removeHandler(desktopClientIpcChannels.distributePendingUpdate)

  ipcMain.handle(desktopClientIpcChannels.getConfiguration, async () => handlers.getConfiguration())
  ipcMain.handle(desktopClientIpcChannels.saveConfiguration, async (_event, payload: ConfigurationPayload) =>
    handlers.saveConfiguration(payload)
  )
  ipcMain.handle(desktopClientIpcChannels.saveLocale, async (_event, locale: AppLocale) =>
    handlers.saveLocale(locale)
  )
  ipcMain.handle(desktopClientIpcChannels.clearConfiguration, async () => handlers.clearConfiguration())
  ipcMain.handle(desktopClientIpcChannels.testConnection, async (_event, payload: ConfigurationPayload) =>
    handlers.testConnection(payload)
  )
  ipcMain.handle(desktopClientIpcChannels.refreshSync, async () => handlers.refreshSync())
  ipcMain.handle(
    desktopClientIpcChannels.distributePendingUpdate,
    async (_event, pendingUpdateId: string) => handlers.distributePendingUpdate(pendingUpdateId)
  )
}
