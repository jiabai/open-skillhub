"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2, Search, Trash2 } from "lucide-react"

import { PageIntro } from "@/components/app/page-intro"
import { WorkspaceBoundaryNote } from "@/components/app/workspace-boundary-note"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import type { ConsoleSkill } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"

export default function SkillsPage() {
  const { config } = useRuntimeConfig()
  const { success, error: showError } = useToast()
  const { dictionary } = useI18n()
  const { skills: copy } = dictionary
  const [query, setQuery] = useState("")
  const [includeInactive, setIncludeInactive] = useState(false)
  const [skills, setSkills] = useState<ConsoleSkill[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const rbacEnabled = config.capabilities.rbac

  const loadSkills = useCallback(async (search?: string, includeInactiveParam?: boolean) => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.listSkills(search, includeInactiveParam)
      setSkills(data.items)
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : copy.loadFailed)
    }
  }, [copy.loadFailed])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    loadSkills(query, includeInactive)
  }

  const handleDelete = async (skillUuid: string, deleteArchives: boolean) => {
    await api.deleteSkill(skillUuid, deleteArchives)
    await loadSkills(query, includeInactive)
  }

  const handleToggleActive = async (skillUuid: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await api.deactivateSkill(skillUuid)
        success(copy.deactivatedSuccess)
      } else {
        await api.activateSkill(skillUuid)
        success(copy.activatedSuccess)
      }
      await loadSkills(query, includeInactive)
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.actionFailed
      setError(message)
      showError(copy.actionFailed, { description: message })
    }
  }

  const getKindSummary = (skill: ConsoleSkill) => {
    if (skill.skill_kind === "reference" || skill.is_reference_read_only) {
      return skill.pinned_version
        ? formatMessage(copy.kindSummaryReferencePinned, { version: skill.pinned_version })
        : copy.kindSummaryReferenceLatest
    }
    if (skill.skill_kind === "clone") {
      return copy.kindSummaryClone
    }
    return copy.kindSummaryPrivate
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <PageIntro
        title={rbacEnabled ? copy.titleGoverned : copy.titlePersonal}
        summary={rbacEnabled ? copy.summaryGoverned : copy.summaryPersonal}
        actions={
          <Button asChild>
            <Link href="/skills/new">{copy.createSkill}</Link>
          </Button>
        }
      />
      <WorkspaceBoundaryNote rbacEnabled={rbacEnabled} />

      <Card>
        <CardHeader>
          <CardTitle>{copy.searchFilterTitle}</CardTitle>
          <CardDescription>{copy.searchFilterDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="border-0 px-0 focus-visible:ring-0"
                placeholder={rbacEnabled ? copy.searchPlaceholderGoverned : copy.searchPlaceholderPersonal}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="include-inactive" checked={includeInactive} onCheckedChange={(checked) => setIncludeInactive(checked === true)} />
              <Label htmlFor="include-inactive" className="whitespace-nowrap text-sm">
                {copy.showInactive}
              </Label>
            </div>
            <Button type="submit" variant="secondary">
              {copy.search}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {status === "loading" ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.loading}
            </CardContent>
          </Card>
        ) : null}
        {status === "error" ? (
          <Card>
            <CardContent className="py-10 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}
        {status === "idle" && skills.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 py-10 text-sm text-muted-foreground">
              <p>{copy.empty}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/public-skills">{copy.goToPublicSkills}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/skills/new">{copy.uploadZip}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {skills.map((skill) => {
          const skillUuid = skill.id
          const isReference = skill.skill_kind === "reference" || skill.is_reference_read_only
          const kindLabel =
            skill.skill_kind === "reference"
              ? copy.kindReference
              : skill.skill_kind === "clone"
                ? copy.kindClone
                : skill.skill_kind === "public"
                  ? copy.kindPublic
                  : copy.kindPrivate

          return (
            <Card key={skill.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <CardTitle>{skill.name}</CardTitle>
                  <CardDescription>{skill.description || copy.noDescription}</CardDescription>
                  <p className="text-sm text-muted-foreground">{getKindSummary(skill)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={skill.is_active ? "accent" : "muted"}>{skill.is_active ? copy.active : copy.inactive}</Badge>
                    <Badge variant="muted">{kindLabel}</Badge>
                    {skill.resolved_version ? <Badge variant="outline">v{skill.resolved_version}</Badge> : null}
                    <Badge variant="outline">id: {skill.id.slice(0, 8)}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`/skills/${skillUuid}`}>{copy.open}</Link>
                  </Button>
                  <Button
                    variant={skill.is_active ? "secondary" : "outline"}
                    size="sm"
                    disabled={isReference}
                    onClick={() => handleToggleActive(skillUuid, skill.is_active ?? false)}
                  >
                    {skill.is_active ? copy.deactivate : copy.activate}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" aria-label={copy.deleteSkillAria}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{copy.deleteDescription}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(skillUuid, false)}>{copy.deleteSkillOnly}</AlertDialogAction>
                        <AlertDialogAction onClick={() => handleDelete(skillUuid, true)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {copy.deleteSkillAndArchives}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
