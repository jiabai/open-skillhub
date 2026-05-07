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
  getAgentPathsConfig: () => ipcRenderer.invoke(desktopClientIpcChannels.getAgentPathsConfig),
  saveAgentPathsConfig: (config) =>
    ipcRenderer.invoke(desktopClientIpcChannels.saveAgentPathsConfig, config),
  openAgentPathsConfigDir: () =>
    ipcRenderer.invoke(desktopClientIpcChannels.openAgentPathsConfigDir),
  refreshSync: () => ipcRenderer.invoke(desktopClientIpcChannels.refreshSync),
  refreshAgentDetection: () =>
    ipcRenderer.invoke(desktopClientIpcChannels.refreshAgentDetection),
  refreshPreDistributionCheck: () =>
    ipcRenderer.invoke(desktopClientIpcChannels.refreshPreDistributionCheck),
  refreshLocalSkills: () => ipcRenderer.invoke(desktopClientIpcChannels.refreshLocalSkills),
  uploadLocalSkill: (rowKey: string) =>
    ipcRenderer.invoke(desktopClientIpcChannels.uploadLocalSkill, rowKey),
  listProjects: () => ipcRenderer.invoke(desktopClientIpcChannels.projectsList),
  addProject: (payload) => ipcRenderer.invoke(desktopClientIpcChannels.projectsAdd, payload),
  renameProject: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.projectsRename, payload),
  removeProject: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.projectsRemove, payload),
  selectProjectFolder: () => ipcRenderer.invoke(desktopClientIpcChannels.projectsSelectFolder),
  openProjectFolder: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.projectsOpenFolder, payload),
  scanProjectSkills: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.projectsScanSkills, payload),
  selectProjectSkillFolder: () =>
    ipcRenderer.invoke(desktopClientIpcChannels.projectsSelectSkillFolder),
  validateProjectSkillFolder: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.projectsValidateSkillFolder, payload),
  importProjectSkill: (payload) =>
    ipcRenderer.invoke(desktopClientIpcChannels.projectsImportSkill, payload),
  reconcileInstalledSkill: (pendingUpdateId: string) =>
    ipcRenderer.invoke(desktopClientIpcChannels.reconcileInstalledSkill, pendingUpdateId),
  distributePendingUpdate: (pendingUpdateId: string) =>
    ipcRenderer.invoke(desktopClientIpcChannels.distributePendingUpdate, pendingUpdateId)
}

contextBridge.exposeInMainWorld("desktopClient", desktopClientBridge)
