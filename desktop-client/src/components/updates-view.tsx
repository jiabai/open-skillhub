import type { PendingSyncUpdate } from "@/types"
import { Button, PageIntro } from "@/components/ui-primitives"
import { PendingUpdatesPanel } from "@/components/pending-updates-panel"

type UpdatesViewProps = {
  busyUpdateId: string | null
  isLoading: boolean
  pendingUpdates: PendingSyncUpdate[]
  onDistribute: (pendingUpdate: PendingSyncUpdate) => void
  onRefresh: () => void
}

export function UpdatesView({
  busyUpdateId,
  isLoading,
  pendingUpdates,
  onDistribute,
  onRefresh
}: UpdatesViewProps) {
  return (
    <section className="page-stack">
      <PageIntro
        eyebrow="Review queue"
        title="All pending updates"
        summary="Inspect every pending skill update before distributing it to configured local agent targets."
        actions={
          <Button variant="secondary" disabled={isLoading} onClick={onRefresh}>
            {isLoading ? "Refreshing" : "Refresh queue"}
          </Button>
        }
      />
      <PendingUpdatesPanel
        isLoading={isLoading}
        pendingUpdates={pendingUpdates}
        busyUpdateId={busyUpdateId}
        onDistribute={onDistribute}
      />
    </section>
  )
}
