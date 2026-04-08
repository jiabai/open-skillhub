"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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
      setError(err instanceof Error ? err.message : "加载失败")
    }
  }, [params.skillUuid])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    if (!skill) {
      return
    }
    setSaving(true)
    try {
      const updated = await api.updateSkill(skill.id, {
        name,
        description,
        visible: featureFlags.enableSkillVisibility ? visible : undefined
      })
      setSkill(updated)
      success("Skill 已保存")
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败"
      showError("保存失败", { description: message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (deleteArchives: boolean) => {
    if (!skill) {
      return
    }
    await api.deleteSkill(skill.id, deleteArchives)
    window.location.href = "/skills"
  }

  const handlePreview = async (file: string) => {
    if (!skill) {
      return
    }
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
      setPreviewError(err instanceof Error ? err.message : "预览失败")
      setPreviewStatus("error")
    }
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">Skill 详情</h1>
          <p className="text-sm 3xl:text-base text-muted-foreground">查看与维护 Skill 元数据与文件。</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/skills">返回列表</Link>
        </Button>
      </div>

      {/* 状态栏 */}
      {status === "ready" && skill && (
        <Card className={skill.is_active ? "border-accent/50 bg-accent/5" : "border-muted"}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className={`h-3 w-3 rounded-full ${skill.is_active ? "bg-accent" : "bg-muted-foreground"}`} />
              <div>
                <p className="font-medium">
                  {skill.is_active ? "已启用" : "已停用"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {skill.is_active
                    ? "Skill 当前处于活跃状态，可以正常使用"
                    : "Skill 当前处于停用状态，不可访问"}
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
                    success("Skill 已停用")
                  } else {
                    await api.activateSkill(skill.id)
                    success("Skill 已启用")
                  }
                  await fetchData()
                } catch (err) {
                  const message = err instanceof Error ? err.message : "操作失败"
                  setError(message)
                  showError("操作失败", { description: message })
                }
              }}
            >
              {skill.is_active ? "停用 Skill" : "启用 Skill"}
            </Button>
          </CardContent>
        </Card>
      )}

      {status === "loading" ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载 Skill
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
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="files">文件</TabsTrigger>
            <TabsTrigger value="versions">版本</TabsTrigger>
            <TabsTrigger value="settings">设置</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>{skill.name}</CardTitle>
                <CardDescription>{skill.description || "暂无描述"}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="muted">id: {skill.id.slice(0, 8)}</Badge>
                {/* 可见性徽章 - 条件显示 */}
                {featureFlags.enableSkillVisibility && skill.visible && (
                  <Badge variant={skill.visible === "private" ? "outline" : skill.visible === "team" ? "secondary" : "accent"}>
                    {skill.visible === "private" ? "私有" : skill.visible === "team" ? "团队" : "企业"}
                  </Badge>
                )}
                {skill.skill_kind ? <Badge variant="muted">{skill.skill_kind}</Badge> : null}
                {skill.resolved_version ? <Badge variant="outline">v{skill.resolved_version}</Badge> : null}
                {skill.pinned_version ? <Badge variant="outline">Pinned {skill.pinned_version}</Badge> : null}
                {!featureFlags.enableSkillVisibility && <Badge variant="outline">私有目录</Badge>}
                <Badge variant="accent">MCP 可用</Badge>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle>文件清单</CardTitle>
                <CardDescription>查看已上传的参考文件。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                {files.length === 0 ? (
                  <p>暂无文件，请在创建页上传。</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {files.map((file) => (
                      <li key={file} className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{file}</span>
                        <Button variant="outline" size="sm" onClick={() => handlePreview(file)}>
                          预览
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
                      <AlertDialogTitle>{previewFile ? `预览 ${previewFile}` : "预览文件"}</AlertDialogTitle>
                      <AlertDialogDescription>仅用于快速查看文本内容。</AlertDialogDescription>
                    </AlertDialogHeader>
                    {previewStatus === "loading" ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在加载内容
                      </div>
                    ) : null}
                    {previewStatus === "error" ? (
                      <div className="text-sm text-destructive">{previewError}</div>
                    ) : null}
                    {previewStatus === "ready" ? (
                      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-4 text-xs text-foreground">
                        {previewContent || "文件为空"}
                      </pre>
                    ) : null}
                    <AlertDialogFooter>
                      <AlertDialogCancel>关闭</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="versions">
            <VersionsTab skillUuid={params.skillUuid} />
          </TabsContent>
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>设置</CardTitle>
                <CardDescription>更新名称与描述，或删除 Skill。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Skill 名称</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={!!isReference} />
                </div>
                {/* 可见性设置 - 条件显示 */}
                {featureFlags.enableSkillVisibility && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="visible" className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      可见性
                    </Label>
                    <Select value={visible} onValueChange={(value) => setVisible(value as EditableSkillVisible)} disabled={!!isReference}>
                      <SelectTrigger id="visible">
                        <SelectValue placeholder="选择可见性" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">私有</SelectItem>
                        <SelectItem value="team">团队</SelectItem>
                        <SelectItem value="enterprise">企业</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      私有：仅自己可见；团队：团队成员可见；企业：全企业可见
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saving || !!isReference}>
                    <Save className="h-4 w-4" />
                    {saving ? "保存中..." : "保存修改"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4" />
                        删除 Skill
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认删除 Skill？</AlertDialogTitle>
                        <AlertDialogDescription>请选择删除方式：</AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="flex flex-col gap-2 py-4 text-sm">
                        <p className="text-muted-foreground">
                          <strong>仅删除技能</strong>：保留存档，后续可重新上传同名技能（版本号将自动递增）
                        </p>
                        <p className="text-muted-foreground">
                          <strong>彻底删除</strong>：同时删除存档，无法恢复
                        </p>
                      </div>
                      <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(false)}>
                          仅删除技能
                        </AlertDialogAction>
                        <AlertDialogAction
                          onClick={() => handleDelete(true)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          彻底删除
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
