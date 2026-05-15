import type { AgentAdapterV1 } from "@/adapters/agents/base"
import { createDistributionWriteService } from "@/core/distribution/distribution-write-service"
import { removeSkillDestination } from "@/core/distribution/distribution-conflicts"
import {
  createCliDistributionPlan,
  type CliDistributionPlan
} from "@/cli/services/cli-distribution-planner"
import {
  createTrackedRemoteSkillIdsByTargetKey,
  normalizeRemoteError,
  selectRemoteSkillsForSync,
  toCliSyncScope,
  type CliSyncApiClient
} from "@/cli/services/cli-sync-service"
import type { CliSyncStateStore } from "@/cli/services/cli-sync-state"
import {
  resolveCliDistributionTargets,
  type CliDistributionScope,
  type ResolveCliDistributionTargetsRequest
} from "@/cli/services/cli-targets"
import { CliError } from "@/cli/services/cli-errors"
import type { AgentId, SkillDistributionResult } from "@/types"

export interface RunSyncCommandRequest {
  scope: CliDistributionScope
  agentFilter?: AgentId[]
  all?: boolean
  yes?: boolean
  overwriteUntracked?: boolean
  cacheDir: string
  apiClient: CliSyncApiClient
  stateStore: CliSyncStateStore
  targetOptions?: Omit<ResolveCliDistributionTargetsRequest, "scope" | "agentFilter">
  resolveAgentAdapter(agentId: string): AgentAdapterV1 | null | undefined
  now?: () => string
}

export interface RunSyncCommandResult {
  exitCode: number
  plans: CliDistributionPlan[]
  distributionResults: SkillDistributionResult[]
}

export async function runSyncCommand(request: RunSyncCommandRequest): Promise<RunSyncCommandResult> {
  const now = request.now ?? (() => new Date().toISOString())
  const targetResolution = await resolveCliDistributionTargets({
    ...request.targetOptions,
    scope: request.scope,
    agentFilter: request.agentFilter
  })
  const syncScope = toCliSyncScope(targetResolution.scope)
  const remoteSkills = await (async () => {
    try {
      return await request.apiClient.listClientSkills()
    } catch (error) {
      normalizeRemoteError("Failed to list server skills", error)
    }
  })()
  const selectedRemoteSkills = await selectRemoteSkillsForSync({
    remoteSkills,
    targets: targetResolution.targets,
    stateStore: request.stateStore,
    scope: syncScope,
    all: request.all
  })
  const trackedRemoteSkillIdsByTargetKey = await createTrackedRemoteSkillIdsByTargetKey(
    request.stateStore,
    syncScope
  )
  const plans: CliDistributionPlan[] = []
  const distributionResults: SkillDistributionResult[] = []
  let exitCode = 0

  for (const remoteSkill of selectedRemoteSkills) {
    const planPackage = {
      skillId: remoteSkill.id,
      name: remoteSkill.name,
      version: remoteSkill.version,
      contentHash: remoteSkill.contentHash
    }

    if (!request.yes) {
      plans.push(
        await createCliDistributionPlan({
          scope: targetResolution.scope,
          source: "server",
          command: "sync",
          dryRun: true,
          package: planPackage,
          targets: targetResolution.targets,
          overwriteUntracked: request.overwriteUntracked,
          trackedRemoteSkillIdsByTargetKey
        })
      )
      continue
    }

    const preparedPackage = await (async () => {
      try {
        const prepared = await request.apiClient.downloadSkillPackage(remoteSkill, {
          cacheDir: request.cacheDir
        })

        return {
          ...prepared,
          skillId: remoteSkill.id,
          name: remoteSkill.name,
          version: remoteSkill.version
        }
      } catch (error) {
        normalizeRemoteError("Failed to download skill package", error)
      }
    })()

    try {
      const plan = await createCliDistributionPlan({
        scope: targetResolution.scope,
        source: "server",
        command: "sync",
        dryRun: false,
        package: planPackage,
        targets: targetResolution.targets,
        overwriteUntracked: request.overwriteUntracked,
        trackedRemoteSkillIdsByTargetKey
      })

      plans.push(plan)

      if (plan.hasBlockingConflicts) {
        throw new CliError("validation", "Sync plan has blocking conflicts")
      }

      for (const target of plan.targets) {
        if (target.overwrite) {
          await removeSkillDestination({
            destinationPath: target.destinationPath,
            targetPath: target.target.targetPath
          })
        }
      }

      const writeResult = await createDistributionWriteService({
        resolveAgentAdapter: request.resolveAgentAdapter
      }).write({
        preparedPackage,
        targets: plan.targets
          .filter((target) => target.status === "ready")
          .map((target) => target.target)
      })
      const distributionResult: SkillDistributionResult = {
        skillId: remoteSkill.id,
        name: remoteSkill.name,
        version: remoteSkill.version,
        extractedPath: preparedPackage.extractedPath,
        targets: writeResult.targets,
        succeededAgentIds: writeResult.succeededAgentIds,
        failedAgentIds: writeResult.failedAgentIds,
        syncedToLocalState: writeResult.allSucceeded
      }

      distributionResults.push(distributionResult)

      if (!writeResult.allSucceeded) {
        exitCode = 2
        continue
      }

      for (const target of plan.targets.filter((target) => target.status === "ready")) {
        await request.stateStore.upsertRecord({
          scopeType: syncScope.scopeType,
          scopeKey: syncScope.scopeKey,
          targetKey: target.target.targetKey,
          agentId: target.target.primaryAgentId,
          remoteSkillId: remoteSkill.id,
          name: remoteSkill.name,
          installedVersion: remoteSkill.version,
          installedContentHash: remoteSkill.contentHash,
          remoteVersion: remoteSkill.version,
          remoteContentHash: remoteSkill.contentHash,
          lastSyncedAt: now()
        })
      }
    } finally {
      await preparedPackage.cleanup()
    }
  }

  return {
    exitCode,
    plans,
    distributionResults
  }
}
