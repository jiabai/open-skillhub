import { contextBridge, ipcRenderer } from "electron"

import type { DesktopClientBridge } from "./ipc"
import { desktopClientIpcChannels } from "./ipc"

const desktopClientBridge: DesktopClientBridge = {
  getConfiguration: () => ipcRenderer.invoke(desktopClientIpcChannels.getConfiguration),
  saveConfiguration: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.saveConfiguration, payload),
  clearConfiguration: () => ipcRenderer.invoke(desktopClientIpcChannels.clearConfiguration),
  testConnection: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.testConnection, payload),
  refreshSync: () => ipcRenderer.invoke(desktopClientIpcChannels.refreshSync),
  distributePendingUpdate: (pendingUpdateId: string) =>
    ipcRenderer.invoke(desktopClientIpcChannels.distributePendingUpdate, pendingUpdateId)
}

contextBridge.exposeInMainWorld("desktopClient", desktopClientBridge)
