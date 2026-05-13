import { posix, win32 } from "node:path"

import type { AgentPathDefinition } from "@/adapters/agents/definitions"
import { createAgentDetectionService } from "@/core/detection/agent-detection-service"
import { resolveProjectAgentTargets } from "@/core/projects/project-agent-targets"
import type { AgentId, AgentPathsConfig, SkillDistributionTarget } from "@/types"
import { CliError } from "@/cli/services/cli-errors"

export type CliDistributionScope =
  | { type: "global" }
  | { type: "project"; projectPath: string }

export interface CliDistributionTarget extends SkillDistributionTarget {
  targetKey: string
}

export interface ResolveCliDistributionTargetsRequest {
  scope: CliDistributionScope
  agentFilter?: AgentId[]
  agentPathsConfig?: AgentPathsConfig
  definitions?: AgentPathDefinition[]
  homeDir?: () => string
  now?: () => Date
  pathExists?: (path: string) => Promise<boolean>
  platform?: NodeJS.Platform
}

export interface ResolveCliDistributionTargetsResult {
  scope: CliDistributionScope
  targets: CliDistributionTarget[]
}

function getPathModule(platform: NodeJS.Platform) {
  return platform === "win32" ? win32 : posix
}

function createTargetKey(pathValue: string, primaryAgentId: AgentId, platform: NodeJS.Platform): string {
  const pathModule = getPathModule(platform)
  const normalized = pathModule.normalize(pathValue)
  const pathKey = platform === "win32" ? normalized.toLowerCase() : normalized

  return `${pathKey}::${primaryAgentId}`
}

function normalizeProjectPath(projectPath: string, platform: NodeJS.Platform): string {
  const pathModule = getPathModule(platform)
  const normalized = pathModule.normalize(projectPath.trim())

  if (!normalized || !pathModule.isAbsolute(normalized)) {
    throw new CliError("validation", `Project path must be absolute: ${projectPath}`)
  }

  return normalized
}

function applyAgentFilter(target: CliDistributionTarget, agentFilter?: AgentId[]): CliDistributionTarget | null {
  if (!agentFilter || agentFilter.length === 0) {
    return target
  }

  const allowed = new Set(agentFilter)
  const coveredAgentIds = target.coveredAgentIds.filter((agentId) => allowed.has(agentId))

  if (coveredAgentIds.length === 0) {
    return null
  }

  return {
    ...target,
    coveredAgentIds
  }
}

function assertHasTargets(targets: CliDistributionTarget[]): void {
  if (targets.length === 0) {
    throw new CliError("no-targets", "No writable SkillDrive targets matched the request")
  }
}

export async function resolveCliDistributionTargets(
  request: ResolveCliDistributionTargetsRequest
): Promise<ResolveCliDistributionTargetsResult> {
  const platform = request.platform ?? process.platform

  if (request.scope.type === "global") {
    const snapshot = await createAgentDetectionService({
      agentPathsConfig: request.agentPathsConfig,
      definitions: request.definitions,
      homeDir: request.homeDir,
      now: request.now,
      pathExists: request.pathExists,
      platform
    }).refresh()
    const targets = snapshot.uniqueTargets
      .map(
        (target): CliDistributionTarget => ({
          ...target,
          targetKey: createTargetKey(target.targetPath, target.primaryAgentId, platform)
        })
      )
      .map((target) => applyAgentFilter(target, request.agentFilter))
      .filter((target): target is CliDistributionTarget => target !== null)

    assertHasTargets(targets)

    return {
      scope: request.scope,
      targets
    }
  }

  const projectPath = normalizeProjectPath(request.scope.projectPath, platform)
  const pathModule = getPathModule(platform)
  const projectTargets = resolveProjectAgentTargets(
    {
      id: "cli-project",
      name: "CLI Project",
      path: projectPath,
      addedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    },
    {
      definitions: request.definitions,
      platform
    }
  )
  const targets = projectTargets
    .filter((target) => target.writable && target.writableAgentIds.length > 0)
    .map(
      (target): CliDistributionTarget => ({
        targetId: target.targetId,
        targetPath: pathModule.normalize(target.targetPath),
        primaryAgentId: target.primaryAgentId,
        coveredAgentIds: [...target.writableAgentIds],
        sharedPathKey: target.sharedPathKey,
        source: "auto-detected",
        ...(target.skillLayout ? { skillLayout: target.skillLayout } : {}),
        targetKey: createTargetKey(target.targetPath, target.primaryAgentId, platform)
      })
    )
    .map((target) => applyAgentFilter(target, request.agentFilter))
    .filter((target): target is CliDistributionTarget => target !== null)

  assertHasTargets(targets)

  return {
    scope: { type: "project", projectPath },
    targets
  }
}
