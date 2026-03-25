"use client"

import { useState } from "react"
import Link from "next/link"
import { FileUp, UploadCloud } from "lucide-react"

import { api } from "@/lib/api"
import { useField, createSkillNameRules, createSkillDescriptionRules } from "@/hooks/use-form-validation"
import { featureFlags } from "@/lib/feature-flags"
import type { SkillVisible } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export default function NewSkillPage() {
  const { error: showError } = useToast()
  const nameField = useField("", createSkillNameRules())
  const descriptionField = useField("", createSkillDescriptionRules())
  const [visible, setVisible] = useState<SkillVisible>("private")
  const [skillUuid, setSkillUuid] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    nameField.validate()
    descriptionField.validate()
    if (!nameField.isValid) return

    setMessage(null)
    setCreating(true)
    try {
      const skill = await api.createSkill({
        name: nameField.value,
        description: descriptionField.value,
        visible: featureFlags.enableSkillVisibility ? visible : "private"
      })
      setSkillUuid(skill.id)
      setMessage("Skill 已创建，可以开始上传文件。")
    } catch (err) {
      showError(err instanceof Error ? err.message : "创建失败")
    } finally {
      setCreating(false)
    }
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_EXTENSIONS = [".md", ".txt", ".json", ".yaml", ".yml", ".py", ".js", ".ts"]

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !skillUuid) {
      return
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      showError(`文件大小超过限制，最大允许 ${MAX_FILE_SIZE / 1024 / 1024}MB`)
      return
    }

    // 验证文件类型
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      showError(`不支持的文件类型，允许: ${ALLOWED_EXTENSIONS.join(", ")}`)
      return
    }

    setUploading(true)
    try {
      const result = await api.uploadSkillFile(skillUuid, file)
      setFiles((prev) => [...prev, result.filename])
    } catch (err) {
      showError(err instanceof Error ? err.message : "上传失败")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">创建 Skill</h1>
          <p className="text-sm text-muted-foreground">定义新的 Skill 并上传 SKILL.md 与参考文件。</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/skills">返回列表</Link>
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>基础信息</CardTitle>
            <CardDescription>名称与描述将用于 MCP 工具的元数据。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Skill 名称</Label>
                <Input
                  id="name"
                  placeholder="例如：pdf"
                  value={nameField.value}
                  onChange={(event) => nameField.setValue(event.target.value)}
                  onBlur={nameField.handleBlur}
                />
                {nameField.error && <p className="text-sm text-destructive">{nameField.error}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  placeholder="简要说明 Skill 的用途"
                  value={descriptionField.value}
                  onChange={(event) => descriptionField.setValue(event.target.value)}
                  onBlur={descriptionField.handleBlur}
                />
                {descriptionField.error && <p className="text-sm text-destructive">{descriptionField.error}</p>}
              </div>
              {featureFlags.enableSkillVisibility && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="visible">可见性</Label>
                  <Select value={visible} onValueChange={(value) => setVisible(value as SkillVisible)}>
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
              <Button type="submit" disabled={creating}>
                {creating ? "创建中..." : "创建 Skill"}
              </Button>
              {message ? <p className="text-sm text-primary">{message}</p> : null}
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>上传文件</CardTitle>
            <CardDescription>支持 SKILL.md 与 reference.md 等文件。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4">
              <UploadCloud className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p>创建 Skill 后即可上传文件。</p>
                <p>系统将自动存储在你的私有目录。</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="file">选择文件</Label>
              <Input id="file" type="file" onChange={handleUpload} disabled={!skillUuid || uploading} />
            </div>
            {uploading ? <p className="text-sm text-muted-foreground">正在上传...</p> : null}
            {files.length > 0 ? (
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 text-foreground">
                  <FileUp className="h-4 w-4" />
                  已上传文件
                </p>
                <ul className="flex flex-col gap-1">
                  {files.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
