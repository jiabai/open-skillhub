import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageIntro } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"
import type { LocalSkillInventoryRow, LocalSkillsInventorySnapshot } from "@/types"

type LocalSkillsViewProps = {
  snapshot: LocalSkillsInventorySnapshot | null
  bridgeAvailable: boolean
  configurationReady: boolean
  isRefreshing: boolean
  uploadingRowKey: string | null
  onRefresh: () => void
  onUpload: (row: LocalSkillInventoryRow) => void
}

function displayName(row: LocalSkillInventoryRow): string {
  return row.name ?? row.packageRootPath.split(/[\\/]/).filter(Boolean).at(-1) ?? row.packageRootPath
}

function serverStateLabel(row: LocalSkillInventoryRow, labels: ReturnType<typeof useI18n>["dictionary"]["localSkillsView"]["serverStateLabels"]): string {
  switch (row.serverState) {
    case "existing":
      return labels.existing
    case "missing":
      return labels.missing
    case "unknown":
      return labels.unknown
    case "invalid-local":
      return labels.invalidLocal
  }
}

function badgeTone(row: LocalSkillInventoryRow) {
  switch (row.serverState) {
    case "existing":
      return "success" as const
    case "missing":
      return "warning" as const
    case "invalid-local":
      return "destructive" as const
    case "unknown":
      return "neutral" as const
  }
}

export function LocalSkillsView({
  snapshot,
  bridgeAvailable,
  configurationReady,
  isRefreshing,
  uploadingRowKey,
  onRefresh,
  onUpload
}: LocalSkillsViewProps) {
  const { dictionary } = useI18n()
  const copy = dictionary.localSkillsView

  return (
    <section className="page-stack" aria-labelledby="local-skills-heading">
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title}
        summary={copy.summary}
        actions={
          <Button
            variant="secondary"
            disabled={!bridgeAvailable || !configurationReady || isRefreshing}
            onClick={onRefresh}
          >
            {isRefreshing ? copy.refreshing : copy.refresh}
          </Button>
        }
      />

      {!bridgeAvailable ? (
        <div className="callout callout--error" role="alert">
          {dictionary.appShell.bridgeStatus.unavailable}
        </div>
      ) : null}

      {bridgeAvailable && !configurationReady ? (
        <div className="callout callout--warning">{dictionary.homeView.tokenNeededDetail}</div>
      ) : null}

      {snapshot?.serverLookupStatus && snapshot.serverLookupStatus !== "ok" ? (
        <div className="callout callout--warning">
          {copy.serverLookupWarning(snapshot.serverLookupMessage ?? snapshot.serverLookupStatus)}
        </div>
      ) : null}

      <Card aria-labelledby="local-skills-heading">
        <CardHeader>
          <CardTitle id="local-skills-list-heading">{copy.inventoryTitle}</CardTitle>
          <CardDescription>
            {snapshot ? `${snapshot.rows.length} local skill${snapshot.rows.length === 1 ? "" : "s"}` : copy.noSnapshot}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRefreshing && !snapshot ? <div className="callout">{copy.loading}</div> : null}
          {!isRefreshing && !snapshot ? <div className="callout">{copy.noSnapshot}</div> : null}
          {snapshot && snapshot.rows.length === 0 ? <div className="callout">{copy.empty}</div> : null}

          {snapshot && snapshot.rows.length > 0 ? (
            <div className="stack-list">
              {snapshot.rows.map((row) => {
                const name = displayName(row)
                const isUploading = uploadingRowKey === row.rowKey

                return (
                  <article className="update-item" key={row.rowKey}>
                    <div className="update-item__header">
                      <div>
                        <h3>{name}</h3>
                        <span className="muted mono">{copy.localPath(row.packageRootPath)}</span>
                      </div>
                      <div className="update-item__actions">
                        <Badge tone={badgeTone(row)}>
                          {serverStateLabel(row, copy.serverStateLabels)}
                        </Badge>
                        {row.uploadable ? (
                          <Button size="sm" disabled={isUploading} onClick={() => onUpload(row)}>
                            {isUploading ? copy.uploading : copy.upload(name)}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="update-item__meta">
                      <span>{copy.sourceAgents(row.sourceDisplayNames.join(", "))}</span>
                      <span>{copy.localVersion(row.localVersion ?? dictionary.common.nA)}</span>
                      {row.remoteVersion ? <span>{copy.remoteVersion(row.remoteVersion)}</span> : null}
                      {row.remoteSkillId ? <span className="mono">{copy.remoteId(row.remoteSkillId)}</span> : null}
                      {row.validationMessage ? <span>{copy.validationReason(row.validationMessage)}</span> : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
