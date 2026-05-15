import type { AgentAdapterV1 } from "@/adapters/agents/base"
import { createDistributionWriteService } from "@/core/distribution/distribution-write-service"
import { removeSkillDestination } from "@/core/distribution/distribution-conflicts"
import {
  createCliDistributionPlan,
  type CliDistributionPlan
} from "@/cli/services/cli-distribution-planner"
import {
  resolveCliDistributionTargets,
  type CliDistributionScope,
  type ResolveCliDistributionTargetsRequest
} from "@/cli/services/cli-targets"
import { prepareCliLocalPackageSource } from "@/cli/services/cli-package-source"
import { CliError } from "@/cli/services/cli-errors"
import type { AgentId, SkillDistributionResult } from "@/types"

export interface RunInstallCommandRequest {
  sourcePath: string
  scope: CliDistributionScope
  agentFilter?: AgentId[]
  yes?: boolean
  overwrite?: boolean
  json?: boolean
  cacheDir: string
  targetOptions?: Omit<ResolveCliDistributionTargetsRequest, "scope" | "agentFilter">
  resolveAgentAdapter(agentId: string): AgentAdapterV1 | null | undefined
}

export interface RunInstallCommandResult {
  exitCode: number
  plan: CliDistributionPlan
  distributionResult: SkillDistributionResult | null
}

export async function runInstallCommand(
  request: RunInstallCommandRequest
): Promise<RunInstallCommandResult> {
  const preparedPackage = await prepareCliLocalPackageSource({
    sourcePath: request.sourcePath,
    cacheDir: request.cacheDir
  })

  try {
    const targetResolution = await resolveCliDistributionTargets({
      ...request.targetOptions,
      scope: request.scope,
      agentFilter: request.agentFilter
    })
    const plan = await createCliDistributionPlan({
      scope: targetResolution.scope,
      source: "local",
      command: "install",
      dryRun: !request.yes,
      overwrite: request.overwrite,
      package: {
        skillId: preparedPackage.skillId,
        name: preparedPackage.name,
        version: preparedPackage.version,
        contentHash: null
      },
      targets: targetResolution.targets
    })

    if (!request.yes) {
      return {
        exitCode: 0,
        plan,
        distributionResult: null
      }
    }

    if (plan.hasBlockingConflicts) {
      throw new CliError("validation", "Install plan has blocking conflicts")
    }

    for (const target of plan.targets) {
      if (target.overwrite) {
        await removeSkillDestination({
          destinationPath: target.destinationPath,
          targetPath: target.target.targetPath
        })
      }
    }

    const writeService = createDistributionWriteService({
      resolveAgentAdapter: request.resolveAgentAdapter
    })
    const writeResult = await writeService.write({
      preparedPackage,
      targets: plan.targets
        .filter((target) => target.status === "ready")
        .map((target) => target.target)
    })
    const distributionResult: SkillDistributionResult = {
      skillId: preparedPackage.skillId,
      name: preparedPackage.name,
      version: preparedPackage.version,
      extractedPath: preparedPackage.extractedPath,
      targets: writeResult.targets,
      succeededAgentIds: writeResult.succeededAgentIds,
      failedAgentIds: writeResult.failedAgentIds,
      syncedToLocalState: false
    }

    return {
      exitCode: writeResult.allSucceeded ? 0 : 2,
      plan,
      distributionResult
    }
  } finally {
    await preparedPackage.cleanup()
  }
}
