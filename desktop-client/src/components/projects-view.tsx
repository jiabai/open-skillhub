import { useEffect, useMemo, useState } from "react"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  PageIntro
} from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"
import type {
  AgentId,
  DirectorySelectionResult,
  ProjectAddPayload,
  ProjectEntry,
  ProjectListSnapshot,
  ProjectRenamePayload,
  ProjectSkillFolderValidation,
  ProjectImportSkillPayload,
  ProjectSkillRow,
  ProjectSkillScanSnapshot
} from "@/types"

type ProjectsViewProps = {
  snapshot: ProjectListSnapshot | null
  scanSnapshot: ProjectSkillScanSnapshot | null
  selectedProjectId: string | null
  bridgeAvailable: boolean
  isLoading: boolean
  isScanning: boolean
  busy: boolean
  validation: ProjectSkillFolderValidation | null
  errorMessage: string | null
  onAddProject: (payload: ProjectAddPayload) => Promise<void>
  onRenameProject: (payload: ProjectRenamePayload) => Promise<void>
  onRemoveProject: (projectId: string) => Promise<void>
  onSelectProject: (project: ProjectEntry) => Promise<void>
  onBackToList: () => void
  onOpenProjectFolder: (projectId: string) => Promise<void>
  onRefreshProjectSkills: (projectId: string) => Promise<ProjectSkillScanSnapshot | null>
  onSelectProjectFolder: () => Promise<DirectorySelectionResult>
  onSelectProjectSkillFolder: () => Promise<DirectorySelectionResult>
  onValidateSkillFolder: (sourcePath: string) => Promise<void>
  onImportSkill: (payload: ProjectImportSkillPayload) => Promise<void>
}

type DialogProject = ProjectEntry | null

function folderName(pathValue: string): string {
  return pathValue.split(/[\\/]/).filter(Boolean).at(-1) ?? pathValue
}

function validationTone(row: ProjectSkillRow) {
  if (row.validationState === "valid") {
    return "success" as const
  }

  return row.validationState === "invalid-skill-name" ? "destructive" as const : "warning" as const
}

export function ProjectsView({
  snapshot,
  scanSnapshot,
  selectedProjectId,
  bridgeAvailable,
  isLoading,
  isScanning,
  busy,
  validation,
  errorMessage,
  onAddProject,
  onRenameProject,
  onRemoveProject,
  onSelectProject,
  onBackToList,
  onOpenProjectFolder,
  onRefreshProjectSkills,
  onSelectProjectFolder,
  onSelectProjectSkillFolder,
  onValidateSkillFolder,
  onImportSkill
}: ProjectsViewProps) {
  const { dictionary } = useI18n()
  const copy = dictionary.projectsView
  const selectedProject =
    snapshot?.projects.find((project) => project.id === selectedProjectId) ?? null
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addPath, setAddPath] = useState("")
  const [renameProject, setRenameProject] = useState<DialogProject>(null)
  const [renameName, setRenameName] = useState("")
  const [removeProject, setRemoveProject] = useState<DialogProject>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [sourcePath, setSourcePath] = useState("")
  const [targetAgentId, setTargetAgentId] = useState<AgentId | "">("")
  const [overwrite, setOverwrite] = useState(false)

  const writableTargetOptions = useMemo(() => {
    const targets = scanSnapshot?.targets ?? []

    return targets.flatMap((target) =>
      target.writableAgentIds.map((agentId) => ({
        agentId,
        label: `${target.displayNames[target.coveredAgentIds.indexOf(agentId)] ?? agentId} (${target.relativePath})`
      }))
    )
  }, [scanSnapshot?.targets])

  useEffect(() => {
    if (writableTargetOptions.length > 0 && !targetAgentId) {
      setTargetAgentId(writableTargetOptions[0].agentId)
    }
  }, [targetAgentId, writableTargetOptions])

  const resetAddDialog = () => {
    setAddName("")
    setAddPath("")
    setAddOpen(false)
  }

  const resetImportDialog = () => {
    setImportOpen(false)
    setSourcePath("")
    setTargetAgentId("")
    setOverwrite(false)
  }

  const handleBrowseProject = async () => {
    const result = await onSelectProjectFolder()

    if (!result.canceled && result.path) {
      setAddPath(result.path)
      if (!addName.trim()) {
        setAddName(folderName(result.path))
      }
    }
  }

  const handleBrowseSkill = async () => {
    const result = await onSelectProjectSkillFolder()

    if (!result.canceled && result.path) {
      setSourcePath(result.path)
      await onValidateSkillFolder(result.path)
    }
  }

  const handleAddProject = async () => {
    try {
      await onAddProject({
        name: addName,
        path: addPath
      })
      resetAddDialog()
    } catch {
      // The parent owns the visible error state.
    }
  }

  const handleRenameProject = async () => {
    if (!renameProject) {
      return
    }

    try {
      await onRenameProject({
        projectId: renameProject.id,
        name: renameName
      })
      setRenameProject(null)
    } catch {
      // The parent owns the visible error state.
    }
  }

  const handleRemoveProject = async () => {
    if (!removeProject) {
      return
    }

    try {
      await onRemoveProject(removeProject.id)
      setRemoveProject(null)
    } catch {
      // The parent owns the visible error state.
    }
  }

  const handleImport = async () => {
    if (!selectedProject || !targetAgentId) {
      return
    }

    try {
      await onImportSkill({
        projectId: selectedProject.id,
        sourcePath,
        targetAgentId,
        overwrite
      })
      resetImportDialog()
    } catch {
      // The parent owns the visible error state.
    }
  }

  const renderSkillRow = (row: ProjectSkillRow) => {
    const label = row.identity ?? folderName(row.skillPath)

    return (
      <article className="update-item" key={row.rowKey}>
        <div className="update-item__header">
          <div>
            <h3>{label}</h3>
            <span className="muted mono">{copy.path(row.relativePath ?? row.skillPath)}</span>
          </div>
          <div className="update-item__actions">
            <Badge tone={row.source === "project" ? "accent" : "neutral"}>
              {copy.sourceLabels[row.source]}
            </Badge>
            <Badge tone={validationTone(row)}>
              {copy.validationStateLabels[row.validationState]}
            </Badge>
          </div>
        </div>
        <div className="update-item__meta">
          <span>{copy.sourceAgents(row.sourceDisplayNames.join(", "))}</span>
          <span>{copy.version(row.version ?? dictionary.common.nA)}</span>
          {row.description ? <span>{row.description}</span> : null}
          {row.validationMessage ? <span>{row.validationMessage}</span> : null}
        </div>
      </article>
    )
  }

  if (selectedProject) {
    return (
      <section className="page-stack" aria-labelledby="project-detail-heading">
        <PageIntro
          eyebrow={copy.eyebrow}
          title={selectedProject.name}
          summary={selectedProject.path}
          actions={
            <>
              <Button variant="outline" onClick={onBackToList}>
                {copy.back}
              </Button>
              <Button
                variant="outline"
                disabled={!bridgeAvailable || busy}
                onClick={() => onOpenProjectFolder(selectedProject.id)}
              >
                {copy.openFolder}
              </Button>
              <Button
                variant="secondary"
                disabled={!bridgeAvailable || isScanning}
                onClick={() => onRefreshProjectSkills(selectedProject.id)}
              >
                {isScanning ? copy.scanning : copy.refreshSkills}
              </Button>
              <Button
                disabled={!bridgeAvailable || writableTargetOptions.length === 0}
                onClick={() => setImportOpen(true)}
              >
                {copy.addSkill}
              </Button>
            </>
          }
        />

        {errorMessage ? <div className="callout callout--warning">{errorMessage}</div> : null}
        {scanSnapshot?.errors.map((error) => (
          <div className="callout callout--warning" key={error}>
            {error}
          </div>
        ))}

        <Card aria-labelledby="project-detail-heading">
          <CardHeader>
            <CardTitle id="project-detail-heading">{copy.skillCount(scanSnapshot?.rows.length ?? 0)}</CardTitle>
            <CardDescription>
              {copy.targetCount(scanSnapshot?.targets.length ?? 0)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isScanning && !scanSnapshot ? <div className="callout">{copy.scanning}</div> : null}
            {scanSnapshot && scanSnapshot.rows.length === 0 ? (
              <div className="callout">{copy.empty}</div>
            ) : null}
            {scanSnapshot && scanSnapshot.rows.length > 0 ? (
              <div className="stack-list">{scanSnapshot.rows.map(renderSkillRow)}</div>
            ) : null}
          </CardContent>
        </Card>

        {importOpen ? (
          <Dialog
            open
            title={copy.importTitle}
            description={copy.importDescription}
            closeLabel={dictionary.common.close}
            onClose={resetImportDialog}
            footer={
              <div className="dialog-actions">
                <Button variant="outline" onClick={resetImportDialog}>
                  {copy.cancel}
                </Button>
                <Button
                  disabled={!validation?.valid || !targetAgentId || busy}
                  onClick={handleImport}
                >
                  {busy ? copy.importing : copy.import}
                </Button>
              </div>
            }
          >
            <div className="form-stack">
              <label className="form-field">
                <span className="form-label">{copy.sourceFolderLabel}</span>
                <div className="project-path-picker">
                  <input
                    className="input mono"
                    value={sourcePath}
                    onChange={(event) => setSourcePath(event.target.value)}
                  />
                  <Button variant="outline" onClick={handleBrowseSkill}>
                    {copy.browse}
                  </Button>
                </div>
              </label>
              <div className="dialog-actions">
                <Button
                  variant="secondary"
                  disabled={!sourcePath.trim() || busy}
                  onClick={() => onValidateSkillFolder(sourcePath)}
                >
                  {busy ? copy.validating : copy.validate}
                </Button>
              </div>
              {validation ? (
                <div className={validation.valid ? "callout callout--success" : "callout callout--warning"}>
                  <strong>
                    {validation.identity ?? copy.validationStateLabels[validation.validationState]}
                  </strong>
                  <span>{validation.validationMessage ?? validation.description ?? dictionary.common.nA}</span>
                </div>
              ) : null}
              <label className="form-field">
                <span className="form-label">{copy.targetAgentLabel}</span>
                <select
                  className="input"
                  value={targetAgentId}
                  onChange={(event) => setTargetAgentId(event.target.value as AgentId)}
                >
                  {writableTargetOptions.map((target) => (
                    <option key={target.agentId} value={target.agentId}>
                      {target.label}
                    </option>
                  ))}
                </select>
              </label>
              {writableTargetOptions.length === 0 ? (
                <div className="callout callout--warning">{copy.noTargets}</div>
              ) : null}
              <label className="project-checkbox">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(event) => setOverwrite(event.target.checked)}
                />
                <span>{copy.overwriteLabel}</span>
              </label>
            </div>
          </Dialog>
        ) : null}
      </section>
    )
  }

  return (
    <section className="page-stack" aria-labelledby="projects-heading">
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title}
        summary={copy.summary}
        actions={
          <Button disabled={!bridgeAvailable || busy} onClick={() => setAddOpen(true)}>
            {copy.addProject}
          </Button>
        }
      />

      {!bridgeAvailable ? (
        <div className="callout callout--error" role="alert">
          {dictionary.appShell.bridgeStatus.unavailable}
        </div>
      ) : null}
      {errorMessage ? <div className="callout callout--warning">{errorMessage}</div> : null}

      <Card aria-labelledby="projects-heading">
        <CardHeader>
          <CardTitle id="projects-heading">{copy.projectsCount(snapshot?.projects.length ?? 0)}</CardTitle>
          {!snapshot ? <CardDescription>{copy.noSnapshot}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {isLoading && !snapshot ? <div className="callout">{copy.loading}</div> : null}
          {!isLoading && snapshot?.projects.length === 0 ? (
            <div className="callout">{copy.empty}</div>
          ) : null}
          {snapshot && snapshot.projects.length > 0 ? (
            <div className="stack-list">
              {snapshot.projects.map((project) => (
                <article className="update-item" key={project.id}>
                  <div className="update-item__header">
                    <div>
                      <h3>{project.name}</h3>
                      <span className="muted mono">{project.path}</span>
                    </div>
                    <div className="update-item__actions">
                      <Button size="sm" onClick={() => onSelectProject(project)}>
                        {copy.open}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRenameProject(project)
                          setRenameName(project.name)
                        }}
                      >
                        {copy.rename}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRemoveProject(project)}
                      >
                        {copy.remove}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {addOpen ? (
        <Dialog
          open
          title={copy.addProjectTitle}
          description={copy.addProjectDescription}
          closeLabel={dictionary.common.close}
          onClose={resetAddDialog}
          footer={
            <div className="dialog-actions">
              <Button variant="outline" onClick={resetAddDialog}>
                {copy.cancel}
              </Button>
              <Button disabled={!addName.trim() || !addPath.trim() || busy} onClick={handleAddProject}>
                {busy ? copy.saving : copy.addProject}
              </Button>
            </div>
          }
        >
          <div className="form-stack">
            <label className="form-field">
              <span className="form-label">{copy.nameLabel}</span>
              <input
                className="input"
                value={addName}
                onChange={(event) => setAddName(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span className="form-label">{copy.pathLabel}</span>
              <div className="project-path-picker">
                <input
                  className="input mono"
                  value={addPath}
                  onChange={(event) => setAddPath(event.target.value)}
                />
                <Button variant="outline" onClick={handleBrowseProject}>
                  {copy.browse}
                </Button>
              </div>
            </label>
          </div>
        </Dialog>
      ) : null}

      {renameProject ? (
        <Dialog
          open
          title={copy.renameTitle}
          description={renameProject.path}
          closeLabel={dictionary.common.close}
          onClose={() => setRenameProject(null)}
          footer={
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setRenameProject(null)}>
                {copy.cancel}
              </Button>
              <Button disabled={!renameName.trim() || busy} onClick={handleRenameProject}>
                {busy ? copy.saving : copy.rename}
              </Button>
            </div>
          }
        >
          <label className="form-field">
            <span className="form-label">{copy.nameLabel}</span>
            <input
              className="input"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
            />
          </label>
        </Dialog>
      ) : null}

      {removeProject ? (
        <Dialog
          open
          title={copy.removeTitle}
          description={copy.removeDescription(removeProject.name)}
          closeLabel={dictionary.common.close}
          onClose={() => setRemoveProject(null)}
          footer={
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setRemoveProject(null)}>
                {copy.cancel}
              </Button>
              <Button variant="destructive" disabled={busy} onClick={handleRemoveProject}>
                {copy.confirmRemove}
              </Button>
            </div>
          }
        >
          <div className="callout callout--warning">{removeProject.path}</div>
        </Dialog>
      ) : null}
    </section>
  )
}
