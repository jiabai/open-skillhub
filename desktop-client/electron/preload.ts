import { contextBridge, ipcRenderer } from "electron"

import type { DesktopClientBridge } from "./ipc"
import { desktopClientIpcChannels } from "./ipc"

const desktopClientBridge: DesktopClientBridge = {
  getConfiguration: () => ipcRenderer.invoke(desktopClientIpcChannels.getConfiguration),
  saveConfiguration: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.saveConfiguration, payload),
  saveLocale: (locale) => ipcRenderer.invoke(desktopClientIpcChannels.saveLocale, locale),
  saveTheme: (theme) => ipcRenderer.invoke(desktopClientIpcChannels.saveTheme, theme),
  clearConfiguration: () => ipcRenderer.invoke(desktopClientIpcChannels.clearConfiguration),
  testConnection: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.testConnection, payload),
  refreshSync: () => ipcRenderer.invoke(desktopClientIpcChannels.refreshSync),
  refreshAgentDetection: () =>
    ipcRenderer.invoke(desktopClientIpcChannels.refreshAgentDetection),
  refreshPreDistributionCheck: () =>
    ipcRenderer.invoke(desktopClientIpcChannels.refreshPreDistributionCheck),
  refreshLocalSkills: () => ipcRenderer.invoke(desktopClientIpcChannels.refreshLocalSkills),
  uploadLocalSkill: (rowKey: string) =>
    ipcRenderer.invoke(desktopClientIpcChannels.uploadLocalSkill, rowKey),
  reconcileInstalledSkill: (pendingUpdateId: string) =>
    ipcRenderer.invoke(desktopClientIpcChannels.reconcileInstalledSkill, pendingUpdateId),
  distributePendingUpdate: (pendingUpdateId: string) =>
    ipcRenderer.invoke(desktopClientIpcChannels.distributePendingUpdate, pendingUpdateId)
}

contextBridge.exposeInMainWorld("desktopClient", desktopClientBridge)
