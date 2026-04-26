import type { PendingSyncUpdate, PreDistributionCheckSnapshot } from "@/types"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-primitives"
import {
  PreDistributionActionWarning,
  PreDistributionCheckSummary
} from "@/components/pre-distribution-check-summary"
import { useI18n } from "@/i18n/use-i18n"

type PendingUpdatesPanelProps = {
  pendingUpdates: PendingSyncUpdate[]
  preDistributionCheckSnapshot: PreDistributionCheckSnapshot | null
  busyUpdateId: string | null
  isLoading: boolean
  isPreDistributionChecking: boolean
  isPreDistributionCheckStale: boolean
  onDistribute: (pendingUpdate: PendingSyncUpdate) => void
  onRefreshPreDistributionCheck: () => void
}

function formatVersion(value: string | null, fallback: string): string {
  return value ?? fallback
}

export function PendingUpdatesPanel({
  pendingUpdates,
  preDistributionCheckSnapshot,
  busyUpdateId,
  isLoading,
  isPreDistributionChecking,
  isPreDistributionCheckStale,
  onDistribute,
  onRefreshPreDistributionCheck
}: PendingUpdatesPanelProps) {
  const { dictionary } = useI18n()
  const hasGlobalErrors = (preDistributionCheckSnapshot?.globalErrors.length ?? 0) > 0

  return (
    <Card aria-labelledby="pending-updates-heading">
      <CardHeader>
        <div className="page-intro">
          <div className="section-heading">
            <span className="section-heading__eyebrow">{dictionary.pendingUpdatesPanel.eyebrow}</span>
            <CardTitle id="pending-updates-heading">{dictionary.pendingUpdatesPanel.title}</CardTitle>
            <CardDescription>
              {dictionary.pendingUpdatesPanel.description(pendingUpdates.length)}
            </CardDescription>
          </div>
          {pendingUpdates.length > 0 ? (
            <Button
              variant="secondary"
              disabled={isPreDistributionChecking}
              onClick={onRefreshPreDistributionCheck}
            >
              {isPreDistributionChecking
                ? dictionary.pendingUpdatesPanel.refreshingCheck
                : dictionary.pendingUpdatesPanel.refreshCheck}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {hasGlobalErrors ? (
          <div className="callout callout--warning">
            <strong>{dictionary.preDistributionCheck.globalErrorsTitle}</strong>
            {preDistributionCheckSnapshot?.globalErrors.map((message) => (
              <span key={message}>{message}</span>
            ))}
          </div>
        ) : null}

        {pendingUpdates.length === 0 ? (
          <div className="callout">
            {isLoading
              ? dictionary.pendingUpdatesPanel.loading
              : dictionary.pendingUpdatesPanel.noPendingUpdates}
          </div>
        ) : (
          <div className="list-stack">
            {pendingUpdates.map((pendingUpdate) => {
              const isBusy = busyUpdateId === pendingUpdate.remoteSkillId
              const reasonLabel =
                pendingUpdate.reason === "missing-local-record"
                  ? dictionary.pendingUpdatesPanel.reasonLabels.missingLocalRecord
                  : dictionary.pendingUpdatesPanel.reasonLabels.versionMismatch

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
                      <Button
                        variant="primary"
                        onClick={() => onDistribute(pendingUpdate)}
                        disabled={isBusy}
                        aria-label={`${dictionary.pendingUpdatesPanel.distribute} ${pendingUpdate.name}`}
                      >
                        {isBusy ? dictionary.pendingUpdatesPanel.distributing : dictionary.pendingUpdatesPanel.distribute}
                      </Button>
                    </div>
                  </div>

                  <div className="update-item__meta">
                    <Badge>
                      {dictionary.common.local(
                        formatVersion(pendingUpdate.localVersion, dictionary.common.nA)
                      )}
                    </Badge>
                    <Badge tone="accent">
                      {dictionary.common.remote(pendingUpdate.remoteVersion)}
                    </Badge>
                    <Badge tone="warning">{reasonLabel}</Badge>
                  </div>

                  <p className="card__description">
                    {dictionary.pendingUpdatesPanel.reviewReasonLabel} {reasonLabel}
                  </p>
                  <PreDistributionCheckSummary
                    pendingUpdate={pendingUpdate}
                    snapshot={preDistributionCheckSnapshot}
                    isChecking={isPreDistributionChecking}
                    isStale={isPreDistributionCheckStale}
                    variant="detailed"
                  />
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
