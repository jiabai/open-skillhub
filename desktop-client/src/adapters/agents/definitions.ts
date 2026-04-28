import type { AgentId } from "@/types"

export type AgentTargetRole = "primary" | "owned-secondary"

export interface AgentTargetDefinition {
  path: string
  role: AgentTargetRole
  sharedPathKey?: string
}

export interface AgentPathDefinition {
  id: AgentId
  displayName: string
  detectionDirs: string[]
  defaultTargets: AgentTargetDefinition[]
  compatibleReadPaths?: string[]
  pathResolution: "all-owned" | "priority"
  envVar: string
}

export const supportedAgentDefinitions: AgentPathDefinition[] = [
  {
    id: "claude-code",
    displayName: "Claude Code",
    detectionDirs: ["~/.claude"],
    defaultTargets: [{ path: "~/.claude/skills", role: "primary" }],
    compatibleReadPaths: ["~/.claude/plugins/marketplaces/*/skills"],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_CLAUDE_CODE_SKILLS_PATH"
  },
  {
    id: "cursor",
    displayName: "Cursor",
    detectionDirs: ["~/.cursor"],
    defaultTargets: [{ path: "~/.cursor/skills", role: "primary" }],
    compatibleReadPaths: ["~/.claude/skills", "~/.codex/skills"],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_CURSOR_SKILLS_PATH"
  },
  {
    id: "windsurf",
    displayName: "Windsurf",
    detectionDirs: ["~/.codeium/windsurf"],
    defaultTargets: [{ path: "~/.codeium/windsurf/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_WINDSURF_SKILLS_PATH"
  },
  {
    id: "copilot",
    displayName: "GitHub Copilot",
    detectionDirs: ["~/.copilot"],
    defaultTargets: [{ path: "~/.copilot/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_COPILOT_SKILLS_PATH"
  },
  {
    id: "roocode",
    displayName: "RooCode",
    detectionDirs: ["~/.roo"],
    defaultTargets: [{ path: "~/.roo/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_ROOCODE_SKILLS_PATH"
  },
  {
    id: "cline",
    displayName: "Cline",
    detectionDirs: ["~/.agents"],
    defaultTargets: [
      { path: "~/.agents/skills", role: "primary", sharedPathKey: "agents-universal" }
    ],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_CLINE_SKILLS_PATH"
  },
  {
    id: "gemini-cli",
    displayName: "Gemini CLI",
    detectionDirs: ["~/.gemini"],
    defaultTargets: [{ path: "~/.gemini/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_GEMINI_CLI_SKILLS_PATH"
  },
  {
    id: "codex",
    displayName: "Codex",
    detectionDirs: ["~/.codex"],
    defaultTargets: [{ path: "~/.codex/skills", role: "primary" }],
    compatibleReadPaths: ["~/.agents/skills", "/etc/codex/skills"],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_CODEX_SKILLS_PATH"
  },
  {
    id: "opencode",
    displayName: "OpenCode",
    detectionDirs: ["~/.config/opencode"],
    defaultTargets: [{ path: "~/.config/opencode/skills", role: "primary" }],
    compatibleReadPaths: ["~/.claude/skills", "~/.agents/skills"],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_OPENCODE_SKILLS_PATH"
  },
  {
    id: "kilocode",
    displayName: "KiloCode",
    detectionDirs: ["~/.kilocode"],
    defaultTargets: [{ path: "~/.kilocode/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_KILOCODE_SKILLS_PATH"
  },
  {
    id: "amp",
    displayName: "Amp",
    detectionDirs: ["~/.config/agents"],
    defaultTargets: [
      { path: "~/.config/agents/skills", role: "primary", sharedPathKey: "config-agents" }
    ],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_AMP_SKILLS_PATH"
  },
  {
    id: "kiro",
    displayName: "Kiro",
    detectionDirs: ["~/.kiro"],
    defaultTargets: [{ path: "~/.kiro/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_KIRO_SKILLS_PATH"
  },
  {
    id: "warp",
    displayName: "Warp",
    detectionDirs: ["~/.agents"],
    defaultTargets: [
      { path: "~/.agents/skills", role: "primary", sharedPathKey: "agents-universal" }
    ],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_WARP_SKILLS_PATH"
  },
  {
    id: "trae",
    displayName: "Trae",
    detectionDirs: ["~/.trae"],
    defaultTargets: [{ path: "~/.trae/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_TRAE_SKILLS_PATH"
  },
  {
    id: "factory",
    displayName: "Factory",
    detectionDirs: ["~/.factory"],
    defaultTargets: [{ path: "~/.factory/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_FACTORY_SKILLS_PATH"
  },
  {
    id: "kimi",
    displayName: "Kimi Code CLI",
    detectionDirs: ["~/.config/agents"],
    defaultTargets: [
      { path: "~/.config/agents/skills", role: "primary", sharedPathKey: "config-agents" }
    ],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_KIMI_SKILLS_PATH"
  },
  {
    id: "mistral",
    displayName: "Mistral Le Chat",
    detectionDirs: ["~/.vibe"],
    defaultTargets: [{ path: "~/.vibe/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_MISTRAL_SKILLS_PATH"
  },
  {
    id: "pi",
    displayName: "Pi Coding Agent",
    detectionDirs: ["~/.pi/agent"],
    defaultTargets: [{ path: "~/.pi/agent/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_PI_SKILLS_PATH"
  },
  {
    id: "antigravity",
    displayName: "Antigravity",
    detectionDirs: ["~/.gemini/antigravity"],
    defaultTargets: [{ path: "~/.gemini/antigravity/skills", role: "primary" }],
    pathResolution: "all-owned",
    envVar: "OPEN_SKILLHUB_ANTIGRAVITY_SKILLS_PATH"
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
    pathResolution: "priority",
    envVar: "OPEN_SKILLHUB_OPENCLAW_SKILLS_PATH"
  }
]

export const unsupportedAgentIds = ["zed", "augmentcode", "jetbrains-ai"] as const
