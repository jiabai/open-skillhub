"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, FileText, Loader2, Save, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import type { ConsoleSkill, SkillVisible } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { VersionsTab } from "./_components/versions-tab"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"

type EditableSkillVisible = Exclude<SkillVisible, "public">

type SkillDetailProps = {
  params: { skillUuid: string }
}

export default function SkillDetailPage({ params }: SkillDetailProps) {
  const { config } = useRuntimeConfig()
  const { success, error: showError } = useToast()
  const { dictionary } = useI18n()
  const { skillDetail: copy } = dictionary
  const router = useRouter()
  const [skill, setSkill] = useState<ConsoleSkill | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [visible, setVisible] = useState<EditableSkillVisible>("private")
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState("")
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [previewError, setPreviewError] = useState<string | null>(null)
  const isReference = skill?.skill_kind === "reference" || skill?.is_reference_read_only

  const fetchData = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.getSkill(params.skillUuid)
      setSkill(data)
      setName(data.name)
      setDescription(data.description || "")
      setVisible((data.visible === "team" || data.visible === "enterprise" ? data.visible : "private") as EditableSkillVisible)
      const fileList = await api.listSkillFiles(params.skillUuid)
      setFiles(fileList)
      setStatus("ready")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : copy.loadFailed)
    }
  }, [copy.loadFailed, params.skillUuid])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    if (!skill) return
    setSaving(true)
    try {
      const updated = await api.updateSkill(
        skill.id,
        isReference
          ? { name }
          : {
              name,
              description,
              visible: config.capabilities.skill_visibility ? visible : undefined,
            }
      )
      setSkill(updated)
      success(copy.saveSuccess)
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.saveFailedTitle
      showError(copy.saveFailedTitle, { description: message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (deleteArchives: boolean) => {
    if (!skill) return
    await api.deleteSkill(skill.id, deleteArchives)
    router.replace("/skills")
  }

  const handlePreview = async (file: string) => {
    if (!skill) return
    setPreviewOpen(true)
    setPreviewFile(file)
    setPreviewStatus("loading")
    setPreviewError(null)
    setPreviewContent("")
    try {
      const content = await api.getSkillFileContent(skill.id, file)
      setPreviewContent(content)
      setPreviewStatus("ready")
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : copy.previewFailed)
      setPreviewStatus("error")
    }
  }

  const typeSummary = !skill
    ? ""
    : isReference
      ? skill.pinned_version
        ? formatMessage(copy.typeSummaryReferencePinned, { version: skill.pinned_version })
        : copy.typeSummaryReferenceLatest
      : skill.skill_kind === "clone"
        ? copy.typeSummaryClone
        : copy.typeSummaryPrivate

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">{copy.title}</h1>
          <p className="text-sm text-muted-foreground 3xl:text-base">{copy.summary}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/skills">{copy.backToList}</Link>
        </Button>
      </div>

      {status === "ready" && skill ? (
        <Card className={skill.is_active ? "border-accent/50 bg-accent/5" : "border-muted"}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className={`h-3 w-3 rounded-full ${skill.is_active ? "bg-accent" : "bg-muted-foreground"}`} />
              <div>
                <p className="font-medium">{skill.is_active ? copy.statusActive : copy.statusInactive}</p>
                <p className="text-sm text-muted-foreground">
                  {skill.is_active ? copy.statusActiveDescription : copy.statusInactiveDescription}
                </p>
              </div>
            </div>
            <Button
              variant={skill.is_active ? "outline" : "default"}
              disabled={!!isReference}
              onClick={async () => {
                try {
                  if (skill.is_active) {
                    await api.deactivateSkill(skill.id)
                    success(copy.deactivateSkill)
                  } else {
                    await api.activateSkill(skill.id)
                    success(copy.activateSkill)
                  }
                  await fetchData()
                } catch (err) {
                  const message = err instanceof Error ? err.message : copy.saveFailedTitle
                  setError(message)
                  showError(copy.saveFailedTitle, { description: message })
                }
              }}
            >
              {skill.is_active ? copy.deactivateSkill : copy.activateSkill}
            </Button>
          </CardContent>
        </Card>
      ) : null}

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

      {status === "ready" && skill ? (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{copy.overviewTab}</TabsTrigger>
            <TabsTrigger value="files">{copy.filesTab}</TabsTrigger>
            <TabsTrigger value="versions">{copy.versionsTab}</TabsTrigger>
            <TabsTrigger value="settings">{copy.settingsTab}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>{skill.name}</CardTitle>
                <CardDescription>{skill.description || copy.noDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{typeSummary}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="muted">id: {skill.id.slice(0, 8)}</Badge>
                  {config.capabilities.skill_visibility && skill.visible ? (
                    <Badge variant={skill.visible === "private" ? "outline" : skill.visible === "team" ? "secondary" : "accent"}>
                      {skill.visible === "private" ? copy.visibilityPrivate : skill.visible === "team" ? copy.visibilityTeam : copy.visibilityEnterprise}
                    </Badge>
                  ) : null}
                  {skill.skill_kind ? <Badge variant="muted">{skill.skill_kind}</Badge> : null}
                  {skill.resolved_version ? <Badge variant="outline">v{skill.resolved_version}</Badge> : null}
                  {skill.pinned_version ? <Badge variant="outline">{formatMessage(copy.pinned, { version: skill.pinned_version })}</Badge> : null}
                  {!config.capabilities.skill_visibility ? <Badge variant="outline">{copy.privateVisibility}</Badge> : null}
                  <Badge variant="accent">{copy.mcpReady}</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle>{copy.filesTitle}</CardTitle>
                <CardDescription>{copy.filesDescription}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                {isReference ? <p>{copy.referenceFilesNotice}</p> : null}
                {files.length === 0 ? (
                  <p>{copy.noFiles}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {files.map((file) => (
                      <li key={file} className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{file}</span>
                        <Button variant="outline" size="sm" onClick={() => handlePreview(file)}>
                          {copy.preview}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <AlertDialog
                  open={previewOpen}
                  onOpenChange={(open) => {
                    setPreviewOpen(open)
                    if (!open) {
                      setPreviewStatus("idle")
                      setPreviewContent("")
                      setPreviewError(null)
                      setPreviewFile(null)
                    }
                  }}
                >
                  <AlertDialogContent className="max-w-4xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {previewFile ? formatMessage(copy.previewTitle, { file: previewFile }) : copy.previewFallbackTitle}
                      </AlertDialogTitle>
                      <AlertDialogDescription>{copy.previewDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    {previewStatus === "loading" ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {copy.loadingContent}
                      </div>
                    ) : null}
                    {previewStatus === "error" ? <div className="text-sm text-destructive">{previewError}</div> : null}
                    {previewStatus === "ready" ? (
                      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 text-xs text-foreground">
                        {previewContent || copy.fileEmpty}
                      </pre>
                    ) : null}
                    <AlertDialogFooter>
                      <AlertDialogCancel>{copy.close}</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="versions">
            <VersionsTab skillUuid={params.skillUuid} skill={skill} onSkillUpdated={(updatedSkill) => setSkill(updatedSkill)} />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>{copy.settingsTitle}</CardTitle>
                <CardDescription>{copy.settingsDescription}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {isReference ? <p className="text-sm text-muted-foreground">{copy.referenceSettingsNotice}</p> : null}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{copy.nameLabel}</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">{copy.descriptionLabel}</Label>
                  <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={!!isReference} />
                </div>
                {config.capabilities.skill_visibility ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="visible" className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      {copy.visibilityLabel}
                    </Label>
                    <Select value={visible} onValueChange={(value) => setVisible(value as EditableSkillVisible)} disabled={!!isReference}>
                      <SelectTrigger id="visible">
                        <SelectValue placeholder={copy.visibilityPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">{copy.visibilityPrivate}</SelectItem>
                        <SelectItem value="team">{copy.visibilityTeam}</SelectItem>
                        <SelectItem value="enterprise">{copy.visibilityEnterprise}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{copy.visibilityHelp}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? copy.saving : copy.saveChanges}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4" />
                        {copy.deleteSkill}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{copy.deleteDescription}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(false)}>{copy.deleteSkillOnly}</AlertDialogAction>
                        <AlertDialogAction onClick={() => handleDelete(true)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {copy.deleteSkillAndArchives}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
