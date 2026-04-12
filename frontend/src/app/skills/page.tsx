"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Loader2, Search, Trash2 } from "lucide-react"

import { ModeBoundaryNote } from "@/components/app/mode-boundary-note"
import { PageIntro } from "@/components/app/page-intro"
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
import { getAppMode } from "@/lib/app-mode"
import { api } from "@/lib/api"
import type { ConsoleSkill } from "@/types"
import { useToast } from "@/hooks/use-toast"

export default function SkillsPage() {
  const { success, error: showError } = useToast()
  const [query, setQuery] = useState("")
  const [includeInactive, setIncludeInactive] = useState(false)
  const [skills, setSkills] = useState<ConsoleSkill[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const appMode = getAppMode()

  const loadSkills = async (search?: string, includeInactiveParam?: boolean) => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.listSkills(search, includeInactiveParam)
      setSkills(data.items)
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to load skills")
    }
  }

  useEffect(() => {
    loadSkills()
  }, [])

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
        success("Skill deactivated")
      } else {
        await api.activateSkill(skillUuid)
        success("Skill activated")
      }
      await loadSkills(query, includeInactive)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed"
      setError(message)
      showError("Action failed", { description: message })
    }
  }

  const getKindSummary = (skill: ConsoleSkill) => {
    if (skill.skill_kind === "reference" || skill.is_reference_read_only) {
      return skill.pinned_version ? `Reference - pinned to v${skill.pinned_version}` : "Reference - follows public source"
    }
    if (skill.skill_kind === "clone") {
      return "Clone - private editable copy"
    }
    return "Private - owned in your workspace"
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <PageIntro
        title={appMode === "no-rbac" ? "My Skills" : "Skills"}
        summary={
          appMode === "no-rbac"
            ? "This is your personal workspace. It shows the private, reference, and clone Skills that belong to your own workflow."
            : "Review and manage the Skills that are available within your current scope."
        }
        actions={
          <Button asChild>
            <Link href="/skills/new">Create Skill</Link>
          </Button>
        }
      />
      <ModeBoundaryNote mode={appMode} />

      <Card>
        <CardHeader>
          <CardTitle>Search and Filter</CardTitle>
          <CardDescription>Search by name or description and decide whether to include inactive Skills.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="border-0 px-0 focus-visible:ring-0"
                placeholder={appMode === "no-rbac" ? "Search your Skills" : "Search Skills in scope"}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="include-inactive" checked={includeInactive} onCheckedChange={(checked) => setIncludeInactive(checked === true)} />
              <Label htmlFor="include-inactive" className="whitespace-nowrap text-sm">
                Show inactive
              </Label>
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {status === "loading" ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Skills
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
              <p>No Skills are available in this workspace yet.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/public-skills">Go to Public Skills</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/skills/new">Upload your own ZIP</Link>
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
              ? "Reference"
              : skill.skill_kind === "clone"
                ? "Clone"
                : skill.skill_kind === "public"
                  ? "Public"
                  : "Private"

          return (
            <Card key={skill.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <CardTitle>{skill.name}</CardTitle>
                  <CardDescription>{skill.description || "No description"}</CardDescription>
                  <p className="text-sm text-muted-foreground">{getKindSummary(skill)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={skill.is_active ? "accent" : "muted"}>{skill.is_active ? "Active" : "Inactive"}</Badge>
                    <Badge variant="muted">{kindLabel}</Badge>
                    {skill.resolved_version ? <Badge variant="outline">v{skill.resolved_version}</Badge> : null}
                    <Badge variant="outline">id: {skill.id.slice(0, 8)}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`/skills/${skillUuid}`}>Open</Link>
                  </Button>
                  <Button
                    variant={skill.is_active ? "secondary" : "outline"}
                    size="sm"
                    disabled={isReference}
                    onClick={() => handleToggleActive(skillUuid, skill.is_active ?? false)}
                  >
                    {skill.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" aria-label="Delete Skill">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this Skill?</AlertDialogTitle>
                        <AlertDialogDescription>Choose whether to remove only the Skill record or also delete stored archives.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(skillUuid, false)}>Delete Skill only</AlertDialogAction>
                        <AlertDialogAction onClick={() => handleDelete(skillUuid, true)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete Skill and archives
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
