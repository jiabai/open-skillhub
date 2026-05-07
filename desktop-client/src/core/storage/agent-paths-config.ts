import { access, chmod } from "node:fs/promises"
import { posix, win32 } from "node:path"

import {
  supportedAgentDefinitions,
  type AgentPathDefinition
} from "@/adapters/agents/definitions"
import type { AgentId, AgentPathsConfig } from "@/types"
import { createJsonConfigStore, type JsonRecord } from "@/core/storage/config-store"

export interface AgentPathsConfigOptions {
  definitions?: Pick<AgentPathDefinition, "id">[]
  homeDir?: () => string
  platform?: NodeJS.Platform
}

export interface AgentPathsConfigStore {
  read(): Promise<AgentPathsConfig>
  write(value: AgentPathsConfig): Promise<void>
  update(patch: AgentPathsConfig): Promise<AgentPathsConfig>
  clear(): Promise<void>
  ensureFile(): Promise<AgentPathsConfig>
}

type PathValidationResult = {
  targetPath: string
  resolvedPath: string
}

function getPathModule(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function createKnownAgentIds(definitions: Pick<AgentPathDefinition, "id">[]): Set<string> {
  return new Set(definitions.map((definition) => definition.id))
}

function containsTraversalSegment(pathValue: string, platform: NodeJS.Platform): boolean {
  const pathModule = getPathModule(platform)
  const hasTraversal = (value: string) =>
    value
      .replace(/\\/g, "/")
      .split("/")
      .some((segment) => segment === "..")

  return hasTraversal(pathValue) || hasTraversal(pathModule.normalize(pathValue))
}

export function resolveAgentPath(
  pathValue: string,
  options: Pick<Required<AgentPathsConfigOptions>, "homeDir" | "platform">
): string {
  const pathModule = getPathModule(options.platform)

  if (pathValue === "~") {
    return pathModule.normalize(options.homeDir())
  }

  if (pathValue.startsWith("~/")) {
    return pathModule.normalize(pathModule.join(options.homeDir(), pathValue.slice(2)))
  }

  return pathModule.normalize(pathValue)
}

function validateTargetPath(
  targetPath: unknown,
  options: Pick<Required<AgentPathsConfigOptions>, "homeDir" | "platform">
): PathValidationResult | null {
  if (typeof targetPath !== "string") {
    return null
  }

  const trimmed = targetPath.trim()

  if (!trimmed || containsTraversalSegment(trimmed, options.platform)) {
    return null
  }

  const resolvedPath = resolveAgentPath(trimmed, options)
  const pathModule = getPathModule(options.platform)

  if (!pathModule.isAbsolute(resolvedPath) || containsTraversalSegment(resolvedPath, options.platform)) {
    return null
  }

  return {
    targetPath: trimmed,
    resolvedPath
  }
}

function normalizeOptions(options: AgentPathsConfigOptions = {}): Required<AgentPathsConfigOptions> {
  return {
    definitions: options.definitions ?? supportedAgentDefinitions,
    homeDir: options.homeDir ?? (() => process.env.HOME ?? process.env.USERPROFILE ?? ""),
    platform: options.platform ?? process.platform
  }
}

export function sanitizeAgentPathsConfig(
  value: unknown,
  options: AgentPathsConfigOptions = {}
): AgentPathsConfig {
  if (!isRecord(value)) {
    return {}
  }

  const normalizedOptions = normalizeOptions(options)
  const knownAgentIds = createKnownAgentIds(normalizedOptions.definitions)
  const sanitized: AgentPathsConfig = {}

  for (const [agentId, entry] of Object.entries(value)) {
    if (!knownAgentIds.has(agentId) || !isRecord(entry)) {
      continue
    }

    const validation = validateTargetPath(entry.targetPath, normalizedOptions)

    if (!validation) {
      continue
    }

    sanitized[agentId as AgentId] = {
      targetPath: validation.targetPath
    }
  }

  return sanitized
}

export function resolveAgentPathConfigTarget(args: {
  agentId: AgentId
  config: unknown
  options?: AgentPathsConfigOptions
}): string | null {
  if (!isRecord(args.config)) {
    return null
  }

  const entry = args.config[args.agentId]

  if (!isRecord(entry)) {
    return null
  }

  const normalizedOptions = normalizeOptions(args.options)
  const validation = validateTargetPath(entry.targetPath, normalizedOptions)

  return validation?.resolvedPath ?? null
}

const INITIAL_AGENT_PATHS_TEMPLATE: JsonRecord = {
  _comment:
    "Each key is an agent ID. Set targetPath to override the default skill directory. " +
    "Remove an entry to use the built-in default. " +
    "Valid agent IDs: claude-code, cursor, windsurf, copilot, roocode, cline, " +
    "gemini-cli, codex, opencode, kilocode, amp, kiro, warp, trae, factory, " +
    "kimi, mistral, pi, antigravity, openclaw",
  "claude-code": { targetPath: "~/.claude/skills" },
  cursor: { targetPath: "~/.cursor/skills" },
  "gemini-cli": { targetPath: "~/.gemini/skills" }
}

async function chmodUserOnly(filePath: string, platform: NodeJS.Platform): Promise<void> {
  if (platform === "win32") {
    return
  }

  await chmod(filePath, 0o600)
}

export function createAgentPathsConfigStore(
  filePath: string,
  options: AgentPathsConfigOptions = {}
): AgentPathsConfigStore {
  const rawStore = createJsonConfigStore<JsonRecord>(filePath, {})
  const normalizedOptions = normalizeOptions(options)

  async function writeSanitized(value: unknown): Promise<AgentPathsConfig> {
    const sanitized = sanitizeAgentPathsConfig(value, normalizedOptions)
    await rawStore.write(sanitized as JsonRecord)
    await chmodUserOnly(filePath, normalizedOptions.platform)
    return sanitized
  }

  return {
    async read(): Promise<AgentPathsConfig> {
      return sanitizeAgentPathsConfig(await rawStore.read(), normalizedOptions)
    },
    async write(value: AgentPathsConfig): Promise<void> {
      await writeSanitized(value)
    },
    async update(patch: AgentPathsConfig): Promise<AgentPathsConfig> {
      return writeSanitized({
        ...(await this.read()),
        ...patch
      })
    },
    async clear(): Promise<void> {
      await writeSanitized({})
    },
    async ensureFile(): Promise<AgentPathsConfig> {
      try {
        await access(filePath)
        return this.read()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error
        }
      }

      await rawStore.write(INITIAL_AGENT_PATHS_TEMPLATE)
      await chmodUserOnly(filePath, normalizedOptions.platform)
      return sanitizeAgentPathsConfig(INITIAL_AGENT_PATHS_TEMPLATE, normalizedOptions)
    }
  }
}
