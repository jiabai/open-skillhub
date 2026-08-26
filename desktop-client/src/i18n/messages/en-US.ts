import type { AppDictionary } from "@/i18n/messages/types"

export const enUSDictionary = {
  common: {
    loading: "Loading...",
    refresh: "Refresh",
    refreshing: "Refreshing",
    settings: "Settings",
    close: "Close",
    edit: "Edit",
    clear: "Clear",
    configureApi: "Configure API",
    saveConfiguration: "Save configuration",
    savingConfiguration: "Saving...",
    testConnection: "Test connection",
    testingConnection: "Testing...",
    distribute: "Distribute",
    distributing: "Distributing",
    syncRecord: "Sync record",
    syncingRecord: "Syncing...",
    pending: (count: number) => `${count} pending update${count === 1 ? "" : "s"}`,
    local: (value: string) => `Local ${value}`,
    remote: (value: string) => `Remote ${value}`,
    nA: "n/a",
    notRefreshedYet: "Not refreshed yet",
    bridgeUnavailable: (action: string) =>
      `Desktop bridge unavailable. Launch the Electron runtime with \`npm run start:electron\` to ${action}.`,
    cancel: "Cancel"
  },
  appShell: {
    brandTitle: "SkillDrive",
    brandSubtitle: "Desktop review client",
    desktopClientLabel: "SkillDrive Desktop",
    navigation: {
      home: "Home",
      localSkills: "Local Skills",
      updates: "Updates",
      projects: "Projects"
    },
    bridgeStatus: {
      unavailable: "Desktop bridge unavailable",
      loadingConfiguration: "Desktop bridge connected, loading configuration",
      editingConfiguration: "Desktop bridge connected, editing API configuration",
      tokenRequired: "Desktop bridge connected, API token required",
      loadingReviewState: "Desktop bridge connected, loading review state",
      connected: "Desktop bridge connected",
      connectedWithPending: (count: number) =>
        `Desktop bridge connected, ${count} pending update${count === 1 ? "" : "s"}`,
      error: (message: string) => `Desktop bridge error: ${message}`
    }
  },
  themeToggle: {
    switchTheme: "Toggle theme",
    saveAction: "toggle theme"
  },
  homeView: {
    eyebrow: "Desktop client",
    title: "Review updates",
    summary:
      "A quiet desktop surface for checking pending skill updates and approving distribution only when you are ready.",
    refreshState: "Refresh state",
    settings: "Settings",
    bridgeUnavailableTitle: "Desktop bridge unavailable",
    bridgeUnavailableDetail: "The renderer cannot reach the preload bridge in this environment.",
    tokenNeededTitle: "API token needed",
    tokenNeededDetail: "Review sync is paused until API configuration is saved.",
    refreshFailedTitle: "Refresh failed",
    metrics: {
      pendingUpdates: {
        label: "Pending updates",
        detail: "Items waiting for review."
      },
      successfulDistributions: {
        label: "Successful distributions",
        detail: "Completed successful distribution operations."
      },
      installedAgents: {
        label: "Installed agents",
        detail: "Detected local SKILL-capable assistants."
      },
      lastRefresh: {
        label: "Last refresh",
        detail: "Latest bridge snapshot."
      }
    },
    needsReviewTitle: "Needs review",
    needsReviewDescription: "Showing up to 3 pending updates here. The full queue lives in Updates.",
    loadingPendingUpdates: "Loading pending updates...",
    noPendingUpdates: "No pending updates are waiting for review.",
    viewAllUpdates: "View all updates",
    distribute: (name: string) => `Distribute ${name}`,
    syncLocalRecord: (name: string) => `Sync local record for ${name}`,
    distributing: "Distributing",
    badges: {
      local: (value: string) => `Local ${value}`,
      remote: (value: string) => `Remote ${value}`
    },
    reasonLabels: {
      missingLocalRecord: "Not installed",
      versionMismatch: "Content changed"
    }
  },
  updatesView: {
    eyebrow: "Review queue",
    title: "All pending updates",
    inventoryTitle: "Inventory",
    summary: "Inspect every pending skill update before distributing it to configured local agent targets."
  },
  localSkillsView: {
    eyebrow: "",
    title: "Local Skills",
    summary: "",
    refresh: "Refresh local skills",
    refreshing: "Refreshing...",
    loading: "Loading local skills...",
    noSnapshot: "Local skill inventory has not been refreshed yet.",
    empty: "No local skill package roots were found.",
    upload: "Upload",
    uploading: "Uploading...",
    delete: "Delete",
    deleting: "Deleting...",
    openFolder: "Open Folder",
    openPathDialogTitle: "Choose local path",
    openPathDialogDescription: (name: string, count: number) => `Select which local path to open for ${name} (${count} paths).`,
    openPathDialogPathLabel: (path: string) => `Path ${path}`,
    openPathDialogPathAgents: (agents: string) => `Used by: ${agents}`,
    openPathDialogConfirm: "Open path",
    sourceAgents: (value: string) => `Sources ${value}`,
    localVersion: (value: string) => `Local ${value}`,
    localPath: (value: string) => `Directory ${value}`,
    remoteVersion: (value: string) => `Remote ${value}`,
    remoteId: (value: string) => `Remote ID ${value}`,
    validationReason: (value: string) => `Validation ${value}`,
    serverLookupWarning: (value: string) => `Server lookup unavailable: ${value}`,
    pathCount: (count: number) => `${count} paths`,
    versionConflict: "Version mismatch across paths",
    serverStateLabels: {
      existing: "On server",
      missing: "Missing on server",
      unknown: "Server unknown",
      invalidLocal: "Invalid local skill",
      updateAvailable: "Update available on server"
    },
    deleteConfirmTitle: "Delete skill",
    deleteConfirmDescription: (name: string, count: number) => `This will permanently delete '${name}' from ${count} location${count > 1 ? "s" : ""}.`,
    deleteConfirmWarning: "This action cannot be undone. The following paths will be permanently removed from disk:",
    deleteConfirmPathAgent: (agents: string) => `Used by: ${agents}`,
    deleteConfirmDestructiveHint: "Type the skill name to confirm deletion:",
    deleteConfirmDestructivePlaceholder: "Type skill name here",
    deleteConfirmButton: "Delete"
  },
  projectsView: {
    eyebrow: "",
    title: "Projects",
    summary: "",
    addProject: "Add Project",
    addProjectTitle: "Add project",
    addProjectDescription: "Choose a local project folder to scan for project-level agent skills.",
    nameLabel: "Project name",
    pathLabel: "Project folder",
    browse: "Browse",
    saving: "Saving...",
    empty: "No projects have been added yet.",
    noSnapshot: "Projects have not been loaded yet.",
    projectsCount: (count: number) => `${count} project${count === 1 ? "" : "s"}`,
    open: "Open",
    rename: "Rename",
    renameTitle: "Rename project",
    remove: "Remove",
    removeTitle: "Remove project",
    removeDescription: (name: string) =>
      `Remove ${name} from this list. Files on disk will not be deleted.`,
    confirmRemove: "Remove project",
    cancel: "Cancel",
    back: "Back",
    openFolder: "Open Folder",
    refreshSkills: "Refresh Skills",
    scanning: "Scanning...",
    addSkill: "Add Skill",
    importTitle: "Add skill to project",
    importDescription: "Validate a local skill folder and copy it into the selected project target.",
    sourceFolderLabel: "Source skill folder",
    targetAgentLabel: "Target agent",
    overwriteLabel: "Overwrite existing target skill",
    validate: "Validate",
    validating: "Validating...",
    import: "Import",
    importing: "Importing...",
    noTargets: "No writable project targets are available.",
    loading: "Loading projects...",
    skillCount: (count: number) => `${count} skill${count === 1 ? "" : "s"}`,
    targetCount: (count: number) => `${count} project target${count === 1 ? "" : "s"}`,
    sourceLabels: {
      project: "Project",
      global: "Global"
    },
    validationStateLabels: {
      valid: "Valid",
      "missing-skill-md": "Missing SKILL.md",
      "invalid-skill-name": "Invalid name",
      unreadable: "Unreadable",
      "not-directory": "Not a directory"
    },
    version: (value: string) => `Version ${value}`,
    sourceAgents: (value: string) => `Agents ${value}`,
    path: (value: string) => `Path ${value}`
  },
  settingsPanel: {
    title: "Settings",
    heading: "Review controls",
    reviewPolicyLabel: "Review policy",
    reviewPolicyValue: "Pending updates stay gated until a human reviews them.",
    bridgeAccessLabel: "Bridge access",
    bridgeAccessValue: "IPC wrapper only. No direct Node access from the renderer.",
    storageSnapshotLabel: "Storage snapshot",
    storageSnapshotValue: "Local state is refreshed before and after distribution."
  },
  language: {
    title: "Language",
    description: "Choose the language used by the desktop client.",
    currentPrefix: "Current:",
    zhCNLabel: "Chinese (Simplified)",
    enUSLabel: "English",
    switchToChinese: "Switch to Chinese",
    switchToEnglish: "Switch to English"
  },
  settingsDrawer: {
    title: "Desktop settings",
    description: "Connection, distribution targets, recent local activity, and language preferences.",
    bridgeStatusTitle: "Bridge status",
    tokenConfigured: "Token configured",
    tokenMissing: "Token missing",
    lastRefreshLabel: "Last refresh"
  },
  configStatus: {
    title: "API configuration",
    configured: "Configured",
    missing: "Missing",
    apiBaseUrl: "API Base URL",
    tokenSource: "Token source",
    loading: "Loading...",
    warning: "Warning",
    edit: "Edit",
    clearing: "Clearing...",
    clearSavedConfig: "Clear saved config",
    sourceLabels: {
      "secret-store": "Secret store",
      environment: "Environment variable",
      missing: "Missing"
    }
  },
  configPanel: {
    section: "Configuration",
    title: "API token",
    description: "Configure the server URL and the token used by desktop sync.",
    apiBaseUrlLabel: "API Base URL",
    apiTokenLabel: "API Token",
    apiTokenPlaceholder: "Leave blank to keep the current token",
    tokenHelpConfigured: "A token is already available; enter a new one only when rotating credentials.",
    tokenHelpMissing: "A token is required before review sync can start.",
    saveConfiguration: "Save configuration",
    savingConfiguration: "Saving...",
    testConnection: "Test connection",
    testingConnection: "Testing...",
    saveAction: "save configuration",
    testAction: "test the connection"
  },
  pendingUpdatesPanel: {
    eyebrow: "Review queue",
    title: "Pending updates",
    description: (count: number) => `${count} item${count === 1 ? "" : "s"} awaiting approval.`,
    loading: "Loading pending updates...",
    noPendingUpdates: "No pending updates are waiting for review.",
    refreshCheck: "Refresh Check",
    refreshingCheck: "Checking...",
    distribute: "Distribute",
    distributing: "Distributing",
    syncLocalRecord: "Sync record",
    syncingRecord: "Syncing...",
    reviewReasonLabel: "Review reason:",
    reasonLabels: {
      missingLocalRecord: "Not installed",
      versionMismatch: "Content changed"
    }
  },
  preDistributionCheck: {
    loading: "Checking configured agent targets...",
    refreshNeeded: "Refresh check to read installed target content before distribution.",
    stale: "Check results are stale. Refresh before relying on target content claims.",
    noTargets: "No configured agent targets are available for this check.",
    globalErrorsTitle: "Pre-distribution check warning",
    targetCheckTitle: "Target check",
    lastChecked: (value: string) => `Last checked ${value}`,
    warningBeforeDistribute: "Review target warnings before distributing.",
    targetDirectory: (value: string) => `Directory ${value}`,
    installedVersion: (value: string) => `Installed ${value}`,
    versionSourceLabels: {
      "skill-frontmatter": "SKILL.md",
      "manifest-json": "manifest.json",
      "nested-manifest-json": "skills/manifest.json",
      unknown: "version source unknown"
    },
    comparisonLabels: {
      "not-installed": "Not installed on this target.",
      installed: (remote: string) =>
        `Installed content already matches remote ${remote}; distribution will skip this target.`,
      update: (remote: string) =>
        `Installed content differs from remote ${remote}; distribution will write this target.`,
      error: (message: string) => `Check failed: ${message}`
    },
    comparisonStatusLabels: {
      "not-installed": "Not installed",
      installed: "Installed",
      update: "Update",
      error: "Error"
    }
  },
  distributionConfirmation: {
    title: "Confirm distribution",
    description: (name: string) => `Review the detected targets before distributing ${name}.`,
    destructiveWarning:
      "Distribution can overwrite files in the target skill directory. Continue only after reviewing local changes.",
    writeTargetsTitle: "Will write to",
    skippedTargetsTitle: "Already up to date",
    missingAgentsTitle: "Missing assistants skipped",
    noWriteTargets: "No detected write targets.",
    noSkippedTargets: "No already-installed targets.",
    noMissingAgents: "No missing supported assistants.",
    confirm: "Confirm distribution",
    cancel: "Cancel"
  },
  agentsPanel: {
    eyebrow: "Agents",
    title: "Distribution targets",
    description: "Local assistant detection decides which targets can receive approved updates.",
    rediscover: "Rediscover",
    rediscovering: "Detecting...",
    openConfigDir: "Open Agent Paths Config",
    noSnapshot: "Agent detection has not run yet.",
    summary: (installed: number, supported: number) =>
      `${installed} installed of ${supported} supported agents.`,
    statusLabels: {
      installed: "Installed",
      missing: "Not installed",
      autoDetected: "Detected or configured"
    },
    targetPath: (value: string) => `Target ${value}`,
    detectionDirs: (value: string) => `Detection ${value}`
  },
  activityPanel: {
    eyebrow: "Activity",
    title: "Recent actions",
    description: "Latest local events from this desktop session.",
    empty: "No recent actions yet."
  },
  activity: {
    consoleReadyTitle: "Console ready",
    consoleReadyDetail: "Pending updates will stay visible until an operator distributes them.",
    apiTokenNeededTitle: "API token needed",
    apiTokenNeededDetail: "Review sync is paused until configuration is saved.",
    reviewSnapshotLoadedTitle: "Review snapshot loaded",
    reviewSnapshotLoadedDetail: (count: number) =>
      `${count} pending update${count === 1 ? "" : "s"} are ready for review.`,
    refreshFailedTitle: "Refresh failed",
    refreshFailedDetail: (message: string) => message,
    reviewSnapshotRefreshedTitle: "Review snapshot refreshed",
    reviewSnapshotRefreshedDetail: (count: number) =>
      `${count} pending update${count === 1 ? "" : "s"} are visible again.`,
    configurationSavedTitle: "Configuration saved",
    configurationSavedDetail: "Runtime sync is using the latest API settings.",
    connectionTestSucceededTitle: "Connection test succeeded",
    connectionTestFailedTitle: "Connection test failed",
    configurationClearedTitle: "Configuration cleared",
    configurationClearedDetail: "Review sync has been paused.",
    configurationSaveFailedTitle: "Configuration save failed",
    configurationSaveFailedDetail: (message: string) => message,
    configurationClearFailedTitle: "Configuration clear failed",
    configurationClearFailedDetail: (message: string) => message,
    distributionCompletedTitle: "Distribution completed",
    distributionCompletedWithWarningsTitle: "Distribution completed with warnings",
    distributionCompletedDetail: (detail: string) => detail,
    distributionCompletedWithRefreshWarningTitle: "Distribution completed with refresh warning",
    distributionCompletedWithRefreshWarningDetail: (detail: string, message: string) =>
      `${detail} Refreshing the review snapshot then failed: ${message}`,
    distributionFailedTitle: "Distribution failed",
    distributionFailedDetail: (name: string, message: string) =>
      `${name} could not be distributed: ${message}`,
    localRecordSyncedTitle: "Local record synced",
    localRecordSyncedDetail: (name: string) =>
      `${name} is already installed on every detected target, so the local review record was updated.`,
    localRecordSyncFailedTitle: "Local record sync failed",
    localRecordSyncFailedDetail: (name: string, message: string) =>
      `${name} could not be marked as synced: ${message}`,
    localSkillUploadedTitle: "Local skill uploaded",
    localSkillUploadedDetail: (name: string) => `${name} was uploaded to the server.`,
    localSkillUploadFailedTitle: "Local skill upload failed",
    localSkillUploadFailedDetail: (name: string, message: string) =>
      `${name} could not be uploaded: ${message}`,
    localSkillDeletedTitle: "Local skill deleted",
    localSkillDeletedDetail: (name: string) => `${name} was deleted from disk.`,
    localSkillDeleteFailedTitle: "Local skill deletion failed",
    localSkillDeleteFailedDetail: (name: string, message: string) =>
      `${name} could not be deleted: ${message}`,
    openFolderFailedTitle: "Open folder failed",
    openFolderFailedDetail: (name: string, message: string) =>
      `Could not open folder for ${name}: ${message}`,
    projectAddedTitle: "Project added",
    projectAddedDetail: (name: string) => `${name} is ready for project skill scanning.`,
    projectRenamedTitle: "Project renamed",
    projectRenamedDetail: (name: string) => `Project is now named ${name}.`,
    projectRemovedTitle: "Project removed",
    projectRemovedDetail: (name: string) => `${name} was removed from the list. Files were not deleted.`,
    projectScanFailedTitle: "Project scan failed",
    projectScanFailedDetail: (name: string, message: string) => `${name} could not be scanned: ${message}`,
    projectSkillImportedTitle: "Project skill imported",
    projectSkillImportedDetail: (name: string, project: string) => `${name} was imported into ${project}.`,
    projectSkillImportFailedTitle: "Project skill import failed",
    projectSkillImportFailedDetail: (name: string, message: string) => `${name} could not be imported: ${message}`,
    themeUpdateFailedTitle: "Theme update failed",
    themeUpdateFailedDetail: (message: string) => message
  }
} satisfies AppDictionary
