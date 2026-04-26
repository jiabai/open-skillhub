import { contextBridge, ipcRenderer } from "electron"

import type { DesktopClientBridge } from "./ipc"
import { desktopClientIpcChannels } from "./ipc"

const desktopClientBridge: DesktopClientBridge = {
  getConfiguration: () => ipcRenderer.invoke(desktopClientIpcChannels.getConfiguration),
  saveConfiguration: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.saveConfiguration, payload),
  saveLocale: (locale) => ipcRenderer.invoke(desktopClientIpcChannels.saveLocale, locale),
  clearConfiguration: () => ipcRenderer.invoke(desktopClientIpcChannels.clearConfiguration),
  testConnection: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.testConnection, payload),
  refreshSync: () => ipcRenderer.invoke(desktopClientIpcChannels.refreshSync),
  refreshPreDistributionCheck: () =>
    ipcRenderer.invoke(desktopClientIpcChannels.refreshPreDistributionCheck),
  distributePendingUpdate: (pendingUpdateId: string) =>
    ipcRenderer.invoke(desktopClientIpcChannels.distributePendingUpdate, pendingUpdateId)
}

contextBridge.exposeInMainWorld("desktopClient", desktopClientBridge)
