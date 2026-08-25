import { useMemo, useState } from "react"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, Input, PageIntro } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"
import type { LocalSkillGroupRow, LocalSkillInventoryRow, LocalSkillsInventorySnapshot } from "@/types"

type LocalSkillsViewProps = {
  snapshot: LocalSkillsInventorySnapshot | null
  bridgeAvailable: boolean
  configurationReady: boolean
  isRefreshing: boolean
  uploadingRowKey: string | null
  deletingRowKey: string | null
  onRefresh: () => void
  onUpload: (row: LocalSkillInventoryRow) => void
  onDelete: (row: LocalSkillInventoryRow, groupRowKeys?: string[]) => void
  onOpenFolder: (row: LocalSkillInventoryRow) => void
}

function displayName(row: LocalSkillInventoryRow): string {
  return row.name ?? row.packageRootPath.split(/[\\/]/).filter(Boolean).at(-1) ?? row.packageRootPath
}

function groupDisplayName(group: LocalSkillGroupRow): string {
  return group.name
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

function badgeToneForGroup(group: LocalSkillGroupRow) {
  if (group.hasVersionConflict) return "warning" as const
  return badgeTone(group.primary)
}

function isGroupBusy(group: LocalSkillGroupRow, uploadingRowKey: string | null, deletingRowKey: string | null): boolean {
  if (uploadingRowKey && group.items.some((r) => r.rowKey === uploadingRowKey)) return true
  if (deletingRowKey && group.items.some((r) => r.rowKey === deletingRowKey)) return true
  return false
}

function versionLabel(group: LocalSkillGroupRow, nA: string): string {
  if (group.hasVersionConflict) return `${group.items.map((r) => r.localVersion ?? nA).join(", ")}`
  return group.primary.localVersion ?? nA
}

export function LocalSkillsView({
  snapshot,
  bridgeAvailable,
  configurationReady,
  isRefreshing,
  uploadingRowKey,
  deletingRowKey,
  onRefresh,
  onUpload,
  onDelete,
  onOpenFolder
}: LocalSkillsViewProps) {
  const { dictionary } = useI18n()
  const copy = dictionary.localSkillsView

  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<LocalSkillGroupRow | null>(null)
  const [confirmText, setConfirmText] = useState<string>("")

  const groupedRows = useMemo(() => {
    if (!snapshot) return []
    if (snapshot.groupedRows && snapshot.groupedRows.length > 0) {
      return snapshot.groupedRows
    }
    return snapshot.rows.map((row) => ({
      groupKey: row.rowKey,
      name: displayName(row),
      items: [row],
      primary: row,
      sourceDisplayNames: [...row.sourceDisplayNames],
      pathCount: 1,
      uploadable: row.uploadable,
      hasVersionConflict: false
    }))
  }, [snapshot])

  const handleConfirmDelete = () => {
    if (!pendingDeleteGroup) return
    onDelete(pendingDeleteGroup.primary, pendingDeleteGroup.items.map((r) => r.rowKey))
    setPendingDeleteGroup(null)
    setConfirmText("")
  }

  const handleCancelDelete = () => {
    setPendingDeleteGroup(null)
    setConfirmText("")
  }

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
          <CardTitle id="local-skills-list-heading">{dictionary.updatesView.inventoryTitle}</CardTitle>
          <CardDescription>
            {snapshot ? `${groupedRows.length} local skill${groupedRows.length === 1 ? "" : "s"}` : copy.noSnapshot}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRefreshing && !snapshot ? <div className="callout">{copy.loading}</div> : null}
          {!isRefreshing && !snapshot ? <div className="callout">{copy.noSnapshot}</div> : null}
          {snapshot && groupedRows.length === 0 ? <div className="callout">{copy.empty}</div> : null}

          {snapshot && groupedRows.length > 0 ? (
            <div className="stack-list">
              {groupedRows.map((group) => {
                const name = groupDisplayName(group)
                const isBusy = isGroupBusy(group, uploadingRowKey, deletingRowKey)
                const isUploading = uploadingRowKey !== null && group.items.some((r) => r.rowKey === uploadingRowKey)
                const isDeleting = deletingRowKey !== null && group.items.some((r) => r.rowKey === deletingRowKey)

                const handleGroupUpload = () => {
                  const primary = group.primary
                  if (primary.uploadable) {
                    onUpload(primary)
                  }
                }

                const handleGroupDelete = () => {
                  setPendingDeleteGroup(group)
                  setConfirmText("")
                }

                const handleGroupOpen = () => {
                  onOpenFolder(group.primary)
                }

                return (
                  <article
                    className="update-item"
                    key={group.groupKey}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                    onClick={handleGroupOpen}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleGroupOpen()
                      }
                    }}
                  >
                    <div className="update-item__header">
                      <div>
                        <h3>{name}</h3>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.25rem" }}>
                          {group.items.map((item) => (
                            <span key={item.rowKey} className="muted mono" style={{
                              fontSize: "0.75rem",
                              padding: "0.1rem 0.4rem",
                              borderRadius: "0.25rem",
                              background: "var(--muted)",
                              opacity: 0.7
                            }}>
                              {item.packageRootPath.split(/[\\/]/).filter(Boolean).slice(-2).join("/")}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="update-item__actions">
                        <Badge tone={badgeToneForGroup(group)}>
                          {serverStateLabel(group.primary, copy.serverStateLabels)}
                        </Badge>
                        {group.pathCount > 1 ? (
                          <Badge tone="neutral">{copy.pathCount(group.pathCount)}</Badge>
                        ) : null}
                        <span style={{ display: "flex", gap: "0.45rem" }}>
                          {group.uploadable ? (
                            <Button size="sm" disabled={isBusy} onClick={(e) => { e.stopPropagation(); handleGroupUpload() }}>
                              {isUploading ? copy.uploading : copy.upload}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isBusy || pendingDeleteGroup !== null}
                            onClick={(e) => { e.stopPropagation(); handleGroupDelete() }}
                          >
                            {isDeleting ? copy.deleting : copy.delete}
                          </Button>
                        </span>
                      </div>
                    </div>
                    <div className="update-item__meta">
                      <span>{copy.sourceAgents(group.sourceDisplayNames.join(", "))}</span>
                      <span>{copy.localVersion(versionLabel(group, dictionary.common.nA))}</span>
                      {group.primary.remoteVersion ? <span>{copy.remoteVersion(group.primary.remoteVersion)}</span> : null}
                      {group.primary.remoteSkillId ? <span className="mono">{copy.remoteId(group.primary.remoteSkillId)}</span> : null}
                      {group.hasVersionConflict ? (
                        <span style={{ color: "var(--warning)" }}>{copy.versionConflict ?? "Version mismatch across paths"}</span>
                      ) : null}
                      {group.items.find((r) => r.validationMessage)?.validationMessage ? (
                        <span>{copy.validationReason(group.items.find((r) => r.validationMessage)!.validationMessage!)}</span>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {pendingDeleteGroup ? (
        <Dialog
          open={true}
          onClose={handleCancelDelete}
          title={copy.deleteConfirmTitle}
          description={copy.deleteConfirmDescription(pendingDeleteGroup.name, pendingDeleteGroup.pathCount)}
          footer={
            <>
              <Button variant="secondary" onClick={handleCancelDelete}>
                {dictionary.common.cancel}
              </Button>
              <Button
                variant="destructive"
                disabled={confirmText !== pendingDeleteGroup.name}
                onClick={handleConfirmDelete}
              >
                {copy.deleteConfirmButton}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="callout callout--warning" role="alert">
              {copy.deleteConfirmWarning}
            </div>
            <div>
              <strong>{copy.deleteConfirmPathsTitle}</strong>
              <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.2rem" }}>
                {pendingDeleteGroup.items.map((item) => (
                  <li key={item.rowKey}>
                    <code style={{ fontSize: "0.85rem" }}>{item.packageRootPath}</code>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {copy.deleteConfirmPathAgent(item.sourceDisplayNames.join(", "))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <label htmlFor="delete-confirm-input" style={{ display: "block", marginBottom: "0.25rem" }}>
                {copy.deleteConfirmDestructiveHint}
              </label>
              <Input
                id="delete-confirm-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={copy.deleteConfirmDestructivePlaceholder}
                autoFocus
              />
            </div>
          </div>
        </Dialog>
      ) : null}
    </section>
  )
}
