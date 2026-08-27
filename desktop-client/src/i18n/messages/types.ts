import type { AppLocale } from "@/types"

export interface AppDictionary {
  common: {
    loading: string
    refresh: string
    refreshing: string
    settings: string
    close: string
    edit: string
    clear: string
    configureApi: string
    saveConfiguration: string
    savingConfiguration: string
    testConnection: string
    testingConnection: string
    distribute: string
    distributing: string
    syncRecord: string
    syncingRecord: string
    pending: (count: number) => string
    local: (value: string) => string
    remote: (value: string) => string
    nA: string
    notRefreshedYet: string
    bridgeUnavailable: (action: string) => string
    cancel: string
  }
  appShell: {
    brandTitle: string
    brandSubtitle: string
    desktopClientLabel: string
    navigation: {
      home: string
      localSkills: string
      updates: string
      projects: string
    }
    bridgeStatus: {
      unavailable: string
      loadingConfiguration: string
      editingConfiguration: string
      tokenRequired: string
      loadingReviewState: string
      connected: string
      connectedWithPending: (count: number) => string
      error: (message: string) => string
    }
  }
  themeToggle: {
    switchTheme: string
    saveAction: string
  }
  homeView: {
    eyebrow: string
    title: string
    summary: string
    refreshState: string
    settings: string
    bridgeUnavailableTitle: string
    bridgeUnavailableDetail: string
    tokenNeededTitle: string
    tokenNeededDetail: string
    refreshFailedTitle: string
    metrics: {
      pendingUpdates: {
        label: string
        detail: string
      }
      successfulDistributions: {
        label: string
        detail: string
      }
      installedAgents: {
        label: string
        detail: string
      }
      lastRefresh: {
        label: string
        detail: string
      }
    }
    needsReviewTitle: string
    needsReviewDescription: string
    loadingPendingUpdates: string
    noPendingUpdates: string
    viewAllUpdates: string
    distribute: (name: string) => string
    syncLocalRecord: (name: string) => string
    distributing: string
    badges: {
      local: (value: string) => string
      remote: (value: string) => string
    }
    reasonLabels: {
      missingLocalRecord: string
      versionMismatch: string
    }
  }
  updatesView: {
    eyebrow: string
    title: string
    inventoryTitle: string
    summary: string
    batch: {
      controlsLabel: string
      selectionLabel: string
      selectAll: string
      selectItem: (name: string) => string
      clear: string
      distribute: string
      selected: (selected: number, total: number) => string
      progress: (completed: number, total: number) => string
      completed: string
      completedWithWarnings: string
      summary: (
        succeeded: number,
        partial: number,
        failed: number,
        total: number
      ) => string
      confirmationTitle: string
      confirmationDescription: (names: string[]) => string
      unknownError: string
    }
  }
  reviewWorkspace: {
    steps: string
    checkStatus: {
      current: string
      stale: string
      missing: string
      error: string
    }
    selected: (count: number) => string
    blocked: (count: number) => string
    writeTargets: (count: number) => string
    selectItem: (name: string) => string
    selectAll: string
    clearSelection: string
    distributeSelected: (count: number) => string
    distributing: (completed: number, total: number) => string
    columns: {
      select: string
      status: string
      change: string
      targets: string
      version: string
    }
    statuses: {
      ready: string
      blocked: string
      installed: string
    }
    blockedReason: string
    summaryTitle: string
    confirmationTitle: (count: number) => string
    batchCompleted: (succeeded: number, partial: number, failed: number) => string
  }
  localSkillsView: {
    eyebrow: string
    title: string
    summary: string
    refresh: string
    refreshing: string
    loading: string
    noSnapshot: string
    empty: string
    upload: string
    uploading: string
    delete: string
    deleting: string
    openFolder: string
    openPathDialogTitle: string
    openPathDialogDescription: (name: string, count: number) => string
    openPathDialogPathLabel: (path: string) => string
    openPathDialogPathAgents: (agents: string) => string
    openPathDialogConfirm: string
    sourceAgents: (value: string) => string
    localVersion: (value: string) => string
    localPath: (value: string) => string
    remoteVersion: (value: string) => string
    remoteId: (value: string) => string
    validationReason: (value: string) => string
    serverLookupWarning: (value: string) => string
    pathCount: (count: number) => string
    versionConflict: string
    serverStateLabels: {
      existing: string
      missing: string
      unknown: string
      invalidLocal: string
      updateAvailable: string
    }
    deleteConfirmTitle: string
    deleteConfirmDescription: (name: string, count: number) => string
    deleteConfirmWarning: string
    deleteConfirmPathAgent: (agents: string) => string
    deleteConfirmDestructiveHint: string
    deleteConfirmDestructivePlaceholder: string
    deleteConfirmButton: string
  }
  projectsView: {
    eyebrow: string
    title: string
    summary: string
    addProject: string
    addProjectTitle: string
    addProjectDescription: string
    nameLabel: string
    pathLabel: string
    browse: string
    saving: string
    empty: string
    noSnapshot: string
    projectsCount: (count: number) => string
    open: string
    rename: string
    renameTitle: string
    remove: string
    removeTitle: string
    removeDescription: (name: string) => string
    confirmRemove: string
    cancel: string
    back: string
    openFolder: string
    refreshSkills: string
    scanning: string
    addSkill: string
    importTitle: string
    importDescription: string
    sourceFolderLabel: string
    targetAgentLabel: string
    overwriteLabel: string
    validate: string
    validating: string
    import: string
    importing: string
    noTargets: string
    loading: string
    skillCount: (count: number) => string
    targetCount: (count: number) => string
    sourceLabels: {
      project: string
      global: string
    }
    validationStateLabels: {
      valid: string
      "missing-skill-md": string
      "invalid-skill-name": string
      unreadable: string
      "not-directory": string
    }
    version: (value: string) => string
    sourceAgents: (value: string) => string
    path: (value: string) => string
  }
  settingsPanel: {
    title: string
    heading: string
    reviewPolicyLabel: string
    reviewPolicyValue: string
    bridgeAccessLabel: string
    bridgeAccessValue: string
    storageSnapshotLabel: string
    storageSnapshotValue: string
  }
  language: {
    title: string
    description: string
    currentPrefix: string
    zhCNLabel: string
    enUSLabel: string
    switchToChinese: string
    switchToEnglish: string
  }
  settingsDrawer: {
    title: string
    description: string
    bridgeStatusTitle: string
    tokenConfigured: string
    tokenMissing: string
    lastRefreshLabel: string
  }
  configStatus: {
    title: string
    configured: string
    missing: string
    apiBaseUrl: string
    tokenSource: string
    loading: string
    warning: string
    edit: string
    clearing: string
    clearSavedConfig: string
    sourceLabels: {
      "secret-store": string
      environment: string
      missing: string
    }
  }
  configPanel: {
    section: string
    title: string
    description: string
    apiBaseUrlLabel: string
    apiTokenLabel: string
    apiTokenPlaceholder: string
    tokenHelpConfigured: string
    tokenHelpMissing: string
    saveConfiguration: string
    savingConfiguration: string
    testConnection: string
    testingConnection: string
    saveAction: string
    testAction: string
  }
  pendingUpdatesPanel: {
    eyebrow: string
    title: string
    description: (count: number) => string
    loading: string
    noPendingUpdates: string
    refreshCheck: string
    refreshingCheck: string
    distribute: string
    distributing: string
    syncLocalRecord: string
    syncingRecord: string
    reviewReasonLabel: string
    reasonLabels: {
      missingLocalRecord: string
      versionMismatch: string
    }
  }
  preDistributionCheck: {
    loading: string
    refreshNeeded: string
    stale: string
    noTargets: string
    globalErrorsTitle: string
    targetCheckTitle: string
    lastChecked: (value: string) => string
    warningBeforeDistribute: string
    targetDirectory: (value: string) => string
    installedVersion: (value: string) => string
    versionSourceLabels: {
      "skill-frontmatter": string
      "manifest-json": string
      "nested-manifest-json": string
      unknown: string
    }
    comparisonLabels: {
      "not-installed": string
      installed: (remote: string) => string
      update: (remote: string) => string
      error: (message: string) => string
    }
    comparisonStatusLabels: {
      "not-installed": string
      installed: string
      update: string
      error: string
    }
  }
  distributionConfirmation: {
    title: string
    description: (name: string) => string
    destructiveWarning: string
    writeTargetsTitle: string
    skippedTargetsTitle: string
    missingAgentsTitle: string
    noWriteTargets: string
    noSkippedTargets: string
    noMissingAgents: string
    confirm: string
    cancel: string
  }
  agentsPanel: {
    eyebrow: string
    title: string
    description: string
    rediscover: string
    rediscovering: string
    openConfigDir: string
    noSnapshot: string
    summary: (installed: number, supported: number) => string
    statusLabels: {
      installed: string
      missing: string
      autoDetected: string
    }
    targetPath: (value: string) => string
    detectionDirs: (value: string) => string
  }
  activityPanel: {
    eyebrow: string
    title: string
    description: string
    empty: string
  }
  activity: {
    consoleReadyTitle: string
    consoleReadyDetail: string
    apiTokenNeededTitle: string
    apiTokenNeededDetail: string
    reviewSnapshotLoadedTitle: string
    reviewSnapshotLoadedDetail: (count: number) => string
    refreshFailedTitle: string
    refreshFailedDetail: (message: string) => string
    reviewSnapshotRefreshedTitle: string
    reviewSnapshotRefreshedDetail: (count: number) => string
    configurationSavedTitle: string
    configurationSavedDetail: string
    connectionTestSucceededTitle: string
    connectionTestFailedTitle: string
    configurationClearedTitle: string
    configurationClearedDetail: string
    configurationSaveFailedTitle: string
    configurationSaveFailedDetail: (message: string) => string
    configurationClearFailedTitle: string
    configurationClearFailedDetail: (message: string) => string
    distributionCompletedTitle: string
    distributionCompletedWithWarningsTitle: string
    distributionCompletedDetail: (detail: string) => string
    distributionCompletedWithRefreshWarningTitle: string
    distributionCompletedWithRefreshWarningDetail: (detail: string, message: string) => string
    distributionFailedTitle: string
    distributionFailedDetail: (name: string, message: string) => string
    localRecordSyncedTitle: string
    localRecordSyncedDetail: (name: string) => string
    localRecordSyncFailedTitle: string
    localRecordSyncFailedDetail: (name: string, message: string) => string
    localSkillUploadedTitle: string
    localSkillUploadedDetail: (name: string) => string
    localSkillUploadFailedTitle: string
    localSkillUploadFailedDetail: (name: string, message: string) => string
    localSkillDeletedTitle: string
    localSkillDeletedDetail: (name: string) => string
    localSkillDeleteFailedTitle: string
    localSkillDeleteFailedDetail: (name: string, message: string) => string
    openFolderFailedTitle: string
    openFolderFailedDetail: (name: string, message: string) => string
    projectAddedTitle: string
    projectAddedDetail: (name: string) => string
    projectRenamedTitle: string
    projectRenamedDetail: (name: string) => string
    projectRemovedTitle: string
    projectRemovedDetail: (name: string) => string
    projectScanFailedTitle: string
    projectScanFailedDetail: (name: string, message: string) => string
    projectSkillImportedTitle: string
    projectSkillImportedDetail: (name: string, project: string) => string
    projectSkillImportFailedTitle: string
    projectSkillImportFailedDetail: (name: string, message: string) => string
    themeUpdateFailedTitle: string
    themeUpdateFailedDetail: (message: string) => string
  }
}

export type DictionaryLocale = AppLocale
