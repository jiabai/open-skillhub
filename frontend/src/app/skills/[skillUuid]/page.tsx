"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Loader2, Save, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import type { Skill } from "@/types"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type SkillDetailProps = {
  params: { skillUuid: string }
}

export default function SkillDetailPage({ params }: SkillDetailProps) {
  const [skill, setSkill] = useState<Skill | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState("")
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [previewError, setPreviewError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.getSkill(params.skillUuid)
      setSkill(data)
      setName(data.name)
      setDescription(data.description || "")
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
      const updated = await api.updateSkill(skill.id, { name, description })
      setSkill(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!skill) {
      return
    }
    await api.deleteSkill(skill.id)
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Skill 详情</h1>
          <p className="text-sm text-muted-foreground">查看与维护 Skill 元数据与文件。</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/skills">返回列表</Link>
        </Button>
      </div>
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
                <Badge variant="outline">私有目录</Badge>
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
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {files.length === 0 ? (
                  <p>暂无文件，请在创建页上传。</p>
                ) : (
                  <ul className="space-y-2">
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
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>设置</CardTitle>
                <CardDescription>更新名称与描述，或删除 Skill。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Skill 名称</Label>
                  <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saving}>
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
                        <AlertDialogDescription>该操作不可撤销。</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>确认删除</AlertDialogAction>
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
