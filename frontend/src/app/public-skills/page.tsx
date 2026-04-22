"use client"

import { useCallback, useEffect, useState } from "react"
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
import { useI18n } from "@/i18n/use-i18n"

type NextStepState =
  | { href: string; title: string; description: string; actionLabel: string }
  | null

export default function PublicSkillsPage() {
  const { config } = useRuntimeConfig()
  const { success, error: showError } = useToast()
  const { dictionary } = useI18n()
  const { publicSkills } = dictionary
  const [query, setQuery] = useState("")
  const [skills, setSkills] = useState<PublicSkill[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [nextStep, setNextStep] = useState<NextStepState>(null)
  const rbacEnabled = config.capabilities.rbac

  const loadSkills = useCallback(async (search?: string) => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.listPublicSkills(search)
      setSkills(data.items)
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : publicSkills.loadFailed)
    }
  }, [publicSkills.loadFailed])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  const handleReference = async (skill: PublicSkill) => {
    try {
      await api.referencePublicSkill(skill.id, { name: skill.name })
      setNextStep({
        href: "/skills",
        title: publicSkills.nextStepReferenceTitle,
        description: publicSkills.nextStepReferenceDescription,
        actionLabel: publicSkills.nextStepReferenceAction,
      })
      success(publicSkills.referenceSuccess)
      await loadSkills(query)
    } catch (err) {
      showError(publicSkills.referenceErrorTitle, {
        description: err instanceof Error ? err.message : publicSkills.loadFailed,
      })
    }
  }

  const handleClone = async (skill: PublicSkill) => {
    try {
      const created = await api.clonePublicSkill(skill.id, {
        name: `${skill.name}${publicSkills.cloneNameSuffix}`,
        visible: "private",
      })
      setNextStep({
        href: `/skills/${created.id}`,
        title: publicSkills.nextStepCloneTitle,
        description: publicSkills.nextStepCloneDescription,
        actionLabel: publicSkills.nextStepCloneAction,
      })
      success(publicSkills.cloneSuccess)
      await loadSkills(query)
    } catch (err) {
      showError(publicSkills.cloneErrorTitle, {
        description: err instanceof Error ? err.message : publicSkills.loadFailed,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <PageIntro
        title={publicSkills.title}
        summary={rbacEnabled ? publicSkills.summaryGoverned : publicSkills.summaryPersonal}
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
                placeholder={publicSkills.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              {publicSkills.search}
            </Button>
          </form>
        </CardContent>
      </Card>

      {status === "loading" ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {publicSkills.loading}
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
          <CardContent className="py-10 text-sm text-muted-foreground">{publicSkills.empty}</CardContent>
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
                    {publicSkills.publicBadge}
                  </Badge>
                  {!rbacEnabled && !skill.has_reference ? <Badge variant="outline">{publicSkills.recommendedReference}</Badge> : null}
                </div>
                <CardDescription>{skill.description || publicSkills.noDescription}</CardDescription>
                <div className="flex flex-wrap gap-2">
                  {skill.resolved_version ? <Badge variant="outline">v{skill.resolved_version}</Badge> : null}
                  {skill.has_reference ? <Badge variant="secondary">{publicSkills.referenced}</Badge> : null}
                  {skill.has_clone ? <Badge variant="secondary">{publicSkills.cloned}</Badge> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => handleReference(skill)} disabled={skill.has_reference}>
                  {publicSkills.addReference}
                </Button>
                {!skill.has_reference ? (
                  <Button variant="outline" onClick={() => handleClone(skill)}>
                    <Copy className="mr-2 h-4 w-4" />
                    {publicSkills.clone}
                  </Button>
                ) : null}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
