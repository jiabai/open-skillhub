"use client"

import { useEffect, useState } from "react"
import { Copy, Loader2, Search, Sparkles } from "lucide-react"

import { NextStepCard } from "@/components/app/next-step-card"
import { PageIntro } from "@/components/app/page-intro"
import { SkillTypeExplainer } from "@/components/app/skill-type-explainer"
import { WorkspaceBoundaryNote } from "@/components/app/workspace-boundary-note"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import type { PublicSkill } from "@/types"
import { useToast } from "@/hooks/use-toast"

type NextStepState =
  | { href: string; title: string; description: string; actionLabel: string }
  | null

export default function PublicSkillsPage() {
  const { config } = useRuntimeConfig()
  const { success, error: showError } = useToast()
  const [query, setQuery] = useState("")
  const [skills, setSkills] = useState<PublicSkill[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [nextStep, setNextStep] = useState<NextStepState>(null)
  const rbacEnabled = config.capabilities.rbac

  const loadSkills = async (search?: string) => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.listPublicSkills(search)
      setSkills(data.items)
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to load public skills")
    }
  }

  useEffect(() => {
    loadSkills()
  }, [])

  const handleReference = async (skill: PublicSkill) => {
    try {
      await api.referencePublicSkill(skill.id, { name: skill.name })
      setNextStep({
        href: "/skills",
        title: "Reference created",
        description: "The public Skill was added to your personal workspace. Review it in My Skills and decide later if you need a clone.",
        actionLabel: "Go to My Skills",
      })
      success("Public skill added to your skills")
      await loadSkills(query)
    } catch (err) {
      showError("Unable to add reference", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleClone = async (skill: PublicSkill) => {
    try {
      const created = await api.clonePublicSkill(skill.id, { name: `${skill.name}-copy`, visible: "private" })
      setNextStep({
        href: `/skills/${created.id}`,
        title: "Clone created",
        description: "You now have a private editable copy. Open it next to manage files, versions, and later uploads.",
        actionLabel: "Open cloned Skill",
      })
      success("Public skill cloned")
      await loadSkills(query)
    } catch (err) {
      showError("Unable to clone skill", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <PageIntro
        title="Public Skills"
        summary={
          !rbacEnabled
            ? "Start here if you want to adopt a public Skill quickly. Use a reference first, clone when you need your own editable copy."
            : "Browse reusable public Skills and bring them into your governed workspace with the right ownership model."
        }
      />
      <WorkspaceBoundaryNote rbacEnabled={rbacEnabled} />

      {!rbacEnabled ? <SkillTypeExplainer /> : null}
      {nextStep ? <NextStepCard {...nextStep} /> : null}

      <Card>
        <CardContent className="pt-6">
          <form
            className="flex gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              loadSkills(query)
            }}
          >
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="border-0 px-0 focus-visible:ring-0"
                placeholder="Search public skills"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {status === "loading" ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading public skills
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
          <CardContent className="py-10 text-sm text-muted-foreground">No public skills found.</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {skills.map((skill) => (
          <Card key={skill.id}>
            <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{skill.name}</CardTitle>
                  <Badge variant="accent">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Public
                  </Badge>
                  {!rbacEnabled && !skill.has_reference ? <Badge variant="outline">Recommended first step: Reference</Badge> : null}
                </div>
                <CardDescription>{skill.description || "No description"}</CardDescription>
                <div className="flex flex-wrap gap-2">
                  {skill.resolved_version ? <Badge variant="outline">v{skill.resolved_version}</Badge> : null}
                  {skill.has_reference ? <Badge variant="secondary">Referenced</Badge> : null}
                  {skill.has_clone ? <Badge variant="secondary">Cloned</Badge> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => handleReference(skill)} disabled={skill.has_reference}>
                  Add Reference
                </Button>
                <Button variant="outline" onClick={() => handleClone(skill)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Clone
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
