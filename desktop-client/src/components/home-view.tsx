import type { PendingSyncUpdate, PreDistributionCheckSnapshot } from "@/types"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageIntro } from "@/components/ui-primitives"
import {
  PreDistributionActionWarning,
  PreDistributionCheckSummary,
  areAllPreDistributionTargetsInstalled
} from "@/components/pre-distribution-check-summary"
import { useI18n } from "@/i18n/use-i18n"

type HomeViewProps = {
  bridgeAvailable: boolean
  configurationReady: boolean
  errorMessage: string | null
  isLoading: boolean
  lastRefreshedAt: string
  successfulDistributionCount: number
  installedAgentCount: number
  pendingUpdates: PendingSyncUpdate[]
  preDistributionCheckSnapshot: PreDistributionCheckSnapshot | null
  isPreDistributionChecking: boolean
  isPreDistributionCheckStale: boolean
  busyUpdateId: string | null
  onDistribute: (pendingUpdate: PendingSyncUpdate) => void
  onReconcileInstalled: (pendingUpdate: PendingSyncUpdate) => void
  onOpenSettings: () => void
  onRefresh: () => void
  onViewUpdates: () => void
}

function formatVersion(value: string | null, fallback: string): string {
  return value ?? fallback
}

export function HomeView({
  bridgeAvailable,
  configurationReady,
  errorMessage,
  isLoading,
  lastRefreshedAt,
  successfulDistributionCount,
  installedAgentCount,
  pendingUpdates,
  preDistributionCheckSnapshot,
  isPreDistributionChecking,
  isPreDistributionCheckStale,
  busyUpdateId,
  onDistribute,
  onReconcileInstalled,
  onOpenSettings,
  onRefresh,
  onViewUpdates
}: HomeViewProps) {
  const { dictionary } = useI18n()
  const previewUpdates = pendingUpdates.slice(0, 3)
  const pendingCount = pendingUpdates.length

  return (
    <section className="page-stack" aria-labelledby="home-heading">
      <PageIntro
        eyebrow={dictionary.homeView.eyebrow}
        title={dictionary.homeView.title}
        summary={dictionary.homeView.summary}
        actions={
          <>
            <Button variant="secondary" disabled={!configurationReady || isLoading} onClick={onRefresh}>
              {isLoading ? dictionary.common.refreshing : dictionary.homeView.refreshState}
            </Button>
            <Button variant="outline" onClick={onOpenSettings}>
              {dictionary.homeView.settings}
            </Button>
          </>
        }
      />

      {!bridgeAvailable ? (
        <div className="callout callout--error" role="alert">
          <strong>{dictionary.homeView.bridgeUnavailableTitle}</strong>
          <span>{dictionary.homeView.bridgeUnavailableDetail}</span>
        </div>
      ) : null}

      {!configurationReady ? (
        <div className="callout callout--warning">
          <strong>{dictionary.homeView.tokenNeededTitle}</strong>
          <span>{dictionary.homeView.tokenNeededDetail}</span>
          <div>
            <Button variant="primary" onClick={onOpenSettings}>
              {dictionary.common.configureApi}
            </Button>
          </div>
        </div>
      ) : null}

      {errorMessage && configurationReady ? (
        <div className="callout callout--error" role="alert">
          <strong>{dictionary.homeView.refreshFailedTitle}</strong>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="home-layout">
        <div className="home-layout__primary">
          <div className="grid-3">
            <Card>
              <CardContent>
                <div className="metric">
                  <span className="metric__label">{dictionary.homeView.metrics.pendingUpdates.label}</span>
                  <strong className="metric__value">{pendingCount}</strong>
                  <span className="muted">{dictionary.homeView.metrics.pendingUpdates.detail}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="metric">
                  <span className="metric__label">{dictionary.homeView.metrics.successfulDistributions.label}</span>
                  <strong className="metric__value">{successfulDistributionCount}</strong>
                  <span className="muted">{dictionary.homeView.metrics.successfulDistributions.detail}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="metric">
                  <span className="metric__label">{dictionary.homeView.metrics.installedAgents.label}</span>
                  <strong className="metric__value">{installedAgentCount}</strong>
                  <span className="muted">{dictionary.homeView.metrics.installedAgents.detail}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="metric">
                  <span className="metric__label">{dictionary.homeView.metrics.lastRefresh.label}</span>
                  <strong style={{ fontSize: "1.1rem", lineHeight: 1.25 }}>{lastRefreshedAt}</strong>
                  <span className="muted">{dictionary.homeView.metrics.lastRefresh.detail}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="home-layout__secondary">
          <Card aria-labelledby="home-heading">
            <CardHeader>
              <CardTitle id="home-heading">{dictionary.homeView.needsReviewTitle}</CardTitle>
              <CardDescription>{dictionary.homeView.needsReviewDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {previewUpdates.length === 0 ? (
                <div className="callout">
                  {isLoading
                    ? dictionary.homeView.loadingPendingUpdates
                    : dictionary.homeView.noPendingUpdates}
                </div>
              ) : (
                <div className="list-stack">
                  {previewUpdates.map((pendingUpdate) => {
                    const isBusy = busyUpdateId === pendingUpdate.remoteSkillId
                    const canSyncLocalRecord = areAllPreDistributionTargetsInstalled(
                      pendingUpdate,
                      preDistributionCheckSnapshot,
                      isPreDistributionCheckStale
                    )
                    const reasonLabel =
                      pendingUpdate.reason === "not-installed"
                        ? dictionary.homeView.reasonLabels.missingLocalRecord
                        : dictionary.homeView.reasonLabels.versionMismatch

                    return (
                      <article className="update-item" key={pendingUpdate.remoteSkillId}>
                        <div className="update-item__header">
                          <div className="section-heading">
                            <h3 className="section-heading__title">{pendingUpdate.name}</h3>
                            <span className="muted mono">{pendingUpdate.remoteSkillId}</span>
                          </div>
                          <div className="update-item__actions">
                            <PreDistributionActionWarning
                              pendingUpdate={pendingUpdate}
                              snapshot={preDistributionCheckSnapshot}
                              isStale={isPreDistributionCheckStale}
                            />
                            {canSyncLocalRecord ? (
                              <Button
                                variant="secondary"
                                disabled={isBusy}
                                aria-label={dictionary.homeView.syncLocalRecord(pendingUpdate.name)}
                                onClick={() => onReconcileInstalled(pendingUpdate)}
                              >
                                {isBusy ? dictionary.common.syncingRecord : dictionary.common.syncRecord}
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                disabled={isBusy}
                                aria-label={dictionary.homeView.distribute(pendingUpdate.name)}
                                onClick={() => onDistribute(pendingUpdate)}
                              >
                                {isBusy ? dictionary.homeView.distributing : dictionary.common.distribute}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="update-item__meta">
                          <Badge>
                            {dictionary.homeView.badges.local(
                              formatVersion(pendingUpdate.localVersion, dictionary.common.nA)
                            )}
                          </Badge>
                          <Badge tone="accent">
                            {dictionary.homeView.badges.remote(pendingUpdate.remoteVersion)}
                          </Badge>
                          <Badge tone="warning">{reasonLabel}</Badge>
                        </div>
                        <PreDistributionCheckSummary
                          pendingUpdate={pendingUpdate}
                          snapshot={preDistributionCheckSnapshot}
                          isChecking={isPreDistributionChecking}
                          isStale={isPreDistributionCheckStale}
                          variant="compact"
                        />
                      </article>
                    )
                  })}
                </div>
              )}

              <div style={{ marginTop: "1rem" }}>
                <Button variant="outline" onClick={onViewUpdates}>
                  {dictionary.homeView.viewAllUpdates}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
