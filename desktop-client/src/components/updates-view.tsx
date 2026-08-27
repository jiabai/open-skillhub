import type { PendingSyncUpdate, PreDistributionCheckSnapshot } from "@/types"
import { PageIntro } from "@/components/ui-primitives"
import {
  type BatchDistributionControlsProps
} from "@/components/batch-distribution-controls"
import { UpdatesReviewWorkspace } from "@/components/updates-review-workspace"
import { useI18n } from "@/i18n/use-i18n"

type UpdatesViewProps = {
  busyUpdateId: string | null
  isBatchRunning: boolean
  isLoading: boolean
  isPreDistributionChecking: boolean
  isPreDistributionCheckStale: boolean
  pendingUpdates: PendingSyncUpdate[]
  preDistributionCheckSnapshot: PreDistributionCheckSnapshot | null
  batchControls: BatchDistributionControlsProps
  onDistribute: (pendingUpdate: PendingSyncUpdate) => void
  onReconcileInstalled: (pendingUpdate: PendingSyncUpdate) => void
  onRefreshPreDistributionCheck: () => void
}

export function UpdatesView({
  busyUpdateId,
  isBatchRunning,
  isLoading,
  isPreDistributionChecking,
  isPreDistributionCheckStale,
  pendingUpdates,
  preDistributionCheckSnapshot,
  batchControls,
  onDistribute,
  onReconcileInstalled,
  onRefreshPreDistributionCheck
}: UpdatesViewProps) {
  const { dictionary } = useI18n()

  return (
    <section className="page-stack">
      <PageIntro
        eyebrow={dictionary.updatesView.eyebrow}
        title={dictionary.updatesView.title}
        summary={dictionary.updatesView.summary}
      />
      <UpdatesReviewWorkspace
        isLoading={isLoading}
        isBatchRunning={isBatchRunning}
        isPreDistributionChecking={isPreDistributionChecking}
        isPreDistributionCheckStale={isPreDistributionCheckStale}
        pendingUpdates={pendingUpdates}
        preDistributionCheckSnapshot={preDistributionCheckSnapshot}
        busyUpdateId={busyUpdateId}
        selectedUpdateIds={batchControls.selectedUpdateIds}
        batchProgress={batchControls.batchProgress}
        batchResults={batchControls.batchResults}
        onToggleSelected={batchControls.onToggleUpdateSelection}
        onSelectAll={batchControls.onSelectAllEligibleUpdates}
        onClearSelection={batchControls.onClearUpdateSelection}
        onRequestDistribution={batchControls.onRequestBatchDistributionConfirmation}
        onDistribute={onDistribute}
        onReconcileInstalled={onReconcileInstalled}
        onRefreshCheck={onRefreshPreDistributionCheck}
      />
    </section>
  )
}
