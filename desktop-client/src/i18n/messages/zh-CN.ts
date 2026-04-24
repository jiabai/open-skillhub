import type { AppDictionary } from "@/i18n/messages/types"

export const zhCNDictionary = {
  common: {
    loading: "加载中...",
    refresh: "刷新",
    refreshing: "刷新中",
    settings: "设置",
    close: "关闭",
    edit: "编辑",
    clear: "清除",
    configureApi: "配置 API",
    saveConfiguration: "保存配置",
    savingConfiguration: "保存中...",
    testConnection: "测试连接",
    testingConnection: "测试中...",
    distribute: "分发",
    distributing: "分发中",
    pending: (count: number) => `${count} 个待审核更新`,
    local: (value: string) => `本地 ${value}`,
    remote: (value: string) => `远程 ${value}`,
    nA: "n/a",
    notRefreshedYet: "尚未刷新",
    bridgeUnavailable: (action: string) =>
      `桌面桥接不可用。请启动 Electron 运行时（\`npm run start:electron\`）以便${action}。`
  },
  appShell: {
    brandTitle: "Open SkillHub",
    brandSubtitle: "桌面审核客户端",
    desktopClientLabel: "Open SkillHub 桌面端",
    navigation: {
      home: "首页",
      updates: "更新"
    },
    bridgeStatus: {
      unavailable: "桌面桥接不可用",
      loadingConfiguration: "桌面桥接已连接，正在加载配置",
      editingConfiguration: "桌面桥接已连接，正在编辑 API 配置",
      tokenRequired: "桌面桥接已连接，需要 API Token",
      loadingReviewState: "桌面桥接已连接，正在加载审核状态",
      connectedWithPending: (count: number) => `桌面桥接已连接，${count} 个待审核更新`,
      error: (message: string) => `桌面桥接错误：${message}`
    }
  },
  homeView: {
    eyebrow: "桌面客户端",
    title: "审核更新",
    summary: "一个安静的桌面工作台，用来查看待审核的技能更新，并在准备好时再执行分发。",
    refreshState: "刷新状态",
    settings: "设置",
    bridgeUnavailableTitle: "桌面桥接不可用",
    bridgeUnavailableDetail: "当前环境下 renderer 无法连接到 preload 桥接。",
    tokenNeededTitle: "需要 API Token",
    tokenNeededDetail: "在保存 API 配置之前，审核同步会暂停。",
    refreshFailedTitle: "刷新失败",
    metrics: {
      pendingUpdates: {
        label: "待审核更新",
        detail: "等待审核的条目。"
      },
      localRecords: {
        label: "本地记录",
        detail: "已分发技能的本地追踪记录。"
      },
      lastRefresh: {
        label: "最近刷新",
        detail: "最新的桥接快照。"
      }
    },
    needsReviewTitle: "需要审核",
    needsReviewDescription: "这里最多展示 3 个待审核更新。完整队列在 Updates 中。",
    loadingPendingUpdates: "正在加载待审核更新...",
    noPendingUpdates: "没有待审核更新。",
    viewAllUpdates: "查看全部更新",
    distribute: (name: string) => `分发 ${name}`,
    distributing: "分发中",
    badges: {
      local: (value: string) => `本地 ${value}`,
      remote: (value: string) => `远程 ${value}`
    },
    reasonLabels: {
      missingLocalRecord: "缺少本地记录",
      versionMismatch: "版本不一致"
    }
  },
  updatesView: {
    eyebrow: "审核队列",
    title: "全部待审核更新",
    summary: "在把技能分发到已配置的本地代理目标之前，先检查每个待审核更新。",
    refreshQueue: "刷新队列"
  },
  settingsPanel: {
    title: "设置",
    heading: "审核控制",
    reviewPolicyLabel: "审核策略",
    reviewPolicyValue: "待审核更新会一直保留，直到人工审核。",
    bridgeAccessLabel: "桥接访问",
    bridgeAccessValue: "仅通过 IPC 封装访问，renderer 不能直接访问 Node。",
    storageSnapshotLabel: "存储快照",
    storageSnapshotValue: "本地状态会在分发前后刷新。"
  },
  language: {
    title: "语言",
    description: "选择桌面客户端使用的语言。",
    currentPrefix: "当前：",
    zhCNLabel: "简体中文",
    enUSLabel: "English",
    switchToChinese: "切换到中文",
    switchToEnglish: "切换到英文"
  },
  settingsDrawer: {
    title: "桌面设置",
    description: "连接、分发目标、最近活动记录和语言偏好。",
    bridgeStatusTitle: "桥接状态",
    tokenConfigured: "Token 已配置",
    tokenMissing: "Token 缺失",
    lastRefreshLabel: "最近刷新"
  },
  configStatus: {
    title: "API 配置",
    configured: "已配置",
    missing: "缺失",
    apiBaseUrl: "API Base URL",
    tokenSource: "Token 来源",
    loading: "加载中...",
    warning: "警告",
    edit: "编辑",
    clearing: "清除中...",
    clearSavedConfig: "清除已保存配置",
    sourceLabels: {
      secretStore: "系统凭证存储",
      environment: "环境变量",
      missing: "缺失"
    }
  },
  configPanel: {
    section: "配置",
    title: "API Token",
    description: "配置服务器地址和桌面同步使用的 Token。",
    apiBaseUrlLabel: "API Base URL",
    apiTokenLabel: "API Token",
    apiTokenPlaceholder: "留空以保留当前 Token",
    tokenHelpConfigured: "当前已经有一个可用的 Token；只有在轮换凭证时才需要输入新的值。",
    tokenHelpMissing: "在审核同步开始之前，必须先提供一个 Token。",
    saveConfiguration: "保存配置",
    savingConfiguration: "保存中...",
    testConnection: "测试连接",
    testingConnection: "测试中...",
    saveAction: "保存配置",
    testAction: "测试连接"
  },
  pendingUpdatesPanel: {
    eyebrow: "审核队列",
    title: "待审核更新",
    description: (count: number) => `${count} 个条目等待批准。`,
    loading: "正在加载待审核更新...",
    noPendingUpdates: "没有待审核更新。",
    distribute: "分发",
    distributing: "分发中",
    reviewReasonLabel: "审核原因：",
    reasonLabels: {
      missingLocalRecord: "缺少本地记录",
      versionMismatch: "版本不一致"
    }
  },
  agentsPanel: {
    eyebrow: "代理",
    title: "分发目标",
    description: "已批准的本地代理目标，可用于分发已审核更新。",
    claudeCodeDetail: "面向代码型代理的适配层已经就绪。",
    codexDetail: "已分发的更新可以投递到这个支持工作区的代理。",
    geminiCliDetail: "这个代理会继续作为已批准的分发目标显示。"
  },
  activityPanel: {
    eyebrow: "活动",
    title: "最近操作",
    description: "来自当前桌面会话的最新本地事件。",
    empty: "目前还没有最近操作。"
  },
  activity: {
    consoleReadyTitle: "控制台已就绪",
    consoleReadyDetail: "待审核更新会一直可见，直到操作员执行分发。",
    apiTokenNeededTitle: "需要 API Token",
    apiTokenNeededDetail: "在保存配置之前，审核同步会暂停。",
    reviewSnapshotLoadedTitle: "审核快照已加载",
    reviewSnapshotLoadedDetail: (count: number) => `${count} 个待审核更新已准备好审核。`,
    refreshFailedTitle: "刷新失败",
    refreshFailedDetail: (message: string) => message,
    reviewSnapshotRefreshedTitle: "审核快照已刷新",
    reviewSnapshotRefreshedDetail: (count: number) => `${count} 个待审核更新再次可见。`,
    configurationSavedTitle: "配置已保存",
    configurationSavedDetail: "运行时同步正在使用最新的 API 设置。",
    connectionTestSucceededTitle: "连接测试成功",
    connectionTestFailedTitle: "连接测试失败",
    configurationClearedTitle: "配置已清除",
    configurationClearedDetail: "审核同步已暂停。",
    configurationSaveFailedTitle: "配置保存失败",
    configurationSaveFailedDetail: (message: string) => message,
    configurationClearFailedTitle: "配置清除失败",
    configurationClearFailedDetail: (message: string) => message,
    distributionCompletedTitle: "分发完成",
    distributionCompletedWithWarningsTitle: "分发完成但有警告",
    distributionCompletedDetail: (detail: string) => detail,
    distributionCompletedWithRefreshWarningTitle: "分发完成但刷新出现警告",
    distributionCompletedWithRefreshWarningDetail: (detail: string, message: string) =>
      `${detail} 刷新审核快照时失败：${message}`,
    distributionFailedTitle: "分发失败",
    distributionFailedDetail: (name: string, message: string) => `${name} 无法分发：${message}`
  }
} satisfies AppDictionary
