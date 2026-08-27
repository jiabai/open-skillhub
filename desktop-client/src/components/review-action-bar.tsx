import {
  Button
} from "@/components/ui-primitives"
import type { BatchDistributionSummary, BatchProgress } from "@/core/review/batch-distribution"
import { useI18n } from "@/i18n/use-i18n"

type ReviewActionBarProps = {
  selectedCount: number
  eligibleCount: number
  writeTargetCount: number
  isBatchRunning: boolean
  batchProgress: BatchProgress | null
  batchResults: BatchDistributionSummary | null
  onSelectAll: () => void
  onClearSelection: () => void
  onRequestDistribution: () => void
}

export function ReviewActionBar({
  selectedCount,
  eligibleCount,
  writeTargetCount,
  isBatchRunning,
  batchProgress,
  batchResults,
  onSelectAll,
  onClearSelection,
  onRequestDistribution
}: ReviewActionBarProps) {
  const { dictionary } = useI18n()
  const copy = dictionary.reviewWorkspace
  const batchCopy = dictionary.updatesView.batch

  return (
    <div
      aria-label={copy.confirmationTitle(selectedCount)}
      className="review-action-bar"
      data-testid="review-action-bar"
    >
      <div className="review-action-bar__summary">
        {isBatchRunning && batchProgress ? (
          <p className="card__description" role="status">
            {copy.distributing(batchProgress.completed, batchProgress.total)}
          </p>
        ) : batchResults ? (
          <p className="card__description" role="status">
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
        ) : (
          <>
            <strong>{copy.selected(selectedCount)}</strong>
            <span className="muted">{batchCopy.selected(selectedCount, eligibleCount)}</span>
            <span className="muted">{copy.writeTargets(writeTargetCount)}</span>
          </>
        )}
      </div>
      <div className="review-action-bar__actions" aria-label={batchCopy.selectionLabel}>
        <Button
          variant="outline"
          disabled={isBatchRunning || eligibleCount === 0}
          onClick={onSelectAll}
        >
          {copy.selectAll}
        </Button>
        <Button
          variant="outline"
          disabled={isBatchRunning || selectedCount === 0}
          onClick={onClearSelection}
        >
          {copy.clearSelection}
        </Button>
        <Button
          variant="primary"
          disabled={isBatchRunning || selectedCount === 0}
          onClick={onRequestDistribution}
        >
          {copy.distributeSelected(selectedCount)}
        </Button>
      </div>
    </div>
  )
}
