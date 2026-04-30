import type { AgentAdapterV1, AgentInstallContextV1 } from "@/adapters/agents/base"
import {
  DEFAULT_PRE_DISTRIBUTION_CHECK_MAX_CONCURRENT_TARGETS,
  DEFAULT_PRE_DISTRIBUTION_CHECK_SNAPSHOT_TTL_MS,
  DEFAULT_PRE_DISTRIBUTION_CHECK_TARGET_TIMEOUT_MS,
  DEFAULT_PRE_DISTRIBUTION_CHECK_TOTAL_TIMEOUT_MS
} from "@/core/pre-distribution-check/pre-distribution-check-config"
import {
  compareStrictSemverVersions,
  getVersionFormat
} from "@/core/pre-distribution-check/version-compare"
import type {
  AgentId,
  AgentSkillTarget,
  AgentPreDistributionCheckResult,
  PendingSyncUpdate,
  PreDistributionCheckResults,
  PreDistributionCheckSnapshot,
  PreDistributionVersionComparison,
  StateStore
} from "@/types"

export interface PreDistributionCheckTarget {
  adapter: Pick<AgentAdapterV1, "id" | "displayName" | "readInstalledSkillMetadata">
  coveredAdapters?: Array<Pick<AgentAdapterV1, "id" | "displayName">>
  installContext: AgentInstallContextV1
  target?: AgentSkillTarget
}

export interface PreDistributionCheckServiceOptions {
  targetTimeoutMs?: number
  totalTimeoutMs?: number
  maxConcurrentTargets?: number
  snapshotTtlMs?: number
}

export interface PreDistributionCheckServiceDependencies {
  stateStore: StateStore
  targets: PreDistributionCheckTarget[]
  options?: PreDistributionCheckServiceOptions
  now?: () => Date
  clock?: () => number
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
}

export interface PreDistributionCheckService {
  refresh(): Promise<PreDistributionCheckSnapshot>
}

type CheckJob = {
  pendingUpdate: PendingSyncUpdate
  target: PreDistributionCheckTarget
  completed: boolean
}

type TimeoutError = Error & {
  code: "TIMEOUT"
}

export function createPendingUpdateFingerprint(
  pendingUpdates: Pick<PendingSyncUpdate, "remoteSkillId" | "remoteVersion">[]
): string {
  return pendingUpdates
    .map((update) => `${update.remoteSkillId}@${update.remoteVersion}`)
    .sort()
    .join("|")
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return fallback
  }

  return Math.floor(value)
}

function createTimeoutError(message: string): TimeoutError {
  const error = new Error(message) as TimeoutError
  error.code = "TIMEOUT"
  return error
}

function uniqueAgentIds(agentIds: AgentId[]): AgentId[] {
  const seen = new Set<AgentId>()
  const unique: AgentId[] = []

  for (const agentId of agentIds) {
    if (seen.has(agentId)) {
      continue
    }

    seen.add(agentId)
    unique.push(agentId)
  }

  return unique
}

function getCoveredAdapters(
  target: PreDistributionCheckTarget
): Array<Pick<AgentAdapterV1, "id" | "displayName">> {
  return target.coveredAdapters && target.coveredAdapters.length > 0
    ? target.coveredAdapters
    : [target.adapter]
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code

    if (typeof code === "string" && code.trim()) {
      return code
    }
  }

  return "READ_FAILED"
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms)
}

function createEmptySnapshot(args: {
  pendingUpdates: PendingSyncUpdate[]
  targetAgentIds: AgentId[]
  now: Date
  snapshotTtlMs: number
  totalDurationMs: number
  globalErrors?: string[]
}): PreDistributionCheckSnapshot {
  return {
    results: {},
    checkedAt: args.now.toISOString(),
    expiresAt: addMs(args.now, args.snapshotTtlMs).toISOString(),
    pendingUpdateFingerprint: createPendingUpdateFingerprint(args.pendingUpdates),
    targetAgentIds: args.targetAgentIds,
    totalDurationMs: args.totalDurationMs,
    globalErrors: args.globalErrors ?? []
  }
}

function determineComparison(
  exists: boolean,
  installedVersion: string | null,
  remoteVersion: string
): PreDistributionVersionComparison {
  if (!exists) {
    return "not-installed"
  }

  if (installedVersion === null) {
    return "unknown"
  }

  return compareStrictSemverVersions(installedVersion, remoteVersion)
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  setTimeoutFn: typeof setTimeout,
  clearTimeoutFn: typeof clearTimeout
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeoutFn> | null = null

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeoutFn(() => {
      reject(createTimeoutError("Pre-distribution target check timed out."))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle !== null) {
      clearTimeoutFn(timeoutHandle)
    }
  })
}

export function createPreDistributionCheckService(
  dependencies: PreDistributionCheckServiceDependencies
): PreDistributionCheckService {
  const options = dependencies.options ?? {}
  const targetTimeoutMs = normalizePositiveInteger(
    options.targetTimeoutMs,
    DEFAULT_PRE_DISTRIBUTION_CHECK_TARGET_TIMEOUT_MS
  )
  const totalTimeoutMs = normalizePositiveInteger(
    options.totalTimeoutMs,
    DEFAULT_PRE_DISTRIBUTION_CHECK_TOTAL_TIMEOUT_MS
  )
  const maxConcurrentTargets = normalizePositiveInteger(
    options.maxConcurrentTargets,
    DEFAULT_PRE_DISTRIBUTION_CHECK_MAX_CONCURRENT_TARGETS
  )
  const snapshotTtlMs = normalizePositiveInteger(
    options.snapshotTtlMs,
    DEFAULT_PRE_DISTRIBUTION_CHECK_SNAPSHOT_TTL_MS
  )
  const now = dependencies.now ?? (() => new Date())
  const clock = dependencies.clock ?? (() => Date.now())
  const setTimeoutFn = dependencies.setTimeoutFn ?? setTimeout
  const clearTimeoutFn = dependencies.clearTimeoutFn ?? clearTimeout

  function createErrorResult(
    job: CheckJob,
    error: unknown,
    startedAtMs: number,
    adapter: Pick<AgentAdapterV1, "id" | "displayName"> = job.target.adapter,
    checkedAt = now()
  ): AgentPreDistributionCheckResult {
    return {
      agentId: adapter.id,
      displayName: adapter.displayName,
      skillDir: null,
      exists: false,
      installedVersion: null,
      installedVersionSource: null,
      remoteVersion: job.pendingUpdate.remoteVersion,
      installedVersionFormat: "unknown",
      remoteVersionFormat: getVersionFormat(job.pendingUpdate.remoteVersion),
      versionComparison: "error",
      checkedAt: checkedAt.toISOString(),
      durationMs: Math.max(0, clock() - startedAtMs),
      errorCode: getErrorCode(error),
      errorMessage: getErrorMessage(error)
    }
  }

  function createMetadataResult(args: {
    job: CheckJob
    metadata: Awaited<ReturnType<AgentAdapterV1["readInstalledSkillMetadata"]>>
    adapter: Pick<AgentAdapterV1, "id" | "displayName">
    startedAtMs: number
    checkedAt: Date
  }): AgentPreDistributionCheckResult {
    return {
      agentId: args.adapter.id,
      displayName: args.adapter.displayName,
      skillDir: args.metadata.skillDir,
      exists: args.metadata.exists,
      installedVersion: args.metadata.version,
      installedVersionSource: args.metadata.versionSource,
      remoteVersion: args.job.pendingUpdate.remoteVersion,
      installedVersionFormat: getVersionFormat(args.metadata.version),
      remoteVersionFormat: getVersionFormat(args.job.pendingUpdate.remoteVersion),
      versionComparison: determineComparison(
        args.metadata.exists,
        args.metadata.version,
        args.job.pendingUpdate.remoteVersion
      ),
      checkedAt: args.checkedAt.toISOString(),
      durationMs: Math.max(0, clock() - args.startedAtMs),
      errorCode: null,
      errorMessage: null
    }
  }

  function completeJobResults(
    job: CheckJob,
    results: PreDistributionCheckResults,
    createResult: (
      adapter: Pick<AgentAdapterV1, "id" | "displayName">
    ) => AgentPreDistributionCheckResult
  ): void {
    if (job.completed) {
      return
    }

    job.completed = true

    const currentResults = results[job.pendingUpdate.remoteSkillId] ?? {}
    const nextResults = { ...currentResults }

    for (const adapter of getCoveredAdapters(job.target)) {
      nextResults[adapter.id] = createResult(adapter)
    }

    results[job.pendingUpdate.remoteSkillId] = nextResults
  }

  async function runJob(job: CheckJob, results: PreDistributionCheckResults): Promise<void> {
    const startedAtMs = clock()

    try {
      const metadata = await withTimeout(
        job.target.adapter.readInstalledSkillMetadata(
          job.pendingUpdate.name,
          job.target.installContext
        ),
        targetTimeoutMs,
        setTimeoutFn,
        clearTimeoutFn
      )
      const checkedAt = now()

      completeJobResults(job, results, (adapter) =>
        createMetadataResult({
          job,
          metadata,
          adapter,
          startedAtMs,
          checkedAt
        })
      )
    } catch (error) {
      completeJobResults(job, results, (adapter) =>
        createErrorResult(job, error, startedAtMs, adapter)
      )
    }
  }

  async function runJobs(
    jobs: CheckJob[],
    results: PreDistributionCheckResults,
    isCancelled: () => boolean
  ): Promise<void> {
    let nextJobIndex = 0

    async function worker(): Promise<void> {
      while (!isCancelled()) {
        const job = jobs[nextJobIndex]
        nextJobIndex += 1

        if (!job) {
          return
        }

        await runJob(job, results)
      }
    }

    const workerCount = Math.min(maxConcurrentTargets, jobs.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
  }

  return {
    async refresh(): Promise<PreDistributionCheckSnapshot> {
      const totalStartedAtMs = clock()
      const currentState = await dependencies.stateStore.readState()
      const pendingUpdates = currentState.pendingUpdates
      const targetAgentIds = uniqueAgentIds(
        dependencies.targets.flatMap((target) =>
          getCoveredAdapters(target).map((adapter) => adapter.id)
        )
      )

      if (pendingUpdates.length === 0) {
        return createEmptySnapshot({
          pendingUpdates,
          targetAgentIds,
          now: now(),
          snapshotTtlMs,
          totalDurationMs: Math.max(0, clock() - totalStartedAtMs)
        })
      }

      if (dependencies.targets.length === 0) {
        return createEmptySnapshot({
          pendingUpdates,
          targetAgentIds,
          now: now(),
          snapshotTtlMs,
          totalDurationMs: Math.max(0, clock() - totalStartedAtMs),
          globalErrors: [
            "No configured agent skill directories are available for pre-distribution checks."
          ]
        })
      }

      const results: PreDistributionCheckResults = {}
      const jobs: CheckJob[] = pendingUpdates.flatMap((pendingUpdate) =>
        dependencies.targets.map((target) => ({
          pendingUpdate,
          target,
          completed: false
        }))
      )
      let cancelled = false
      let totalTimeoutHandle: ReturnType<typeof setTimeoutFn> | null = null
      const queuePromise = runJobs(jobs, results, () => cancelled)
      const timeoutPromise = new Promise<"timeout">((resolve) => {
        totalTimeoutHandle = setTimeoutFn(() => {
          resolve("timeout")
        }, totalTimeoutMs)
      })
      const outcome = await Promise.race([
        queuePromise.then(() => "completed" as const),
        timeoutPromise
      ])

      if (totalTimeoutHandle !== null) {
        clearTimeoutFn(totalTimeoutHandle)
      }

      const globalErrors: string[] = []

      if (outcome === "timeout") {
        cancelled = true
        globalErrors.push("Pre-distribution check timed out before all targets completed.")

        for (const job of jobs) {
          if (!job.completed) {
            const timedOutAtMs = totalStartedAtMs
            completeJobResults(job, results, (adapter) =>
              createErrorResult(
                job,
                createTimeoutError("Pre-distribution check timed out."),
                timedOutAtMs,
                adapter
              )
            )
          }
        }
      }

      const checkedAt = now()

      return {
        results,
        checkedAt: checkedAt.toISOString(),
        expiresAt: addMs(checkedAt, snapshotTtlMs).toISOString(),
        pendingUpdateFingerprint: createPendingUpdateFingerprint(pendingUpdates),
        targetAgentIds,
        totalDurationMs: Math.max(0, clock() - totalStartedAtMs),
        globalErrors
      }
    }
  }
}
