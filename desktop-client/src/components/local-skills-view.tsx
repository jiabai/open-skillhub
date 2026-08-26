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
    case "update-available":
      return labels.updateAvailable
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
    case "update-available":
      return "warning" as const
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
  const [pendingOpenGroup, setPendingOpenGroup] = useState<LocalSkillGroupRow | null>(null)
  const [selectedOpenRowKey, setSelectedOpenRowKey] = useState<string | null>(null)

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

  const handleCloseOpenPathDialog = () => {
    setPendingOpenGroup(null)
    setSelectedOpenRowKey(null)
  }

  const handleConfirmOpenPath = () => {
    if (!pendingOpenGroup || !selectedOpenRowKey) return
    const selectedRow = pendingOpenGroup.items.find((item) => item.rowKey === selectedOpenRowKey)
    if (!selectedRow) return

    onOpenFolder(selectedRow)
    handleCloseOpenPathDialog()
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
                  if (group.pathCount <= 1) {
                    onOpenFolder(group.primary)
                    return
                  }

                  setPendingOpenGroup(group)
                  setSelectedOpenRowKey(group.items[0]?.rowKey ?? null)
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
                        <div style={{ marginTop: "0.25rem" }}>
                          <span className="muted mono" style={{ fontSize: "0.75rem" }}>
                            {copy.localPath(group.items.map((item) => item.packageRootPath).join(", "))}
                          </span>
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
          size="narrow"
          onClose={handleCancelDelete}
          title={copy.deleteConfirmTitle}
          description={copy.deleteConfirmDescription(pendingDeleteGroup.name, pendingDeleteGroup.pathCount)}
          closeLabel={dictionary.common.close}
          footer={
            <div className="dialog-actions">
              <Button variant="outline" onClick={handleCancelDelete}>
                {dictionary.common.cancel}
              </Button>
              <Button
                variant="destructive"
                disabled={confirmText !== pendingDeleteGroup.name}
                onClick={handleConfirmDelete}
              >
                {copy.deleteConfirmButton}
              </Button>
            </div>
          }
        >
          <div className="callout callout--warning" role="alert">
            <span>{copy.deleteConfirmWarning}</span>
            <ul className="dialog-path-list">
              {pendingDeleteGroup.items.map((item) => (
                <li key={item.rowKey}>
                  <code>{item.packageRootPath}</code>
                  <span className="dialog-path-list__agents">
                    {copy.deleteConfirmPathAgent(item.sourceDisplayNames.join(", "))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <label className="form-field" htmlFor="delete-confirm-input">
            <span className="form-label">{copy.deleteConfirmDestructiveHint}</span>
            <Input
              id="delete-confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={copy.deleteConfirmDestructivePlaceholder}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </label>
        </Dialog>
      ) : null}

      {pendingOpenGroup ? (
        <Dialog
          open={true}
          size="narrow"
          onClose={handleCloseOpenPathDialog}
          title={copy.openPathDialogTitle}
          description={copy.openPathDialogDescription(pendingOpenGroup.name, pendingOpenGroup.pathCount)}
          closeLabel={dictionary.common.close}
          footer={
            <div className="dialog-actions">
              <Button variant="outline" onClick={handleCloseOpenPathDialog}>
                {dictionary.common.cancel}
              </Button>
              <Button disabled={!selectedOpenRowKey} onClick={handleConfirmOpenPath}>
                {copy.openPathDialogConfirm}
              </Button>
            </div>
          }
        >
          <div className="dialog-path-picker" role="radiogroup" aria-label={copy.openPathDialogTitle}>
            {pendingOpenGroup.items.map((item, index) => (
              <label className="dialog-path-option" key={item.rowKey}>
                <input
                  type="radio"
                  name={`open-local-skill-${pendingOpenGroup.groupKey}`}
                  value={item.rowKey}
                  checked={selectedOpenRowKey === item.rowKey}
                  onChange={() => setSelectedOpenRowKey(item.rowKey)}
                  autoFocus={index === 0}
                />
                <span className="dialog-path-option__content">
                  <span className="dialog-path-option__path">{copy.openPathDialogPathLabel(item.packageRootPath)}</span>
                  {item.sourceDisplayNames.length > 0 ? (
                    <span className="dialog-path-option__agents">
                      {copy.openPathDialogPathAgents(item.sourceDisplayNames.join(", "))}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </Dialog>
      ) : null}
    </section>
  )
}
