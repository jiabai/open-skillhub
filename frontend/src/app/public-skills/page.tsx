"use client"

import { useEffect, useState } from "react"
import { Copy, Download, Loader2, Search, Sparkles } from "lucide-react"

import { api } from "@/lib/api"
import { buildSkillDownloadArtifact, getDownloadErrorMessage } from "@/lib/skill-download"
import type { Skill } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function PublicSkillsPage() {
  const { success, error: showError } = useToast()
  const [query, setQuery] = useState("")
  const [skills, setSkills] = useState<Skill[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [downloadingSkillId, setDownloadingSkillId] = useState<string | null>(null)

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

  const handleReference = async (skill: Skill) => {
    try {
      await api.referencePublicSkill(skill.id, { name: skill.name })
      success("Public skill added to your skills")
      await loadSkills(query)
    } catch (err) {
      showError("Unable to add reference", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleClone = async (skill: Skill) => {
    try {
      await api.clonePublicSkill(skill.id, { name: `${skill.name}-copy`, visible: "private" })
      success("Public skill cloned")
      await loadSkills(query)
    } catch (err) {
      showError("Unable to clone skill", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleDownload = async (skill: Skill) => {
    setDownloadingSkillId(skill.id)
    try {
      const result = await api.downloadSkillRaw({ skill_uuid: skill.id, version: skill.resolved_version })
      const artifact = buildSkillDownloadArtifact(result.payload, skill.id, result.rawText)
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
      success("Public skill download started")
    } catch (err) {
      showError("Unable to download skill", {
        description: getDownloadErrorMessage(err),
      })
    } finally {
      setDownloadingSkillId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div>
        <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">Public Skills</h1>
        <p className="text-sm 3xl:text-base text-muted-foreground">
          Browse system-provided skills and add them as references or private copies.
        </p>
      </div>

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
          <CardContent className="py-10 text-sm text-muted-foreground">
            No public skills found.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {skills.map((skill) => (
          <Card key={skill.id}>
            <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CardTitle>{skill.name}</CardTitle>
                  <Badge variant="accent">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Public
                  </Badge>
                </div>
                <CardDescription>{skill.description || "No description"}</CardDescription>
                <div className="flex flex-wrap gap-2">
                  {skill.resolved_version ? <Badge variant="outline">v{skill.resolved_version}</Badge> : null}
                  {skill.has_reference ? <Badge variant="secondary">Referenced</Badge> : null}
                  {skill.has_clone ? <Badge variant="secondary">Cloned</Badge> : null}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleDownload(skill)} disabled={downloadingSkillId === skill.id}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
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
