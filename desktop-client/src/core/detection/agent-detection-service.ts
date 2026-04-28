import { createHash } from "node:crypto"
import { stat } from "node:fs/promises"
import { posix, win32 } from "node:path"

import {
  supportedAgentDefinitions,
  type AgentPathDefinition,
  type AgentTargetDefinition
} from "@/adapters/agents/definitions"
import type {
  AgentDetectionSnapshot,
  AgentId,
  AgentInstallSource,
  AgentInstallStatus,
  AgentSkillTarget
} from "@/types"

export interface AgentDetectionServiceDependencies {
  definitions?: AgentPathDefinition[]
  env?: NodeJS.ProcessEnv
  homeDir?: () => string
  now?: () => Date
  pathExists?: (path: string) => Promise<boolean>
  platform?: NodeJS.Platform
}

export interface AgentDetectionService {
  refresh(): Promise<AgentDetectionSnapshot>
}

type ResolvedTarget = {
  path: string
  sharedPathKey: string | null
}

function getPathModule(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix
}

function normalizeConfiguredPath(value: string | undefined): string | null {
  const trimmed = value?.trim()

  return trimmed ? trimmed : null
}

async function defaultPathExists(pathValue: string): Promise<boolean> {
  try {
    return (await stat(pathValue)).isDirectory()
  } catch {
    return false
  }
}

function createTargetId(dedupeKey: string): string {
  return createHash("sha256").update(dedupeKey).digest("hex").slice(0, 16)
}

function createDedupeKey(pathValue: string, platform: NodeJS.Platform): string {
  const normalized = getPathModule(platform).normalize(pathValue)

  return platform === "win32" ? normalized.toLowerCase() : normalized
}

export function createAgentDetectionService(
  dependencies: AgentDetectionServiceDependencies = {}
): AgentDetectionService {
  const definitions = dependencies.definitions ?? supportedAgentDefinitions
  const env = dependencies.env ?? process.env
  const homeDir = dependencies.homeDir ?? (() => process.env.HOME ?? process.env.USERPROFILE ?? "")
  const now = dependencies.now ?? (() => new Date())
  const pathExists = dependencies.pathExists ?? defaultPathExists
  const platform = dependencies.platform ?? process.platform
  const pathModule = getPathModule(platform)

  function resolvePath(pathValue: string): string {
    if (pathValue === "~") {
      return pathModule.normalize(homeDir())
    }

    if (pathValue.startsWith("~/")) {
      return pathModule.normalize(pathModule.join(homeDir(), pathValue.slice(2)))
    }

    return pathModule.normalize(pathValue)
  }

  function resolveTarget(target: AgentTargetDefinition): ResolvedTarget {
    return {
      path: resolvePath(target.path),
      sharedPathKey: target.sharedPathKey ?? null
    }
  }

  async function resolveAutoTargets(definition: AgentPathDefinition): Promise<ResolvedTarget[]> {
    if (definition.pathResolution === "priority") {
      for (const target of definition.defaultTargets) {
        const resolved = resolveTarget(target)

        if (await pathExists(resolved.path)) {
          return [resolved]
        }
      }

      return []
    }

    return definition.defaultTargets.map(resolveTarget)
  }

  async function resolveStatus(definition: AgentPathDefinition): Promise<{
    status: AgentInstallStatus
    targets: ResolvedTarget[]
  }> {
    const detectionDirs = definition.detectionDirs.map(resolvePath)
    const compatibleReadPaths = (definition.compatibleReadPaths ?? []).map(resolvePath)
    const configuredPath = normalizeConfiguredPath(env[definition.envVar])

    if (configuredPath) {
      const targetPath = pathModule.normalize(configuredPath)

      return {
        status: {
          agentId: definition.id,
          displayName: definition.displayName,
          installed: true,
          source: "environment",
          detectionDirs,
          targetPaths: [targetPath],
          compatibleReadPaths,
          reason: null
        },
        targets: [
          {
            path: targetPath,
            sharedPathKey: null
          }
        ]
      }
    }

    const installed = await Promise.all(detectionDirs.map((pathValue) => pathExists(pathValue))).then(
      (results) => results.some(Boolean)
    )

    if (!installed) {
      return {
        status: {
          agentId: definition.id,
          displayName: definition.displayName,
          installed: false,
          source: "missing",
          detectionDirs,
          targetPaths: [],
          compatibleReadPaths,
          reason: "No detection directory found."
        },
        targets: []
      }
    }

    const targets = await resolveAutoTargets(definition)

    return {
      status: {
        agentId: definition.id,
        displayName: definition.displayName,
        installed: targets.length > 0,
        source: targets.length > 0 ? "auto-detected" : "missing",
        detectionDirs,
        targetPaths: targets.map((target) => target.path),
        compatibleReadPaths,
        reason: targets.length > 0 ? null : "No writable target candidate found."
      },
      targets
    }
  }

  function addUniqueTarget(args: {
    uniqueTargetsByKey: Map<string, AgentSkillTarget>
    target: ResolvedTarget
    agentId: AgentId
    source: AgentInstallSource
  }): void {
    const dedupeKey = createDedupeKey(args.target.path, platform)
    const existing = args.uniqueTargetsByKey.get(dedupeKey)

    if (existing) {
      if (!existing.coveredAgentIds.includes(args.agentId)) {
        existing.coveredAgentIds.push(args.agentId)
      }

      if (existing.sharedPathKey === null && args.target.sharedPathKey !== null) {
        existing.sharedPathKey = args.target.sharedPathKey
      }

      return
    }

    args.uniqueTargetsByKey.set(dedupeKey, {
      targetId: createTargetId(dedupeKey),
      targetPath: args.target.path,
      primaryAgentId: args.agentId,
      coveredAgentIds: [args.agentId],
      sharedPathKey: args.target.sharedPathKey,
      source: args.source
    })
  }

  return {
    async refresh(): Promise<AgentDetectionSnapshot> {
      const statuses: AgentInstallStatus[] = []
      const uniqueTargetsByKey = new Map<string, AgentSkillTarget>()

      for (const definition of definitions) {
        const { status, targets } = await resolveStatus(definition)
        statuses.push(status)

        if (!status.installed) {
          continue
        }

        for (const target of targets) {
          addUniqueTarget({
            uniqueTargetsByKey,
            target,
            agentId: definition.id,
            source: status.source
          })
        }
      }

      return {
        checkedAt: now().toISOString(),
        supportedAgentCount: definitions.length,
        installedAgentIds: statuses
          .filter((status) => status.installed)
          .map((status) => status.agentId),
        agentStatuses: statuses,
        uniqueTargets: Array.from(uniqueTargetsByKey.values())
      }
    }
  }
}
