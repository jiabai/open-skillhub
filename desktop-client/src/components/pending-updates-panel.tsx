import type { PendingSyncUpdate } from "@/types"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-primitives"

type PendingUpdatesPanelProps = {
  pendingUpdates: PendingSyncUpdate[]
  busyUpdateId: string | null
  isLoading: boolean
  onDistribute: (pendingUpdate: PendingSyncUpdate) => void
}

function formatVersion(value: string | null): string {
  return value ?? "n/a"
}

export function PendingUpdatesPanel({
  pendingUpdates,
  busyUpdateId,
  isLoading,
  onDistribute
}: PendingUpdatesPanelProps) {
  return (
    <Card aria-labelledby="pending-updates-heading">
      <CardHeader>
        <div className="page-intro">
          <div className="section-heading">
            <span className="section-heading__eyebrow">Review queue</span>
            <CardTitle id="pending-updates-heading">Pending updates</CardTitle>
            <CardDescription>
              {pendingUpdates.length} item{pendingUpdates.length === 1 ? "" : "s"} awaiting approval.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {pendingUpdates.length === 0 ? (
          <div className="callout">
            {isLoading ? "Loading pending updates..." : "No pending updates are waiting for review."}
          </div>
        ) : (
          <div className="list-stack">
            {pendingUpdates.map((pendingUpdate) => {
              const isBusy = busyUpdateId === pendingUpdate.remoteSkillId

              return (
                <article className="update-item" key={pendingUpdate.remoteSkillId}>
                  <div className="update-item__header">
                    <div className="section-heading">
                      <h3 className="section-heading__title">{pendingUpdate.name}</h3>
                      <span className="muted mono">{pendingUpdate.remoteSkillId}</span>
                    </div>

                    <Button
                      variant="primary"
                      onClick={() => onDistribute(pendingUpdate)}
                      disabled={isBusy}
                      aria-label={`Distribute ${pendingUpdate.name}`}
                    >
                      {isBusy ? "Distributing" : "Distribute"}
                    </Button>
                  </div>

                  <div className="update-item__meta">
                    <Badge>Local {formatVersion(pendingUpdate.localVersion)}</Badge>
                    <Badge tone="accent">Remote {pendingUpdate.remoteVersion}</Badge>
                    <Badge tone="warning">{pendingUpdate.reason}</Badge>
                  </div>

                  <p className="card__description">Review reason: {pendingUpdate.reason}</p>
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
