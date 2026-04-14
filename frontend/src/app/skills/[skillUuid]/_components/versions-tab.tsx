"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Check, Clock3, Copy, GitCompare, Loader2, RotateCcw, Terminal } from "lucide-react"

import { api } from "@/lib/api"
import type { ConsoleSkill, SkillInstallInstructions, SkillVersion, SkillVersionDiff } from "@/types"
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
import { getDateFnsLocale } from "@/i18n/date-fns"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"

type VersionsTabProps = {
  skillUuid: string
  skill: ConsoleSkill
  onSkillUpdated?: (skill: ConsoleSkill) => void
}

export function VersionsTab({ skillUuid, skill, onSkillUpdated }: VersionsTabProps) {
  const { dictionary, locale } = useI18n()
  const { versions: copy } = dictionary
  const dateLocale = getDateFnsLocale(locale)
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [versionDetail, setVersionDetail] = useState<SkillVersion | null>(null)
  const [diffResult, setDiffResult] = useState<SkillVersionDiff | null>(null)
  const [installInstructions, setInstallInstructions] = useState<SkillInstallInstructions | null>(null)
  const [loading, setLoading] = useState(false)
  const [versionDetailLoading, setVersionDetailLoading] = useState(false)
  const [diffLoading, setDiffLoading] = useState(false)
  const [installLoading, setInstallLoading] = useState(false)
  const [rollbackLoading, setRollbackLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
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
      setError(err instanceof Error ? err.message : copy.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [copy.loadFailed, skillUuid])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

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
          setDetailError(err instanceof Error ? err.message : copy.detailLoadFailed)
        }
      } finally {
        if (!abortController.signal.aborted) {
          setVersionDetailLoading(false)
        }
      }
    }

    fetchVersionDetail()
    return () => abortController.abort()
  }, [copy.detailLoadFailed, selectedVersions, skillUuid])

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
          setError(err instanceof Error ? err.message : copy.compareFailed)
        }
      } finally {
        if (!abortController.signal.aborted) {
          setDiffLoading(false)
        }
      }
    }

    fetchDiff()
    return () => abortController.abort()
  }, [copy.compareFailed, selectedVersions, skillUuid])

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
      setInstallError(err instanceof Error ? err.message : copy.installLoadFailed)
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
      setError(err instanceof Error ? err.message : copy.rollbackFailed)
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
      setError(err instanceof Error ? err.message : copy.pinFailed)
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
      setError(err instanceof Error ? err.message : copy.followLatestFailed)
    } finally {
      setPinLoading(false)
    }
  }

  const selectionHelp =
    selectedVersions.length === 0
      ? copy.selectionHelpNone
      : selectedVersions.length === 1
        ? copy.selectionHelpOne
        : copy.selectionHelpTwo

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
              {copy.retry}
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (versions.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{copy.empty}</CardContent>
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
                  aria-label={formatMessage(copy.selectVersionAria, { version: version.version })}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{version.version}</span>
                    {index === 0 ? <Badge variant="accent">{copy.newest}</Badge> : null}
                    {isCurrent ? <Badge variant="secondary">{copy.inEffect}</Badge> : null}
                    {isPinned ? <Badge variant="outline">{copy.pinned}</Badge> : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{version.description || copy.noDescription}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(version.created_at), { addSuffix: true, locale: dateLocale })}
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
              {isPinned ? formatMessage(copy.pinnedVersion, { version: version.version }) : formatMessage(copy.pinToVersion, { version: version.version })}
            </Button>
            <Button variant="secondary" onClick={handleUnpinVersion} disabled={pinLoading || !skill.pinned_version}>
              {pinLoading && skill.pinned_version ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {copy.followLatest}
            </Button>
          </>
        ) : null}

        <Button variant="outline" onClick={() => handleGetInstallInstructions(version.version)} disabled={installLoading}>
          {installLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Terminal className="mr-2 h-4 w-4" />}
          {copy.installInstructions}
        </Button>

        {!isReference ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                {copy.rollbackToVersion}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{formatMessage(copy.rollbackConfirmTitle, { version: version.version })}</AlertDialogTitle>
                <AlertDialogDescription>{formatMessage(copy.rollbackConfirmDescription, { version: version.version })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleRollback(version.version)} disabled={rollbackLoading}>
                  {rollbackLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {copy.confirmRollback}
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
            {copy.installInstructions}
          </CardTitle>
          <CardDescription>{copy.installInstructionsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {installLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.loadingInstallInstructions}
            </div>
          ) : null}

          {installError ? <p className="text-sm text-destructive">{installError}</p> : null}

          {installInstructions ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{formatMessage(copy.strategy, { strategy: installInstructions.strategy })}</Badge>
                {installInstructions.ecosystem ? <Badge variant="outline">{installInstructions.ecosystem}</Badge> : null}
                {installInstructions.dependencies.length ? (
                  <Badge variant="outline">{formatMessage(copy.dependenciesCount, { count: installInstructions.dependencies.length })}</Badge>
                ) : null}
              </div>

              {installInstructions.commands.length ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{copy.commands}</p>
                    <Button variant="ghost" size="sm" onClick={handleCopyCommands}>
                      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied ? copy.copied : copy.copy}
                    </Button>
                  </div>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">{installInstructions.commands.join("\n")}</pre>
                </div>
              ) : null}

              {installInstructions.requirements_text ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{copy.requirementsText}</p>
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
              <span>{formatMessage(copy.versionTitle, { version: version.version })}</span>
              {version.dependencies.length ? <Badge variant="outline">{formatMessage(copy.dependenciesCount, { count: version.dependencies.length })}</Badge> : null}
              {version.dependency_spec_version ? <Badge variant="secondary">Spec v{version.dependency_spec_version}</Badge> : null}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {formatMessage(copy.createdAt, { date: new Date(version.created_at).toLocaleString(locale) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{copy.versionBehavior}</p>
              <p className="text-sm text-muted-foreground">
                {isReference
                  ? skill.pinned_version === version.version
                    ? copy.referencePinnedBehavior
                    : copy.referencePinBehavior
                  : skill.resolved_version === version.version
                    ? copy.privateCurrentBehavior
                    : copy.privateOtherBehavior}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{copy.descriptionTitle}</p>
              <p className="text-sm text-muted-foreground">{version.description || copy.noDescription}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{copy.dependenciesTitle}</p>
              {version.dependencies.length ? (
                <div className="flex flex-wrap gap-2">
                  {version.dependencies.map((dependency) => (
                    <Badge key={dependency} variant="outline">
                      {dependency}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{copy.noDeclaredDependencies}</p>
              )}
            </div>

            {version.metadata && Object.keys(version.metadata).length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{copy.metadataTitle}</p>
                <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(version.metadata, null, 2)}</pre>
              </div>
            ) : null}

            {version.dependency_spec && Object.keys(version.dependency_spec).length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{copy.dependencySpecTitle}</p>
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
            {copy.compareVersions}
          </CardTitle>
          <CardDescription>
            {diffResult.from_version} to {diffResult.to_version}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {diffLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.loadingVersionDiff}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">{copy.dependencyChanges}</p>
                {diffResult.added.length === 0 && diffResult.removed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.noDependencyChanges}</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.added}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {diffResult.added.length
                          ? diffResult.added.map((item) => <Badge key={item}>{item}</Badge>)
                          : <span className="text-sm text-muted-foreground">{copy.none}</span>}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.removed}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {diffResult.removed.length
                          ? diffResult.removed.map((item) => (
                              <Badge key={item} variant="outline">
                                {item}
                              </Badge>
                            ))
                          : <span className="text-sm text-muted-foreground">{copy.none}</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{copy.fileChanges}</p>
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
                  <p className="text-sm text-muted-foreground">{copy.noFileDiff}</p>
                )}
              </div>

              {!isReference ? (
                <Button variant="outline" onClick={() => handleRollback(diffResult.from_version)} disabled={rollbackLoading}>
                  {rollbackLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  {formatMessage(copy.rollbackToVersion, { version: diffResult.from_version })}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{copy.referenceRollbackNotice}</p>
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
          <h3 className="text-sm font-medium">{copy.versionListTitle}</h3>
          <p className="text-xs text-muted-foreground">{selectionHelp}</p>
          {isReference ? <p className="text-xs text-muted-foreground">{copy.referenceHelp}</p> : null}
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
