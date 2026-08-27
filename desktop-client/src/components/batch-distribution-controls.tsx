import { Button } from "@/components/ui-primitives"
import {
  getBatchEligibility,
  type BatchDistributionSummary,
  type BatchProgress
} from "@/core/review/batch-distribution"
import type { AppDictionary } from "@/i18n/messages/types"
import type { PendingSyncUpdate, PreDistributionCheckSnapshot } from "@/types"

export type BatchDistributionControlsProps = {
  pendingUpdates: PendingSyncUpdate[]
  preDistributionCheckSnapshot: PreDistributionCheckSnapshot | null
  isPreDistributionCheckStale: boolean
  selectedUpdateIds: string[]
  selectedPendingUpdateCount: number
  eligiblePendingUpdateCount: number
  isBatchRunning: boolean
  batchProgress: BatchProgress | null
  batchResults: BatchDistributionSummary | null
  batchLabels: AppDictionary["updatesView"]["batch"]
  onToggleUpdateSelection: (remoteSkillId: string) => void
  onSelectAllEligibleUpdates: () => void
  onClearUpdateSelection: () => void
  onRequestBatchDistributionConfirmation: () => void
}

export function BatchDistributionControls({
  pendingUpdates,
  preDistributionCheckSnapshot,
  isPreDistributionCheckStale,
  selectedUpdateIds,
  selectedPendingUpdateCount,
  eligiblePendingUpdateCount,
  isBatchRunning,
  batchProgress,
  batchResults,
  batchLabels,
  onToggleUpdateSelection,
  onSelectAllEligibleUpdates,
  onClearUpdateSelection,
  onRequestBatchDistributionConfirmation
}: BatchDistributionControlsProps) {
  return (
    <div className="card" aria-label={batchLabels.controlsLabel}>
      <div className="card__content">
        <div className="page-intro">
          <p className="card__description" role="status">
            {isBatchRunning && batchProgress ? (
              batchLabels.progress(batchProgress.completed, batchProgress.total)
            ) : batchResults ? (
              <>
                <strong>
                  {batchResults.partialCount > 0 || batchResults.failedCount > 0
                    ? batchLabels.completedWithWarnings
                    : batchLabels.completed}
                </strong>{" "}
                {batchLabels.summary(
                  batchResults.succeededCount,
                  batchResults.partialCount,
                  batchResults.failedCount,
                  batchResults.items.length
                )}
              </>
            ) : (
              batchLabels.selected(selectedPendingUpdateCount, eligiblePendingUpdateCount)
            )}
          </p>
          {pendingUpdates.length > 0 ? (
            <div aria-label={batchLabels.selectionLabel} className="list-stack">
              {pendingUpdates.map((pendingUpdate) => (
                <label key={pendingUpdate.remoteSkillId}>
                  <input
                    type="checkbox"
                    aria-label={batchLabels.selectItem(pendingUpdate.name)}
                    checked={selectedUpdateIds.includes(pendingUpdate.remoteSkillId)}
                    disabled={
                      isBatchRunning ||
                      getBatchEligibility(
                        pendingUpdate,
                        preDistributionCheckSnapshot,
                        isPreDistributionCheckStale
                      ) !== "eligible"
                    }
                    onChange={() => onToggleUpdateSelection(pendingUpdate.remoteSkillId)}
                  />
                </label>
              ))}
            </div>
          ) : null}
          <div className="page-intro__actions">
            <Button
              variant="outline"
              disabled={isBatchRunning || eligiblePendingUpdateCount === 0}
              onClick={onSelectAllEligibleUpdates}
            >
              {batchLabels.selectAll}
            </Button>
            <Button
              variant="outline"
              disabled={isBatchRunning || selectedUpdateIds.length === 0}
              onClick={onClearUpdateSelection}
            >
              {batchLabels.clear}
            </Button>
            <Button
              variant="primary"
              disabled={isBatchRunning || selectedPendingUpdateCount === 0}
              onClick={onRequestBatchDistributionConfirmation}
            >
              {batchLabels.distribute}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
