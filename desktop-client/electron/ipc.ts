import type { IpcMain } from "electron"
import type { DesktopSyncState, SkillDistributionResult } from "@/types"

export const desktopClientIpcChannels = {
  refreshSync: "sync:refresh",
  distributePendingUpdate: "distribution:run"
} as const

export interface DesktopClientBridge {
  refreshSync(): Promise<DesktopSyncState>
  distributePendingUpdate(pendingUpdateId: string): Promise<SkillDistributionResult>
}

export interface DesktopClientIpcHandlers {
  refreshSync(): Promise<DesktopSyncState>
  distributePendingUpdate(pendingUpdateId: string): Promise<SkillDistributionResult>
}

export function registerDesktopClientIpc(
  ipcMain: Pick<IpcMain, "handle" | "removeHandler">,
  handlers: DesktopClientIpcHandlers
): void {
  ipcMain.removeHandler(desktopClientIpcChannels.refreshSync)
  ipcMain.removeHandler(desktopClientIpcChannels.distributePendingUpdate)

  ipcMain.handle(desktopClientIpcChannels.refreshSync, async () => handlers.refreshSync())
  ipcMain.handle(
    desktopClientIpcChannels.distributePendingUpdate,
    async (_event, pendingUpdateId: string) => handlers.distributePendingUpdate(pendingUpdateId)
  )
}
