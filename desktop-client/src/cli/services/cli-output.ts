import type { CliDistributionPlan } from "@/cli/services/cli-distribution-planner"
import type { CliDistributionTarget } from "@/cli/services/cli-targets"
import type { SkillDistributionResult } from "@/types"

export function renderJsonOutput(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function renderDetectOutput(targets: CliDistributionTarget[]): string {
  if (targets.length === 0) {
    return "No writable SkillDrive agent targets found.\n"
  }

  return `${targets
    .map((target) => {
      const agents = target.coveredAgentIds.join(", ")
      return `${target.targetPath} -> ${agents}`
    })
    .join("\n")}\n`
}

export function renderPlanOutput(plans: CliDistributionPlan[]): string {
  if (plans.length === 0) {
    return "No skill updates are pending for the selected targets.\n"
  }

  return `${plans
    .flatMap((plan) =>
      plan.targets.map((target) => {
        const agents = target.target.coveredAgentIds.join(", ")
        return `${plan.package.name} -> ${target.destinationPath} [${target.status}] (${agents})`
      })
    )
    .join("\n")}\n`
}

export function renderDistributionResults(results: SkillDistributionResult[]): string {
  if (results.length === 0) {
    return "No skill distributions were applied.\n"
  }

  return `${results
    .map((result) => {
      const succeeded = result.succeededAgentIds.length
      const failed = result.failedAgentIds.length
      return `${result.name}: ${succeeded} succeeded, ${failed} failed`
    })
    .join("\n")}\n`
}
