import { useMemo, useState, type KeyboardEvent } from "react"
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
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)

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

  const selectedGroup = useMemo(
    () => groupedRows.find((group) => group.groupKey === selectedGroupKey) ?? null,
    [groupedRows, selectedGroupKey]
  )

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

  const handleGroupUpload = (group: LocalSkillGroupRow) => {
    if (group.primary.uploadable) {
      onUpload(group.primary)
    }
  }

  const handleGroupDelete = (group: LocalSkillGroupRow) => {
    setPendingDeleteGroup(group)
    setConfirmText("")
  }

  const handleGroupOpen = (group: LocalSkillGroupRow) => {
    if (group.pathCount <= 1) {
      onOpenFolder(group.primary)
      return
    }

    setPendingOpenGroup(group)
    setSelectedOpenRowKey(group.items[0]?.rowKey ?? null)
  }

  const handleInspectKeyDown = (group: LocalSkillGroupRow, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setSelectedGroupKey(group.groupKey)
    }
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

      <div className="local-skills-layout">
        <Card aria-labelledby="local-skills-list-heading">
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
                  const isSelected = selectedGroupKey === group.groupKey
                  const isBusy = isGroupBusy(group, uploadingRowKey, deletingRowKey)
                  const isUploading = uploadingRowKey !== null && group.items.some((r) => r.rowKey === uploadingRowKey)
                  const isDeleting = deletingRowKey !== null && group.items.some((r) => r.rowKey === deletingRowKey)

                  return (
                    <article
                      className={`update-item local-skill-item${isSelected ? " local-skill-item--selected" : ""}`}
                      key={group.groupKey}
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <div className="update-item__header">
                        <div className="local-skill-item__content">
                          <h3>{name}</h3>
                        </div>
                        <div className="update-item__actions">
                          <Badge tone={badgeToneForGroup(group)}>
                            {serverStateLabel(group.primary, copy.serverStateLabels)}
                          </Badge>
                          {group.pathCount > 1 ? (
                            <Badge tone="neutral">{copy.pathCount(group.pathCount)}</Badge>
                          ) : null}
                          <span className="local-skill-item__actions">
                            <Button
                              size="sm"
                              variant={isSelected ? "primary" : "outline"}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedGroupKey(group.groupKey)}
                              onKeyDown={(event) => handleInspectKeyDown(group, event)}
                            >
                              {copy.inspect(name)}
                            </Button>
                            <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => handleGroupOpen(group)}>
                              {copy.openFolder}
                            </Button>
                            {group.uploadable ? (
                              <Button size="sm" disabled={isBusy} onClick={() => handleGroupUpload(group)}>
                                {isUploading ? copy.uploading : copy.upload}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isBusy || pendingDeleteGroup !== null}
                              onClick={() => handleGroupDelete(group)}
                            >
                              {isDeleting ? copy.deleting : copy.delete}
                            </Button>
                          </span>
                        </div>
                      </div>
                      <p className="local-skill-item__description muted">
                        {group.primary.description ?? copy.noDescription}
                      </p>
                    </article>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {selectedGroup ? (
          <Card
            as="aside"
            className="local-skills-detail"
            aria-label={copy.detailLabel(selectedGroup.name)}
          >
            <CardHeader>
              <div className="local-skills-detail__title">
                <CardTitle>{selectedGroup.name}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={copy.closeDetail}
                  onClick={() => setSelectedGroupKey(null)}
                >
                  {dictionary.common.close}
                </Button>
              </div>
              <CardDescription>
                {copy.paths}: {copy.pathCount(selectedGroup.pathCount)}
              </CardDescription>
            </CardHeader>
            <CardContent className="local-skills-detail__content">
              <dl className="local-skills-detail__facts">
                <div>
                  <dt>{copy.descriptionLabel}</dt>
                  <dd>{selectedGroup.primary.description ?? copy.noDescription}</dd>
                </div>
                <div>
                  <dt>{copy.localVersionLabel}</dt>
                  <dd>{copy.localVersion(versionLabel(selectedGroup, dictionary.common.nA))}</dd>
                </div>
                <div>
                  <dt>{copy.remoteVersionLabel}</dt>
                  <dd>{copy.remoteVersion(selectedGroup.primary.remoteVersion ?? dictionary.common.nA)}</dd>
                </div>
                <div>
                  <dt>{copy.serverStateLabel}</dt>
                  <dd>
                    <Badge tone={badgeToneForGroup(selectedGroup)}>
                      {serverStateLabel(selectedGroup.primary, copy.serverStateLabels)}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt>{copy.validationState(selectedGroup.primary.validationState)}</dt>
                  <dd>
                    {selectedGroup.primary.validationMessage
                      ? copy.validationReason(selectedGroup.primary.validationMessage)
                      : dictionary.common.nA}
                  </dd>
                </div>
              </dl>

              <div className="local-skills-detail__section">
                <h3>{copy.paths}</h3>
                <ul className="local-skills-detail__path-list">
                  {selectedGroup.items.map((item) => (
                    <li key={item.rowKey}>
                      <code>{item.packageRootPath}</code>
                      <span>{copy.usedBy(item.sourceDisplayNames.join(", ") || dictionary.common.nA)}</span>
                      <span>{copy.localVersion(item.localVersion ?? dictionary.common.nA)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedGroup.hasVersionConflict ? (
                <div className="callout callout--warning" role="alert">
                  {copy.versionConflict}
                </div>
              ) : null}

              <div className="local-skills-detail__actions">
                <Button
                  variant="secondary"
                  disabled={isGroupBusy(selectedGroup, uploadingRowKey, deletingRowKey)}
                  onClick={() => handleGroupOpen(selectedGroup)}
                >
                  {copy.openFolder}
                </Button>
                {selectedGroup.uploadable ? (
                  <Button
                    disabled={isGroupBusy(selectedGroup, uploadingRowKey, deletingRowKey)}
                    onClick={() => handleGroupUpload(selectedGroup)}
                  >
                    {uploadingRowKey !== null && selectedGroup.items.some((item) => item.rowKey === uploadingRowKey)
                      ? copy.uploading
                      : copy.upload}
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  disabled={isGroupBusy(selectedGroup, uploadingRowKey, deletingRowKey) || pendingDeleteGroup !== null}
                  onClick={() => handleGroupDelete(selectedGroup)}
                >
                  {deletingRowKey !== null && selectedGroup.items.some((item) => item.rowKey === deletingRowKey)
                    ? copy.deleting
                    : copy.delete}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

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
