import type { AgentId } from "@/types"

export type AgentTargetRole = "primary" | "owned-secondary"

export interface AgentTargetDefinition {
  path: string
  role: AgentTargetRole
  sharedPathKey?: string
}

export type AgentProjectTargetRole = "primary" | "compatible-read"

export interface AgentProjectTargetDefinition {
  path: string
  role: AgentProjectTargetRole
  sharedPathKey?: string
}

export interface AgentPathDefinition {
  id: AgentId
  displayName: string
  detectionDirs: string[]
  defaultTargets: AgentTargetDefinition[]
  compatibleReadPaths?: string[]
  projectTargets?: AgentProjectTargetDefinition[]
  pathResolution: "all-owned" | "priority"
}

export const supportedAgentDefinitions: AgentPathDefinition[] = [
  {
    id: "claude-code",
    displayName: "Claude Code",
    detectionDirs: ["~/.claude"],
    defaultTargets: [{ path: "~/.claude/skills", role: "primary" }],
    compatibleReadPaths: ["~/.claude/plugins/marketplaces/*/skills"],
    projectTargets: [{ path: ".claude/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "cursor",
    displayName: "Cursor",
    detectionDirs: ["~/.cursor"],
    defaultTargets: [{ path: "~/.cursor/skills", role: "primary" }],
    compatibleReadPaths: ["~/.claude/skills", "~/.codex/skills"],
    projectTargets: [
      { path: ".cursor/skills", role: "primary" },
      { path: ".claude/skills", role: "compatible-read" },
      { path: ".codex/skills", role: "compatible-read" }
    ],
    pathResolution: "all-owned"
  },
  {
    id: "windsurf",
    displayName: "Windsurf",
    detectionDirs: ["~/.codeium/windsurf"],
    defaultTargets: [{ path: "~/.codeium/windsurf/skills", role: "primary" }],
    projectTargets: [{ path: ".windsurf/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "copilot",
    displayName: "GitHub Copilot",
    detectionDirs: ["~/.copilot"],
    defaultTargets: [{ path: "~/.copilot/skills", role: "primary" }],
    projectTargets: [{ path: ".copilot/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "roocode",
    displayName: "RooCode",
    detectionDirs: ["~/.roo"],
    defaultTargets: [{ path: "~/.roo/skills", role: "primary" }],
    projectTargets: [{ path: ".roo/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "cline",
    displayName: "Cline",
    detectionDirs: ["~/.agents"],
    defaultTargets: [
      { path: "~/.agents/skills", role: "primary", sharedPathKey: "agents-universal" }
    ],
    projectTargets: [
      { path: ".agents/skills", role: "primary", sharedPathKey: "agents-universal" }
    ],
    pathResolution: "all-owned"
  },
  {
    id: "gemini-cli",
    displayName: "Gemini CLI",
    detectionDirs: ["~/.gemini"],
    defaultTargets: [{ path: "~/.gemini/skills", role: "primary" }],
    projectTargets: [{ path: ".gemini/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "codex",
    displayName: "Codex",
    detectionDirs: ["~/.codex"],
    defaultTargets: [
      { path: "~/.agents/skills", role: "primary", sharedPathKey: "agents-universal" }
    ],
    compatibleReadPaths: ["~/.codex/skills", "/etc/codex/skills"],
    projectTargets: [
      { path: ".agents/skills", role: "primary", sharedPathKey: "agents-universal" }
    ],
    pathResolution: "all-owned"
  },
  {
    id: "opencode",
    displayName: "OpenCode",
    detectionDirs: ["~/.config/opencode"],
    defaultTargets: [{ path: "~/.config/opencode/skills", role: "primary" }],
    compatibleReadPaths: ["~/.claude/skills", "~/.agents/skills"],
    projectTargets: [
      { path: ".opencode/skills", role: "primary" },
      { path: ".claude/skills", role: "compatible-read" },
      { path: ".agents/skills", role: "compatible-read", sharedPathKey: "agents-universal" }
    ],
    pathResolution: "all-owned"
  },
  {
    id: "kilocode",
    displayName: "KiloCode",
    detectionDirs: ["~/.kilocode"],
    defaultTargets: [{ path: "~/.kilocode/skills", role: "primary" }],
    projectTargets: [{ path: ".kilocode/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "amp",
    displayName: "Amp",
    detectionDirs: ["~/.config/agents"],
    defaultTargets: [
      { path: "~/.config/agents/skills", role: "primary", sharedPathKey: "config-agents" }
    ],
    projectTargets: [
      { path: ".config/agents/skills", role: "primary", sharedPathKey: "config-agents" }
    ],
    pathResolution: "all-owned"
  },
  {
    id: "kiro",
    displayName: "Kiro",
    detectionDirs: ["~/.kiro"],
    defaultTargets: [{ path: "~/.kiro/skills", role: "primary" }],
    projectTargets: [{ path: ".kiro/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "warp",
    displayName: "Warp",
    detectionDirs: ["~/.agents"],
    defaultTargets: [
      { path: "~/.agents/skills", role: "primary", sharedPathKey: "agents-universal" }
    ],
    projectTargets: [
      { path: ".agents/skills", role: "primary", sharedPathKey: "agents-universal" }
    ],
    pathResolution: "all-owned"
  },
  {
    id: "trae",
    displayName: "Trae",
    detectionDirs: ["~/.trae"],
    defaultTargets: [{ path: "~/.trae/skills", role: "primary" }],
    projectTargets: [{ path: ".trae/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "factory",
    displayName: "Factory",
    detectionDirs: ["~/.factory"],
    defaultTargets: [{ path: "~/.factory/skills", role: "primary" }],
    projectTargets: [{ path: ".factory/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "kimi",
    displayName: "Kimi Code CLI",
    detectionDirs: ["~/.config/agents"],
    defaultTargets: [
      { path: "~/.config/agents/skills", role: "primary", sharedPathKey: "config-agents" }
    ],
    projectTargets: [
      { path: ".config/agents/skills", role: "primary", sharedPathKey: "config-agents" }
    ],
    pathResolution: "all-owned"
  },
  {
    id: "mistral",
    displayName: "Mistral Le Chat",
    detectionDirs: ["~/.vibe"],
    defaultTargets: [{ path: "~/.vibe/skills", role: "primary" }],
    projectTargets: [{ path: ".vibe/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "pi",
    displayName: "Pi Coding Agent",
    detectionDirs: ["~/.pi/agent"],
    defaultTargets: [{ path: "~/.pi/agent/skills", role: "primary" }],
    projectTargets: [{ path: ".pi/agent/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "antigravity",
    displayName: "Antigravity",
    detectionDirs: ["~/.gemini/antigravity"],
    defaultTargets: [{ path: "~/.gemini/antigravity/skills", role: "primary" }],
    projectTargets: [{ path: ".gemini/antigravity/skills", role: "primary" }],
    pathResolution: "all-owned"
  },
  {
    id: "openclaw",
    displayName: "OpenClaw",
    detectionDirs: ["~/.openclaw/skills", "~/.clawdbot/skills", "~/.moltbot/skills"],
    defaultTargets: [
      { path: "~/.openclaw/skills", role: "primary" },
      { path: "~/.clawdbot/skills", role: "primary" },
      { path: "~/.moltbot/skills", role: "primary" }
    ],
    pathResolution: "priority"
  }
]

export const unsupportedAgentIds = ["zed", "augmentcode", "jetbrains-ai"] as const
