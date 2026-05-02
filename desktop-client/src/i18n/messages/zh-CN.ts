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
    syncRecord: "同步记录",
    syncingRecord: "同步中...",
    pending: (count: number) => `${count} 个待审核更新`,
    local: (value: string) => `本地 ${value}`,
    remote: (value: string) => `远程 ${value}`,
    nA: "n/a",
    notRefreshedYet: "尚未刷新",
    bridgeUnavailable: (action: string) =>
      `桌面桥接不可用。请启动 Electron 运行时（\`npm run start:electron\`）以便${action}。`
  },
  appShell: {
    brandTitle: "SkillDrive",
    brandSubtitle: "桌面审核客户端",
    desktopClientLabel: "SkillDrive 桌面端",
    navigation: {
      home: "首页",
      localSkills: "本地 SKILL",
      updates: "更新"
    },
    bridgeStatus: {
      unavailable: "桌面桥接不可用",
      loadingConfiguration: "桌面桥接已连接，正在加载配置",
      editingConfiguration: "桌面桥接已连接，正在编辑 API 配置",
      tokenRequired: "桌面桥接已连接，需要 API Token",
      loadingReviewState: "桌面桥接已连接，正在加载审核状态",
      connected: "桌面桥接已连接",
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
      successfulDistributions: {
        label: "成功分发次数",
        detail: "历史上成功完成的分发操作。"
      },
      installedAgents: {
        label: "已安装助手",
        detail: "检测到的本地 SKILL 助手。"
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
    syncLocalRecord: (name: string) => `同步 ${name} 的本地记录`,
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
  localSkillsView: {
    eyebrow: "本地库存",
    title: "本地 SKILL",
    inventoryTitle: "库存",
    summary: "查看本地 SKILL 包根目录，并且只在确认后上传服务端缺失的 SKILL。",
    refresh: "刷新本地 SKILL",
    refreshing: "刷新中...",
    loading: "正在加载本地 SKILL...",
    noSnapshot: "尚未刷新本地 SKILL 库存。",
    empty: "没有发现本地 SKILL 包根目录。",
    upload: (name: string) => `上传 ${name}`,
    uploading: "上传中...",
    sourceAgents: (value: string) => `来源 ${value}`,
    localVersion: (value: string) => `本地 ${value}`,
    localPath: (value: string) => `路径 ${value}`,
    remoteVersion: (value: string) => `远程 ${value}`,
    remoteId: (value: string) => `远程 ID ${value}`,
    validationReason: (value: string) => `校验 ${value}`,
    serverLookupWarning: (value: string) => `服务端查询不可用：${value}`,
    serverStateLabels: {
      existing: "服务端已存在",
      missing: "服务端缺失",
      unknown: "服务端未知",
      invalidLocal: "本地 SKILL 无效"
    }
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
      "secret-store": "系统凭证存储",
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
    refreshCheck: "刷新检查",
    refreshingCheck: "检查中...",
    distribute: "分发",
    distributing: "分发中",
    syncLocalRecord: "同步记录",
    syncingRecord: "同步中...",
    reviewReasonLabel: "审核原因：",
    reasonLabels: {
      missingLocalRecord: "缺少本地记录",
      versionMismatch: "版本不一致"
    }
  },
  preDistributionCheck: {
    loading: "正在检查已配置代理目标...",
    refreshNeeded: "刷新检查以读取分发前的目标已安装版本。",
    stale: "检查结果已过期。请先刷新，再依赖目标版本判断。",
    noTargets: "没有可用于此检查的已配置代理目标。",
    globalErrorsTitle: "分发前检查警告",
    targetCheckTitle: "目标检查",
    lastChecked: (value: string) => `最近检查：${value}`,
    warningBeforeDistribute: "分发前请先查看目标警告。",
    targetDirectory: (value: string) => `目录 ${value}`,
    installedVersion: (value: string) => `已安装 ${value}`,
    versionSourceLabels: {
      "skill-frontmatter": "SKILL.md",
      "manifest-json": "manifest.json",
      "nested-manifest-json": "skills/manifest.json",
      unknown: "版本来源未知"
    },
    comparisonLabels: {
      "not-installed": "此目标尚未安装。",
      "installed-older": (installed: string, remote: string) =>
        `已安装 ${installed} 低于远程 ${remote}；分发会升级它。`,
      same: (version: string) => `同为 ${version}；分发会执行幂等覆盖。`,
      "installed-newer": (installed: string, remote: string) =>
        `已安装 ${installed} 高于远程 ${remote}；分发可能造成降级。`,
      unknown: (installed: string, remote: string) =>
        `无法判断版本顺序：已安装 ${installed}，远程 ${remote}。`,
      error: (message: string) => `检查失败：${message}`
    }
  },
  distributionConfirmation: {
    title: "确认分发",
    description: (name: string) => `分发 ${name} 前，请先确认检测到的目标。`,
    destructiveWarning:
      "分发可能覆盖目标技能目录中的文件。请在确认本地变更后继续。",
    writeTargetsTitle: "将写入",
    skippedTargetsTitle: "已是最新",
    missingAgentsTitle: "未安装并跳过的助手",
    noWriteTargets: "没有检测到写入目标。",
    noSkippedTargets: "没有同版本目标。",
    noMissingAgents: "没有缺失的受支持助手。",
    confirm: "确认分发",
    cancel: "取消"
  },
  agentsPanel: {
    eyebrow: "代理",
    title: "分发目标",
    description: "本地助手检测结果决定哪些目标能接收已审核更新。",
    rediscover: "重新检测",
    rediscovering: "检测中...",
    noSnapshot: "尚未执行助手检测。",
    summary: (installed: number, supported: number) =>
      `已安装 ${installed} 个，共支持 ${supported} 个助手。`,
    statusLabels: {
      installed: "已安装",
      missing: "未安装",
      environment: "环境变量配置",
      autoDetected: "自动检测"
    },
    targetPath: (value: string) => `目标 ${value}`,
    detectionDirs: (value: string) => `检测 ${value}`
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
    distributionFailedDetail: (name: string, message: string) => `${name} 无法分发：${message}`,
    localRecordSyncedTitle: "本地记录已同步",
    localRecordSyncedDetail: (name: string) =>
      `${name} 已安装在所有检测到的目标上，因此已更新本地审核记录。`,
    localRecordSyncFailedTitle: "本地记录同步失败",
    localRecordSyncFailedDetail: (name: string, message: string) =>
      `${name} 无法标记为已同步：${message}`,
    localSkillUploadedTitle: "本地 SKILL 已上传",
    localSkillUploadedDetail: (name: string) => `${name} 已上传到服务端。`,
    localSkillUploadFailedTitle: "本地 SKILL 上传失败",
    localSkillUploadFailedDetail: (name: string, message: string) =>
      `${name} 无法上传：${message}`
  }
} satisfies AppDictionary
