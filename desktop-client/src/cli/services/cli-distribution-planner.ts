import { resolveSkillInstallPath } from "@/adapters/agents/skill-layout"
import { directoryExists } from "@/core/distribution/distribution-conflicts"
import type { CliDistributionScope, CliDistributionTarget } from "@/cli/services/cli-targets"

export type CliDistributionPlanStatus =
  | "ready"
  | "conflict-existing"
  | "conflict-local-existing"
  | "failed-validation"

export interface CliPlanPackage {
  skillId: string
  name: string
  version: string | null
  contentHash: string | null
}

export interface CliDistributionPlanTarget {
  target: CliDistributionTarget
  destinationPath: string
  status: CliDistributionPlanStatus
  overwrite: boolean
  reason: string | null
}

export interface CreateCliDistributionPlanRequest {
  scope: CliDistributionScope
  source: "local" | "server"
  command: "install" | "sync"
  dryRun: boolean
  package: CliPlanPackage
  targets: CliDistributionTarget[]
  overwrite?: boolean
  overwriteUntracked?: boolean
  trackedRemoteSkillIdsByTargetKey?: Map<string, Set<string>>
  destinationExists?: (path: string) => Promise<boolean>
}

export interface CliDistributionPlan {
  scope: CliDistributionScope
  source: "local" | "server"
  command: "install" | "sync"
  dryRun: boolean
  package: CliPlanPackage
  targets: CliDistributionPlanTarget[]
  hasWrites: boolean
  hasBlockingConflicts: boolean
}

function isTrackedSyncUpdate(request: CreateCliDistributionPlanRequest, target: CliDistributionTarget): boolean {
  return Boolean(
    request.trackedRemoteSkillIdsByTargetKey
      ?.get(target.targetKey)
      ?.has(request.package.skillId)
  )
}

async function planTarget(
  target: CliDistributionTarget,
  request: CreateCliDistributionPlanRequest
): Promise<CliDistributionPlanTarget> {
  const destinationPath = resolveSkillInstallPath(
    target.targetPath,
    request.package.name,
    target.skillLayout
  )
  const exists = await (request.destinationExists ?? directoryExists)(destinationPath)

  if (!exists) {
    return {
      target,
      destinationPath,
      status: "ready",
      overwrite: false,
      reason: null
    }
  }

  if (request.command === "install") {
    if (request.overwrite) {
      return {
        target,
        destinationPath,
        status: "ready",
        overwrite: true,
        reason: null
      }
    }

    return {
      target,
      destinationPath,
      status: "conflict-existing",
      overwrite: false,
      reason: "Destination skill directory already exists"
    }
  }

  if (isTrackedSyncUpdate(request, target) || request.overwriteUntracked) {
    return {
      target,
      destinationPath,
      status: "ready",
      overwrite: true,
      reason: null
    }
  }

  return {
    target,
    destinationPath,
    status: "conflict-local-existing",
    overwrite: false,
    reason: "Existing same-name local skill is not tracked by CLI sync state"
  }
}

export async function createCliDistributionPlan(
  request: CreateCliDistributionPlanRequest
): Promise<CliDistributionPlan> {
  const targets = await Promise.all(request.targets.map((target) => planTarget(target, request)))

  return {
    scope: request.scope,
    source: request.source,
    command: request.command,
    dryRun: request.dryRun,
    package: request.package,
    targets,
    hasWrites: targets.some((target) => target.status === "ready"),
    hasBlockingConflicts: targets.some((target) => target.status !== "ready")
  }
}
