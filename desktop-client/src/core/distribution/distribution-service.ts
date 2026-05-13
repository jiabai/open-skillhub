import type { AgentAdapterV1 } from "@/adapters/agents/base"
import type {
  DesktopSyncState,
  PreparedSkillPackage,
  SkillDistributionRequest,
  SkillDistributionResult,
  SkillDistributionTarget,
  StateStore
} from "@/types"

import type { PackageService } from "@/core/distribution/package-service"
import { createDistributionWriteService } from "@/core/distribution/distribution-write-service"

export interface DistributionServiceDependencies {
  packageService: PackageService
  stateStore: StateStore
  resolveAgentAdapter(agentId: string): AgentAdapterV1 | null | undefined
  now?: () => string
}

export interface DistributionService {
  distribute(request: SkillDistributionRequest): Promise<SkillDistributionResult>
}

export interface DistributionNotification {
  title: string
  body: string
  tone: "success" | "warning"
}

function normalizeField(value: string, fieldName: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`Skill distribution ${fieldName} cannot be empty`)
  }

  if (normalized === "." || normalized === ".." || normalized.includes("/") || normalized.includes("\\")) {
    throw new Error(`Invalid skill distribution ${fieldName}: ${value}`)
  }

  return normalized
}

function normalizeTargetPath(value: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error("Skill distribution targetPath cannot be empty")
  }

  return normalized
}

function updateStateAfterSuccessfulDistribution(
  currentState: DesktopSyncState,
  request: Pick<SkillDistributionRequest, "skillId" | "name" | "version" | "contentHash">,
  comparedAt: string
): DesktopSyncState {
  const nextLocalRecords = [...currentState.localRecords]
  const existingRecordIndex = nextLocalRecords.findIndex(
    (record) => record.remoteSkillId === request.skillId
  )
  const nextRecord = {
    remoteSkillId: request.skillId,
    name: request.name,
    installedVersion: request.version,
    installedContentHash: request.contentHash,
    remoteVersion: request.version,
    remoteContentHash: request.contentHash,
    lastComparedAt: comparedAt
  }

  if (existingRecordIndex >= 0) {
    nextLocalRecords[existingRecordIndex] = nextRecord
  } else {
    nextLocalRecords.push(nextRecord)
  }

  return {
    localRecords: nextLocalRecords,
    pendingUpdates: currentState.pendingUpdates.filter(
      (update) => update.remoteSkillId !== request.skillId
    ),
    successfulDistributionCount: currentState.successfulDistributionCount + 1,
    lastRefreshedAt: currentState.lastRefreshedAt
  }
}

function normalizeDistributionTarget(target: SkillDistributionTarget): SkillDistributionTarget {
  const primaryAgentId = normalizeField(
    target.primaryAgentId,
    "primaryAgentId"
  ) as SkillDistributionTarget["primaryAgentId"]
  const coveredAgentIds = target.coveredAgentIds.map((agentId) =>
    normalizeField(agentId, "coveredAgentId")
  ) as SkillDistributionTarget["coveredAgentIds"]
  const targetPath = normalizeTargetPath(target.targetPath)

  if (coveredAgentIds.length === 0) {
    throw new Error("Skill distribution target must cover at least one agent")
  }

  return {
    ...target,
    adapterAgentId: target.adapterAgentId?.trim() || undefined,
    primaryAgentId,
    coveredAgentIds,
    targetPath,
    writeMode: target.writeMode ?? "write"
  }
}

export function createDistributionService(
  dependencies: DistributionServiceDependencies
): DistributionService {
  const now = dependencies.now ?? (() => new Date().toISOString())
  const writeService = createDistributionWriteService({
    resolveAgentAdapter: dependencies.resolveAgentAdapter
  })

  return {
    async distribute(request: SkillDistributionRequest): Promise<SkillDistributionResult> {
      const skillId = normalizeField(request.skillId, "skillId")
      const name = normalizeField(request.name, "name")
      const version = request.version?.trim() || null
      const contentHash = request.contentHash?.trim() || null
      const targets = request.targets.map(normalizeDistributionTarget)

      if (targets.length === 0) {
        throw new Error("At least one enabled agent target is required for distribution")
      }

      const writeTargets = targets.filter((target) => target.writeMode !== "skip-installed-content")
      let preparedPackage: PreparedSkillPackage | null = null

      if (writeTargets.length > 0) {
        preparedPackage = await dependencies.packageService.validateAndExtract({
          skillId,
          name,
          version,
          packageSource: request.packageSource
        })
      }

      try {
        const writeResult = await writeService.write({
          preparedPackage,
          targets
        })

        if (writeResult.allSucceeded) {
          const currentState = await dependencies.stateStore.readState()
          const nextState = updateStateAfterSuccessfulDistribution(currentState, {
            skillId,
            name,
            version,
            contentHash
          }, now())

          await dependencies.stateStore.writeState(nextState)
        }

        return {
          skillId,
          name,
          version,
          extractedPath: preparedPackage?.extractedPath ?? null,
          targets: writeResult.targets,
          succeededAgentIds: writeResult.succeededAgentIds,
          failedAgentIds: writeResult.failedAgentIds,
          syncedToLocalState: writeResult.allSucceeded
        }
      } finally {
        await preparedPackage?.cleanup()
      }
    }
  }
}

export function createDistributionNotification(
  result: SkillDistributionResult
): DistributionNotification {
  const failedCount = result.failedAgentIds.length
  const succeededCount = result.succeededAgentIds.length

  if (failedCount === 0) {
    return {
      title: "Skill distributed successfully",
      body: `${result.name} was distributed to ${succeededCount} agent target${
        succeededCount === 1 ? "" : "s"
      }.`,
      tone: "success"
    }
  }

  return {
    title: "Skill distribution completed with warnings",
    body: `${result.name} reached ${succeededCount} target${
      succeededCount === 1 ? "" : "s"
    } and failed on ${failedCount}.`,
    tone: "warning"
  }
}
