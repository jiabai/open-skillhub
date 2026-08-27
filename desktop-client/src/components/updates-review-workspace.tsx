import type {
  PendingSyncUpdate,
  PreDistributionCheckSnapshot,
  PreDistributionContentComparison
} from "@/types"
import {
  getBatchEligibility,
  type BatchDistributionSummary,
  type BatchProgress
} from "@/core/review/batch-distribution"
import {
  getPreDistributionCheckResults
} from "@/components/pre-distribution-check-summary"
import { ReviewActionBar } from "@/components/review-action-bar"
import { ReviewSummary, type ReviewSummaryCheckStatus } from "@/components/review-summary"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui-primitives"
import { formatDateTime } from "@/i18n/format-date"
import { useI18n } from "@/i18n/use-i18n"

type UpdatesReviewWorkspaceProps = {
  pendingUpdates: PendingSyncUpdate[]
  preDistributionCheckSnapshot: PreDistributionCheckSnapshot | null
  busyUpdateId: string | null
  isLoading: boolean
  isBatchRunning: boolean
  isPreDistributionChecking: boolean
  isPreDistributionCheckStale: boolean
  selectedUpdateIds: string[]
  batchProgress: BatchProgress | null
  batchResults: BatchDistributionSummary | null
  onToggleSelected: (remoteSkillId: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onRequestDistribution: () => void
  onDistribute: (pendingUpdate: PendingSyncUpdate) => void
  onReconcileInstalled: (pendingUpdate: PendingSyncUpdate) => void
  onRefreshCheck: () => void
}

function getStatusTone(eligibility: ReturnType<typeof getBatchEligibility>) {
  if (eligibility === "eligible") {
    return "accent" as const
  }

  if (eligibility === "installed") {
    return "success" as const
  }

  return "warning" as const
}

function getComparisonStatusLabel(
  comparison: PreDistributionContentComparison,
  labels: ReturnType<typeof useI18n>["dictionary"]["preDistributionCheck"]["comparisonStatusLabels"]
) {
  return labels[comparison]
}

function getTargetSummary(
  pendingUpdate: PendingSyncUpdate,
  snapshot: PreDistributionCheckSnapshot | null,
  isStale: boolean,
  refreshNeededLabel: string,
  comparisonLabels: ReturnType<typeof useI18n>["dictionary"]["preDistributionCheck"]["comparisonStatusLabels"]
) {
  const results = getPreDistributionCheckResults(pendingUpdate, snapshot, isStale)

  if (results.length === 0) {
    return <span className="muted">{refreshNeededLabel}</span>
  }

  return (
    <span className="review-table__target-list">
      {results.map((result) => (
        <span key={result.agentId}>
          {result.displayName}: {getComparisonStatusLabel(result.contentComparison, comparisonLabels)}
        </span>
      ))}
    </span>
  )
}

function getBlockedErrorMessages(
  pendingUpdate: PendingSyncUpdate,
  snapshot: PreDistributionCheckSnapshot | null,
  isStale: boolean
): string[] {
  const targetErrors = getPreDistributionCheckResults(pendingUpdate, snapshot, isStale)
    .filter((result) => result.contentComparison === "error")
    .map((result) => result.errorMessage)
    .filter((message): message is string => Boolean(message))

  return [...new Set([...(snapshot?.globalErrors ?? []), ...targetErrors])]
}

function getWriteTargetCount(
  selectedUpdates: PendingSyncUpdate[],
  snapshot: PreDistributionCheckSnapshot | null,
  isStale: boolean
): number {
  if (!snapshot || isStale) {
    return 0
  }

  return snapshot.targetAgentIds.filter((agentId) =>
    selectedUpdates.some((pendingUpdate) => {
      const result = snapshot.results[pendingUpdate.remoteSkillId]?.[agentId]
      return result?.contentComparison !== "installed"
    })
  ).length
}

function getReviewSummaryCheckStatus(
  pendingUpdates: PendingSyncUpdate[],
  snapshot: PreDistributionCheckSnapshot | null,
  isStale: boolean
): ReviewSummaryCheckStatus {
  if (isStale) {
    return "stale"
  }

  if (!snapshot) {
    return "missing"
  }

  if (
    snapshot.globalErrors.length > 0 ||
    snapshot.targetAgentIds.length === 0 ||
    pendingUpdates.some((pendingUpdate) =>
      snapshot.targetAgentIds.some((agentId) => {
        const result = snapshot.results[pendingUpdate.remoteSkillId]?.[agentId]
        return result === undefined || result.contentComparison === "error"
      })
    )
  ) {
    return "error"
  }

  return "current"
}

function getLastCheckText(
  snapshot: PreDistributionCheckSnapshot | null,
  isChecking: boolean,
  isStale: boolean,
  loadingLabel: string,
  staleLabel: string,
  refreshNeededLabel: string,
  lastChecked: (value: string) => string,
  locale: Parameters<typeof formatDateTime>[0]
): string {
  if (isChecking) {
    return loadingLabel
  }

  if (isStale) {
    return staleLabel
  }

  if (!snapshot) {
    return refreshNeededLabel
  }

  const formatted = formatDateTime(locale, snapshot.checkedAt, {
    dateStyle: "medium",
    timeStyle: "short"
  }, "")
  return formatted ? lastChecked(formatted) : refreshNeededLabel
}

function ReviewBatchStatus({
  isBatchRunning,
  batchProgress,
  batchResults
}: Pick<UpdatesReviewWorkspaceProps, "isBatchRunning" | "batchProgress" | "batchResults">) {
  const { dictionary } = useI18n()
  const copy = dictionary.reviewWorkspace
  const batchCopy = dictionary.updatesView.batch

  if (isBatchRunning && batchProgress) {
    return (
      <p className="card__description" role="status" data-testid="review-batch-status">
        {copy.distributing(batchProgress.completed, batchProgress.total)}
      </p>
    )
  }

  if (!batchResults) {
    return null
  }

  return (
    <p className="card__description" role="status" data-testid="review-batch-status">
      <strong>
        {batchResults.partialCount > 0 || batchResults.failedCount > 0
          ? batchCopy.completedWithWarnings
          : batchCopy.completed}
      </strong>{" "}
      {batchCopy.summary(
        batchResults.succeededCount,
        batchResults.partialCount,
        batchResults.failedCount,
        batchResults.items.length
      )}
      <span className="muted">
        {copy.batchCompleted(
          batchResults.succeededCount,
          batchResults.partialCount,
          batchResults.failedCount
        )}
      </span>
    </p>
  )
}

export function UpdatesReviewWorkspace({
  pendingUpdates,
  preDistributionCheckSnapshot,
  busyUpdateId,
  isLoading,
  isBatchRunning,
  isPreDistributionChecking,
  isPreDistributionCheckStale,
  selectedUpdateIds,
  batchProgress,
  batchResults,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onRequestDistribution,
  onDistribute,
  onReconcileInstalled,
  onRefreshCheck
}: UpdatesReviewWorkspaceProps) {
  const { dictionary, locale } = useI18n()
  const copy = dictionary.reviewWorkspace
  const precheckCopy = dictionary.preDistributionCheck
  const pendingCopy = dictionary.pendingUpdatesPanel

  const eligibilityById = new Map(
    pendingUpdates.map((pendingUpdate) => [
      pendingUpdate.remoteSkillId,
      getBatchEligibility(
        pendingUpdate,
        preDistributionCheckSnapshot,
        isPreDistributionCheckStale
      )
    ])
  )
  const eligibleCount = pendingUpdates.filter(
    (pendingUpdate) => eligibilityById.get(pendingUpdate.remoteSkillId) === "eligible"
  ).length
  const selectedUpdates = pendingUpdates.filter(
    (pendingUpdate) =>
      selectedUpdateIds.includes(pendingUpdate.remoteSkillId) &&
      eligibilityById.get(pendingUpdate.remoteSkillId) === "eligible"
  )
  const blockedCount = pendingUpdates.filter(
    (pendingUpdate) => eligibilityById.get(pendingUpdate.remoteSkillId) === "blocked"
  ).length
  const writeTargetCount = getWriteTargetCount(
    selectedUpdates,
    preDistributionCheckSnapshot,
    isPreDistributionCheckStale
  )
  const lastCheckText = getLastCheckText(
    preDistributionCheckSnapshot,
    isPreDistributionChecking,
    isPreDistributionCheckStale,
    precheckCopy.loading,
    precheckCopy.stale,
    precheckCopy.refreshNeeded,
    precheckCopy.lastChecked,
    locale
  )
  const checkStatus = getReviewSummaryCheckStatus(
    pendingUpdates,
    preDistributionCheckSnapshot,
    isPreDistributionCheckStale
  )
  const hasGlobalErrors = (preDistributionCheckSnapshot?.globalErrors.length ?? 0) > 0
  const showActionBar = selectedUpdates.length > 0
  const showBatchStatusOutsideActionBar =
    !showActionBar && ((isBatchRunning && batchProgress !== null) || batchResults !== null)

  return (
    <Card className="review-workspace" aria-labelledby="review-workspace-heading">
      <CardHeader>
        <div className="page-intro">
          <div className="section-heading">
            <span className="section-heading__eyebrow">{copy.steps}</span>
            <CardTitle id="review-workspace-heading">{copy.summaryTitle}</CardTitle>
            <CardDescription>{pendingCopy.description(pendingUpdates.length)}</CardDescription>
          </div>
          {pendingUpdates.length > 0 ? (
            <Button
              variant="secondary"
              disabled={isBatchRunning || isPreDistributionChecking}
              onClick={onRefreshCheck}
            >
              {isPreDistributionChecking ? pendingCopy.refreshingCheck : pendingCopy.refreshCheck}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {hasGlobalErrors ? (
          <div className="callout callout--warning">
            <strong>{precheckCopy.globalErrorsTitle}</strong>
            {preDistributionCheckSnapshot?.globalErrors.map((message) => (
              <span key={message}>{message}</span>
            ))}
          </div>
        ) : null}

        {showBatchStatusOutsideActionBar ? (
          <ReviewBatchStatus
            isBatchRunning={isBatchRunning}
            batchProgress={batchProgress}
            batchResults={batchResults}
          />
        ) : null}

        {pendingUpdates.length === 0 ? (
          <>
            <div className="callout">
              {isLoading ? pendingCopy.loading : pendingCopy.noPendingUpdates}
            </div>
            {showActionBar ? (
              <ReviewActionBar
                selectedCount={selectedUpdates.length}
                eligibleCount={eligibleCount}
                writeTargetCount={writeTargetCount}
                isBatchRunning={isBatchRunning}
                batchProgress={batchProgress}
                batchResults={batchResults}
                onSelectAll={onSelectAll}
                onClearSelection={onClearSelection}
                onRequestDistribution={onRequestDistribution}
              />
            ) : null}
          </>
        ) : (
          <div className="review-workspace__layout">
            <div className="review-workspace__main">
              <div className="review-table-wrap">
                <table className="review-table">
                  <thead>
                    <tr>
                      <th scope="col">{copy.columns.select}</th>
                      <th scope="col">{copy.columns.status}</th>
                      <th scope="col">{copy.columns.change}</th>
                      <th scope="col">{copy.columns.targets}</th>
                      <th scope="col">{copy.columns.version}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUpdates.map((pendingUpdate) => {
                      const eligibility = eligibilityById.get(pendingUpdate.remoteSkillId) ?? "blocked"
                      const isBusy = busyUpdateId === pendingUpdate.remoteSkillId
                      const isSelected = selectedUpdateIds.includes(pendingUpdate.remoteSkillId)
                      const blockedErrorMessages = getBlockedErrorMessages(
                        pendingUpdate,
                        preDistributionCheckSnapshot,
                        isPreDistributionCheckStale
                      )
                      const reasonLabel =
                        pendingUpdate.reason === "not-installed"
                          ? pendingCopy.reasonLabels.missingLocalRecord
                          : pendingCopy.reasonLabels.versionMismatch
                      const targetCount = preDistributionCheckSnapshot?.targetAgentIds.length ?? 0

                      return (
                        <tr
                          className={`review-table__row review-table__row--${eligibility}`}
                          data-review-card="true"
                          key={pendingUpdate.remoteSkillId}
                        >
                          <td className="review-table__cell review-table__cell--select" data-label={copy.columns.select}>
                            <label className="review-table__select-label">
                              <input
                                type="checkbox"
                                aria-label={copy.selectItem(pendingUpdate.name)}
                                checked={isSelected && eligibility === "eligible"}
                                disabled={isBatchRunning || eligibility !== "eligible"}
                                onChange={() => onToggleSelected(pendingUpdate.remoteSkillId)}
                              />
                              <span className="sr-only">{copy.selectItem(pendingUpdate.name)}</span>
                            </label>
                          </td>
                          <td className="review-table__cell" data-label={copy.columns.status}>
                            <div className="review-table__status">
                              <Badge tone={getStatusTone(eligibility)}>
                                {eligibility === "eligible"
                                  ? copy.statuses.ready
                                  : eligibility === "installed"
                                    ? copy.statuses.installed
                                    : copy.statuses.blocked}
                              </Badge>
                              {eligibility === "blocked" ? (
                                <p className="review-table__blocked-reason">
                                  <strong>{copy.blockedReason}</strong>
                                  {blockedErrorMessages.map((message) => (
                                    <span key={message}>{message}</span>
                                  ))}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="review-table__cell" data-label={copy.columns.change}>
                            <div className="review-table__change">
                              <strong>{pendingUpdate.name}</strong>
                              <span className="muted mono">{pendingUpdate.remoteSkillId}</span>
                              <span className="muted">{reasonLabel}</span>
                            </div>
                          </td>
                          <td className="review-table__cell" data-label={copy.columns.targets}>
                            <div className="review-table__targets">
                              <strong>{copy.writeTargets(targetCount)}</strong>
                              {getTargetSummary(
                                pendingUpdate,
                                preDistributionCheckSnapshot,
                                isPreDistributionCheckStale,
                                precheckCopy.refreshNeeded,
                                precheckCopy.comparisonStatusLabels
                              )}
                            </div>
                          </td>
                          <td className="review-table__cell" data-label={copy.columns.version}>
                            <div className="review-table__version">
                              <Badge>{dictionary.common.local(pendingUpdate.localVersion ?? dictionary.common.nA)}</Badge>
                              <Badge tone="accent">{dictionary.common.remote(pendingUpdate.remoteVersion)}</Badge>
                              {eligibility === "installed" ? (
                                <Button
                                  variant="secondary"
                                  onClick={() => onReconcileInstalled(pendingUpdate)}
                                  disabled={isBatchRunning || isBusy}
                                  aria-label={`${pendingCopy.syncLocalRecord} ${pendingUpdate.name}`}
                                >
                                  {isBusy ? pendingCopy.syncingRecord : pendingCopy.syncLocalRecord}
                                </Button>
                              ) : eligibility === "eligible" ? (
                                <Button
                                  variant="primary"
                                  onClick={() => onDistribute(pendingUpdate)}
                                  disabled={isBatchRunning || isBusy}
                                  aria-label={`${pendingCopy.distribute} ${pendingUpdate.name}`}
                                >
                                  {isBusy ? pendingCopy.distributing : pendingCopy.distribute}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {showActionBar ? (
                <ReviewActionBar
                  selectedCount={selectedUpdates.length}
                  eligibleCount={eligibleCount}
                  writeTargetCount={writeTargetCount}
                  isBatchRunning={isBatchRunning}
                  batchProgress={batchProgress}
                  batchResults={batchResults}
                  onSelectAll={onSelectAll}
                  onClearSelection={onClearSelection}
                  onRequestDistribution={onRequestDistribution}
                />
              ) : null}
            </div>
            <ReviewSummary
              selectedCount={selectedUpdates.length}
              blockedCount={blockedCount}
              writeTargetCount={writeTargetCount}
              lastCheckText={lastCheckText}
              checkStatus={checkStatus}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
