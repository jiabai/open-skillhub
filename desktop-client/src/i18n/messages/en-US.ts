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
      `Desktop bridge unavailable. Launch the Electron runtime with \`npm run start:electron\` to ${action}.`
  },
  appShell: {
    brandTitle: "Open SkillHub",
    brandSubtitle: "Desktop review client",
    desktopClientLabel: "Open SkillHub Desktop",
    navigation: {
      home: "Home",
      updates: "Updates"
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
      missingLocalRecord: "Missing local record",
      versionMismatch: "Version mismatch"
    }
  },
  updatesView: {
    eyebrow: "Review queue",
    title: "All pending updates",
    summary: "Inspect every pending skill update before distributing it to configured local agent targets.",
    refreshQueue: "Refresh queue"
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
      missingLocalRecord: "Missing local record",
      versionMismatch: "Version mismatch"
    }
  },
  preDistributionCheck: {
    loading: "Checking configured agent targets...",
    refreshNeeded: "Refresh check to read installed target versions before distribution.",
    stale: "Check results are stale. Refresh before relying on target version claims.",
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
      "installed-older": (installed: string, remote: string) =>
        `Installed ${installed} is older than remote ${remote}; distribution upgrades it.`,
      same: (version: string) => `Same version ${version}; distribution is an overwrite.`,
      "installed-newer": (installed: string, remote: string) =>
        `Installed ${installed} is newer than remote ${remote}; distribution may downgrade it.`,
      unknown: (installed: string, remote: string) =>
        `Version ordering cannot be determined: installed ${installed}, remote ${remote}.`,
      error: (message: string) => `Check failed: ${message}`
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
    noSkippedTargets: "No same-version targets.",
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
    noSnapshot: "Agent detection has not run yet.",
    summary: (installed: number, supported: number) =>
      `${installed} installed of ${supported} supported agents.`,
    statusLabels: {
      installed: "Installed",
      missing: "Not installed",
      environment: "Configured by environment",
      autoDetected: "Auto-detected"
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
      `${name} could not be marked as synced: ${message}`
  }
} satisfies AppDictionary
