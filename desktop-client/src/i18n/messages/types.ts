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
    pending: (count: number) => string
    local: (value: string) => string
    remote: (value: string) => string
    nA: string
    notRefreshedYet: string
    bridgeUnavailable: (action: string) => string
  }
  appShell: {
    brandTitle: string
    brandSubtitle: string
    desktopClientLabel: string
    navigation: {
      home: string
      updates: string
    }
    bridgeStatus: {
      unavailable: string
      loadingConfiguration: string
      editingConfiguration: string
      tokenRequired: string
      loadingReviewState: string
      connectedWithPending: (count: number) => string
      error: (message: string) => string
    }
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
      localRecords: {
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
    summary: string
    refreshQueue: string
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
      secretStore: string
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
    distribute: string
    distributing: string
    reviewReasonLabel: string
    reasonLabels: {
      missingLocalRecord: string
      versionMismatch: string
    }
  }
  agentsPanel: {
    eyebrow: string
    title: string
    description: string
    claudeCodeDetail: string
    codexDetail: string
    geminiCliDetail: string
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
  }
}

export type DictionaryLocale = AppLocale
