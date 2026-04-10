"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, FileText, Loader2, Save, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import { featureFlags } from "@/lib/feature-flags"
import type { Skill, SkillVisible } from "@/types"
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

type EditableSkillVisible = Exclude<SkillVisible, "public">

type SkillDetailProps = {
  params: { skillUuid: string }
}

export default function SkillDetailPage({ params }: SkillDetailProps) {
  const { success, error: showError } = useToast()
  const router = useRouter()
  const [skill, setSkill] = useState<Skill | null>(null)
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
      setError(err instanceof Error ? err.message : "Failed to load Skill")
    }
  }, [params.skillUuid])

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
              visible: featureFlags.enableSkillVisibility ? visible : undefined,
            }
      )
      setSkill(updated)
      success("Skill saved")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed"
      showError("Save failed", { description: message })
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
      setPreviewError(err instanceof Error ? err.message : "Preview failed")
      setPreviewStatus("error")
    }
  }

  const typeSummary = !skill
    ? ""
    : isReference
      ? skill.pinned_version
        ? `Reference Skill pinned to version ${skill.pinned_version}.`
        : "Reference Skill following the latest public source version."
      : skill.skill_kind === "clone"
        ? "Clone Skill with a private editable copy and its own version path."
        : "Private Skill owned and maintained in your workspace."

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">Skill Detail</h1>
          <p className="text-sm 3xl:text-base text-muted-foreground">Review type, effective version, files, and maintenance actions for this Skill.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/skills">Back to list</Link>
        </Button>
      </div>

      {status === "ready" && skill ? (
        <Card className={skill.is_active ? "border-accent/50 bg-accent/5" : "border-muted"}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className={`h-3 w-3 rounded-full ${skill.is_active ? "bg-accent" : "bg-muted-foreground"}`} />
              <div>
                <p className="font-medium">{skill.is_active ? "Active" : "Inactive"}</p>
                <p className="text-sm text-muted-foreground">
                  {skill.is_active ? "This Skill is available for normal use." : "This Skill is currently unavailable until reactivated."}
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
                    success("Skill deactivated")
                  } else {
                    await api.activateSkill(skill.id)
                    success("Skill activated")
                  }
                  await fetchData()
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Action failed"
                  setError(message)
                  showError("Action failed", { description: message })
                }
              }}
            >
              {skill.is_active ? "Deactivate Skill" : "Activate Skill"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {status === "loading" ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Skill
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
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>{skill.name}</CardTitle>
                <CardDescription>{skill.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{typeSummary}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="muted">id: {skill.id.slice(0, 8)}</Badge>
                  {featureFlags.enableSkillVisibility && skill.visible ? (
                    <Badge variant={skill.visible === "private" ? "outline" : skill.visible === "team" ? "secondary" : "accent"}>{skill.visible}</Badge>
                  ) : null}
                  {skill.skill_kind ? <Badge variant="muted">{skill.skill_kind}</Badge> : null}
                  {skill.resolved_version ? <Badge variant="outline">v{skill.resolved_version}</Badge> : null}
                  {skill.pinned_version ? <Badge variant="outline">Pinned {skill.pinned_version}</Badge> : null}
                  {!featureFlags.enableSkillVisibility ? <Badge variant="outline">private</Badge> : null}
                  <Badge variant="accent">MCP Ready</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle>Files</CardTitle>
                <CardDescription>Inspect files from the currently effective version for this Skill.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                {isReference ? <p>This reference resolves files from its public source version, so file upload and direct file edits stay disabled here.</p> : null}
                {files.length === 0 ? (
                  <p>No files available yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {files.map((file) => (
                      <li key={file} className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{file}</span>
                        <Button variant="outline" size="sm" onClick={() => handlePreview(file)}>
                          Preview
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
                      <AlertDialogTitle>{previewFile ? `Preview ${previewFile}` : "Preview file"}</AlertDialogTitle>
                      <AlertDialogDescription>Use this to quickly inspect text file contents.</AlertDialogDescription>
                    </AlertDialogHeader>
                    {previewStatus === "loading" ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading content
                      </div>
                    ) : null}
                    {previewStatus === "error" ? <div className="text-sm text-destructive">{previewError}</div> : null}
                    {previewStatus === "ready" ? (
                      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 text-xs text-foreground">
                        {previewContent || "File is empty"}
                      </pre>
                    ) : null}
                    <AlertDialogFooter>
                      <AlertDialogCancel>Close</AlertDialogCancel>
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
                <CardTitle>Settings</CardTitle>
                <CardDescription>Update metadata or delete this Skill. Reference Skills keep stricter edit limits.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {isReference ? (
                  <p className="text-sm text-muted-foreground">
                    This Skill is a reference to a public source. You can rename it for your workspace, but file and description changes stay restricted.
                  </p>
                ) : null}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Skill name</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={!!isReference} />
                </div>
                {featureFlags.enableSkillVisibility ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="visible" className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      Visibility
                    </Label>
                    <Select value={visible} onValueChange={(value) => setVisible(value as EditableSkillVisible)} disabled={!!isReference}>
                      <SelectTrigger id="visible">
                        <SelectValue placeholder="Choose visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">private</SelectItem>
                        <SelectItem value="team">team</SelectItem>
                        <SelectItem value="enterprise">enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Visibility rules only apply when the environment enables scoped visibility.</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4" />
                        Delete Skill
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this Skill?</AlertDialogTitle>
                        <AlertDialogDescription>Choose whether to remove only the Skill record or also delete stored archives.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(false)}>Delete Skill only</AlertDialogAction>
                        <AlertDialogAction onClick={() => handleDelete(true)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete Skill and archives
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
