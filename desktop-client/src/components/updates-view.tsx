import type { PendingSyncUpdate, PreDistributionCheckSnapshot } from "@/types"
import { Button, PageIntro } from "@/components/ui-primitives"
import { PendingUpdatesPanel } from "@/components/pending-updates-panel"
import { useI18n } from "@/i18n/use-i18n"

type UpdatesViewProps = {
  busyUpdateId: string | null
  isLoading: boolean
  isPreDistributionChecking: boolean
  isPreDistributionCheckStale: boolean
  pendingUpdates: PendingSyncUpdate[]
  preDistributionCheckSnapshot: PreDistributionCheckSnapshot | null
  onDistribute: (pendingUpdate: PendingSyncUpdate) => void
  onRefreshPreDistributionCheck: () => void
  onRefresh: () => void
}

export function UpdatesView({
  busyUpdateId,
  isLoading,
  isPreDistributionChecking,
  isPreDistributionCheckStale,
  pendingUpdates,
  preDistributionCheckSnapshot,
  onDistribute,
  onRefreshPreDistributionCheck,
  onRefresh
}: UpdatesViewProps) {
  const { dictionary } = useI18n()

  return (
    <section className="page-stack">
      <PageIntro
        eyebrow={dictionary.updatesView.eyebrow}
        title={dictionary.updatesView.title}
        summary={dictionary.updatesView.summary}
        actions={
          <Button variant="secondary" disabled={isLoading} onClick={onRefresh}>
            {isLoading ? dictionary.common.refreshing : dictionary.updatesView.refreshQueue}
          </Button>
        }
      />
      <PendingUpdatesPanel
        isLoading={isLoading}
        isPreDistributionChecking={isPreDistributionChecking}
        isPreDistributionCheckStale={isPreDistributionCheckStale}
        pendingUpdates={pendingUpdates}
        preDistributionCheckSnapshot={preDistributionCheckSnapshot}
        busyUpdateId={busyUpdateId}
        onDistribute={onDistribute}
        onRefreshPreDistributionCheck={onRefreshPreDistributionCheck}
      />
    </section>
  )
}
