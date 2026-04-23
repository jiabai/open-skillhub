import type { PendingSyncUpdate } from "@/types"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageIntro } from "@/components/ui-primitives"

type HomeViewProps = {
  bridgeAvailable: boolean
  configurationReady: boolean
  errorMessage: string | null
  isLoading: boolean
  lastRefreshedAt: string
  localRecordCount: number
  pendingUpdates: PendingSyncUpdate[]
  busyUpdateId: string | null
  onDistribute: (pendingUpdate: PendingSyncUpdate) => void
  onOpenSettings: () => void
  onRefresh: () => void
  onViewUpdates: () => void
}

function formatVersion(value: string | null): string {
  return value ?? "n/a"
}

export function HomeView({
  bridgeAvailable,
  configurationReady,
  errorMessage,
  isLoading,
  lastRefreshedAt,
  localRecordCount,
  pendingUpdates,
  busyUpdateId,
  onDistribute,
  onOpenSettings,
  onRefresh,
  onViewUpdates
}: HomeViewProps) {
  const previewUpdates = pendingUpdates.slice(0, 3)
  const pendingCount = pendingUpdates.length

  return (
    <section className="page-stack" aria-labelledby="home-heading">
      <PageIntro
        eyebrow="Desktop client"
        title="Review updates"
        summary="A quiet desktop surface for checking pending skill updates and approving distribution only when you are ready."
        actions={
          <>
            <Button variant="secondary" disabled={!configurationReady || isLoading} onClick={onRefresh}>
              {isLoading ? "Refreshing" : "Refresh state"}
            </Button>
            <Button variant="outline" onClick={onOpenSettings}>
              Settings
            </Button>
          </>
        }
      />

      {!bridgeAvailable ? (
        <div className="callout callout--error" role="alert">
          <strong>Desktop bridge unavailable</strong>
          <span>The renderer cannot reach the preload bridge in this environment.</span>
        </div>
      ) : null}

      {!configurationReady ? (
        <div className="callout callout--warning">
          <strong>API token needed</strong>
          <span>Review sync is paused until API configuration is saved.</span>
          <div>
            <Button variant="primary" onClick={onOpenSettings}>
              Configure API
            </Button>
          </div>
        </div>
      ) : null}

      {errorMessage && configurationReady ? (
        <div className="callout callout--error" role="alert">
          <strong>Refresh failed</strong>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="grid-3">
        <Card>
          <CardContent>
            <div className="metric">
              <span className="metric__label">Pending updates</span>
              <strong className="metric__value">{pendingCount}</strong>
              <span className="muted">Items waiting for review.</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="metric">
              <span className="metric__label">Local records</span>
              <strong className="metric__value">{localRecordCount}</strong>
              <span className="muted">Distributed skills tracked locally.</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="metric">
              <span className="metric__label">Last refresh</span>
              <strong style={{ fontSize: "1.1rem", lineHeight: 1.25 }}>{lastRefreshedAt}</strong>
              <span className="muted">Latest bridge snapshot.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card aria-labelledby="home-heading">
        <CardHeader>
          <CardTitle id="home-heading">Needs review</CardTitle>
          <CardDescription>
            Showing up to 3 pending updates here. The full queue lives in Updates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {previewUpdates.length === 0 ? (
            <div className="callout">
              {isLoading ? "Loading pending updates..." : "No pending updates are waiting for review."}
            </div>
          ) : (
            <div className="list-stack">
              {previewUpdates.map((pendingUpdate) => {
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
                        disabled={isBusy}
                        aria-label={`Distribute ${pendingUpdate.name}`}
                        onClick={() => onDistribute(pendingUpdate)}
                      >
                        {isBusy ? "Distributing" : "Distribute"}
                      </Button>
                    </div>
                    <div className="update-item__meta">
                      <Badge>Local {formatVersion(pendingUpdate.localVersion)}</Badge>
                      <Badge tone="accent">Remote {pendingUpdate.remoteVersion}</Badge>
                      <Badge tone="warning">{pendingUpdate.reason}</Badge>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          <div style={{ marginTop: "1rem" }}>
            <Button variant="outline" onClick={onViewUpdates}>
              View all updates
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
