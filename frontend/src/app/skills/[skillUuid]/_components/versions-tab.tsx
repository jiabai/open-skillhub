"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Check, Clock3, Copy, Download, GitCompare, Loader2, RotateCcw, Terminal } from "lucide-react"

import { api } from "@/lib/api"
import { buildSkillDownloadArtifact, getDownloadErrorMessage } from "@/lib/skill-download"
import type { Skill, SkillInstallInstructions, SkillVersion, SkillVersionDiff } from "@/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"

type VersionsTabProps = {
  skillUuid: string
  skill: Skill
  onSkillUpdated?: (skill: Skill) => void
}

export function VersionsTab({ skillUuid, skill, onSkillUpdated }: VersionsTabProps) {
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [versionDetail, setVersionDetail] = useState<SkillVersion | null>(null)
  const [diffResult, setDiffResult] = useState<SkillVersionDiff | null>(null)
  const [installInstructions, setInstallInstructions] = useState<SkillInstallInstructions | null>(null)
  const [loading, setLoading] = useState(false)
  const [versionDetailLoading, setVersionDetailLoading] = useState(false)
  const [diffLoading, setDiffLoading] = useState(false)
  const [installLoading, setInstallLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [rollbackLoading, setRollbackLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const downloadControllerRef = useRef<AbortController | null>(null)
  const isReference = skill.skill_kind === "reference" || skill.is_reference_read_only

  const selectedVersion = useMemo(
    () => (selectedVersions.length === 1 ? versions.find((item) => item.version === selectedVersions[0]) ?? null : null),
    [selectedVersions, versions]
  )

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.listSkillVersions(skillUuid)
      setVersions(response.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load versions")
    } finally {
      setLoading(false)
    }
  }, [skillUuid])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  useEffect(() => {
    return () => {
      downloadControllerRef.current?.abort()
      downloadControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()

    if (selectedVersions.length !== 1) {
      setVersionDetail(null)
      setDetailError(null)
      setInstallInstructions(null)
      setInstallError(null)
      return () => abortController.abort()
    }

    const fetchVersionDetail = async () => {
      setVersionDetailLoading(true)
      setDetailError(null)
      setInstallInstructions(null)
      setInstallError(null)
      try {
        const result = await api.getSkillVersion(skillUuid, selectedVersions[0])
        if (!abortController.signal.aborted) {
          setVersionDetail(result)
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          setDetailError(err instanceof Error ? err.message : "Failed to load version detail")
        }
      } finally {
        if (!abortController.signal.aborted) {
          setVersionDetailLoading(false)
        }
      }
    }

    fetchVersionDetail()
    return () => abortController.abort()
  }, [selectedVersions, skillUuid])

  useEffect(() => {
    const abortController = new AbortController()

    if (selectedVersions.length !== 2) {
      setDiffResult(null)
      return () => abortController.abort()
    }

    const fetchDiff = async () => {
      setDiffLoading(true)
      try {
        const result = await api.diffSkillVersions(skillUuid, selectedVersions[0], selectedVersions[1])
        if (!abortController.signal.aborted) {
          setDiffResult(result)
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to compare versions")
        }
      } finally {
        if (!abortController.signal.aborted) {
          setDiffLoading(false)
        }
      }
    }

    fetchDiff()
    return () => abortController.abort()
  }, [selectedVersions, skillUuid])

  const handleVersionSelect = useCallback((version: string) => {
    setSelectedVersions((current) => {
      if (current.includes(version)) {
        return current.filter((item) => item !== version)
      }
      if (current.length >= 2) {
        return [current[1], version]
      }
      return [...current, version]
    })
  }, [])

  const handleGetInstallInstructions = async (version: string) => {
    setInstallLoading(true)
    setInstallError(null)
    try {
      const result = await api.getInstallInstructions(skillUuid, version)
      setInstallInstructions(result)
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "Failed to load install instructions")
    } finally {
      setInstallLoading(false)
    }
  }

  const handleCopyCommands = async () => {
    if (!installInstructions?.commands.length) return
    await navigator.clipboard.writeText(installInstructions.commands.join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = async (version?: string) => {
    const controller = new AbortController()
    downloadControllerRef.current = controller
    setDownloadLoading(true)
    setError(null)
    try {
      const result = await api.downloadSkillRaw({ skill_uuid: skillUuid, version, signal: controller.signal })
      const artifact = buildSkillDownloadArtifact(result.payload, skillUuid, result.rawText)
      if (artifact.confirmMessage && !window.confirm(artifact.confirmMessage)) {
        return
      }
      const blob = new Blob([artifact.content], { type: artifact.contentType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = artifact.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      const message = getDownloadErrorMessage(err)
      if (message !== "Download cancelled") {
        setError(message)
      }
    } finally {
      if (downloadControllerRef.current === controller) {
        downloadControllerRef.current = null
      }
      setDownloadLoading(false)
    }
  }

  const handleCancelDownload = () => {
    downloadControllerRef.current?.abort()
    downloadControllerRef.current = null
    setDownloadLoading(false)
  }

  const handleRollback = async (version: string) => {
    setRollbackLoading(true)
    setError(null)
    try {
      await api.rollbackSkillVersion(skillUuid, version)
      await fetchVersions()
      setSelectedVersions([])
      setVersionDetail(null)
      setDiffResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed")
    } finally {
      setRollbackLoading(false)
    }
  }

  const handlePinVersion = async (version: string) => {
    setPinLoading(true)
    setError(null)
    try {
      const updated = await api.pinReferenceSkillVersion(skillUuid, version)
      onSkillUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pin failed")
    } finally {
      setPinLoading(false)
    }
  }

  const handleUnpinVersion = async () => {
    setPinLoading(true)
    setError(null)
    try {
      const updated = await api.unpinReferenceSkillVersion(skillUuid)
      onSkillUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Follow latest failed")
    } finally {
      setPinLoading(false)
    }
  }

  const selectionHelp =
    selectedVersions.length === 0
      ? "Select one version to inspect details, or select two versions to compare changes."
      : selectedVersions.length === 1
        ? "One version selected. Use the actions on the right to inspect, download, or change version behavior."
        : "Two versions selected. The right side now shows dependency and file differences."

  const renderVersionList = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )
    }

    if (error && versions.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchVersions}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (versions.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No version history yet. Versions appear here after uploads or releases create a new version.
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        {versions.map((version, index) => {
          const isSelected = selectedVersions.includes(version.version)
          const isCurrent = skill.resolved_version === version.version
          const isPinned = skill.pinned_version === version.version

          return (
            <Card
              key={version.version}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? "border-primary bg-primary/5" : ""}`}
              onClick={() => handleVersionSelect(version.version)}
            >
              <CardContent className="flex items-start gap-3 py-3">
                <Checkbox
                  checked={isSelected}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={() => handleVersionSelect(version.version)}
                  aria-label={`Select version ${version.version}`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{version.version}</span>
                    {index === 0 ? <Badge variant="accent">Newest</Badge> : null}
                    {isCurrent ? <Badge variant="secondary">In effect</Badge> : null}
                    {isPinned ? <Badge variant="outline">Pinned</Badge> : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{version.description || "No description"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  const renderSingleVersionActions = (version: SkillVersion) => {
    const isPinned = skill.pinned_version === version.version

    return (
      <div className="flex flex-wrap gap-2">
        {isReference ? (
          <>
            <Button variant="outline" onClick={() => handlePinVersion(version.version)} disabled={pinLoading || isPinned}>
              {pinLoading && !isPinned ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isPinned ? `Pinned ${version.version}` : `Pin to ${version.version}`}
            </Button>
            <Button variant="secondary" onClick={handleUnpinVersion} disabled={pinLoading || !skill.pinned_version}>
              {pinLoading && skill.pinned_version ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Follow latest
            </Button>
          </>
        ) : null}

        <Button variant="outline" onClick={() => handleGetInstallInstructions(version.version)} disabled={installLoading}>
          {installLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Terminal className="mr-2 h-4 w-4" />}
          Install instructions
        </Button>

        <Button variant="outline" onClick={() => handleDownload(version.version)} disabled={downloadLoading}>
          {downloadLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download
        </Button>

        {downloadLoading ? (
          <Button variant="ghost" onClick={handleCancelDownload}>
            Cancel download
          </Button>
        ) : null}

        {!isReference ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Rollback to this version
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rollback to {version.version}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This replaces the current working files with the files stored in version {version.version}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleRollback(version.version)} disabled={rollbackLoading}>
                  {rollbackLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm rollback
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    )
  }

  const renderInstallInstructions = () => {
    if (!installLoading && !installError && !installInstructions) {
      return null
    }

    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" />
            Install instructions
          </CardTitle>
          <CardDescription>Use these commands if you need to install dependencies for the selected version.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {installLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading install instructions
            </div>
          ) : null}

          {installError ? <p className="text-sm text-destructive">{installError}</p> : null}

          {installInstructions ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Strategy: {installInstructions.strategy}</Badge>
                {installInstructions.ecosystem ? <Badge variant="outline">{installInstructions.ecosystem}</Badge> : null}
                {installInstructions.dependencies.length ? (
                  <Badge variant="outline">{installInstructions.dependencies.length} dependencies</Badge>
                ) : null}
              </div>

              {installInstructions.commands.length ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Commands</p>
                    <Button variant="ghost" size="sm" onClick={handleCopyCommands}>
                      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">{installInstructions.commands.join("\n")}</pre>
                </div>
              ) : null}

              {installInstructions.requirements_text ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Requirements text</p>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">{installInstructions.requirements_text}</pre>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  const renderSingleVersion = () => {
    if (versionDetailLoading) {
      return (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )
    }

    if (detailError) {
      return (
        <Card>
          <CardContent className="py-8 text-sm text-destructive">{detailError}</CardContent>
        </Card>
      )
    }

    const version = versionDetail ?? selectedVersion
    if (!version) return null

    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>Version {version.version}</span>
              {version.dependencies.length ? <Badge variant="outline">{version.dependencies.length} dependencies</Badge> : null}
              {version.dependency_spec_version ? <Badge variant="secondary">Spec v{version.dependency_spec_version}</Badge> : null}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Created {new Date(version.created_at).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Version behavior</p>
              <p className="text-sm text-muted-foreground">
                {isReference
                  ? skill.pinned_version === version.version
                    ? "This reference is currently pinned to this exact public version."
                    : "Pin this version if you want the reference to stop following newer public releases."
                  : skill.resolved_version === version.version
                    ? "This is the version currently in effect for your private Skill."
                    : "You can inspect, download, or roll back your private Skill to this version."}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Description</p>
              <p className="text-sm text-muted-foreground">{version.description || "No description"}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Dependencies</p>
              {version.dependencies.length ? (
                <div className="flex flex-wrap gap-2">
                  {version.dependencies.map((dependency) => (
                    <Badge key={dependency} variant="outline">
                      {dependency}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No declared dependencies.</p>
              )}
            </div>

            {version.metadata && Object.keys(version.metadata).length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Metadata</p>
                <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(version.metadata, null, 2)}</pre>
              </div>
            ) : null}

            {version.dependency_spec && Object.keys(version.dependency_spec).length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Dependency spec</p>
                <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(version.dependency_spec, null, 2)}</pre>
              </div>
            ) : null}

            {renderSingleVersionActions(version)}
          </CardContent>
        </Card>

        {renderInstallInstructions()}
      </div>
    )
  }

  const renderDiff = () => {
    if (!diffResult) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Compare versions
          </CardTitle>
          <CardDescription>
            {diffResult.from_version} to {diffResult.to_version}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {diffLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading version diff
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Dependency changes</p>
                {diffResult.added.length === 0 && diffResult.removed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No dependency changes between these versions.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Added</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {diffResult.added.length ? diffResult.added.map((item) => <Badge key={item}>{item}</Badge>) : <span className="text-sm text-muted-foreground">None</span>}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Removed</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {diffResult.removed.length ? diffResult.removed.map((item) => <Badge key={item} variant="outline">{item}</Badge>) : <span className="text-sm text-muted-foreground">None</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">File changes</p>
                {diffResult.modified.length ? (
                  <div className="space-y-3">
                    {diffResult.modified.map((item) => (
                      <div key={item.path} className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-sm font-medium">{item.path}</p>
                        <pre className="mt-2 max-h-56 overflow-auto rounded bg-background p-3 text-xs">{item.diff}</pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No file diff details were returned for this comparison.</p>
                )}
              </div>

              {!isReference ? (
                <Button variant="outline" onClick={() => handleRollback(diffResult.from_version)} disabled={rollbackLoading}>
                  {rollbackLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Rollback to {diffResult.from_version}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  References do not roll back local files. Pin a reference version when you want it to stay on a specific public release.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderRightPanel = () => {
    if (selectedVersions.length === 0) {
      return (
        <Card>
          <CardContent className="py-16 text-center">
            <GitCompare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{selectionHelp}</p>
          </CardContent>
        </Card>
      )
    }

    if (selectedVersions.length === 1) {
      return renderSingleVersion()
    }

    return renderDiff()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Version list</h3>
          <p className="text-xs text-muted-foreground">{selectionHelp}</p>
          {isReference ? (
            <p className="text-xs text-muted-foreground">
              References can pin to one public version or follow the latest release. Private Skills can roll back to an older version.
            </p>
          ) : null}
        </div>
        {renderVersionList()}
      </div>

      <div className="flex flex-col gap-4">
        {error ? (
          <Card>
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}
        {renderRightPanel()}
      </div>
    </div>
  )
}
