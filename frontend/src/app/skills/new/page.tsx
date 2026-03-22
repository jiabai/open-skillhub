"use client"

import { useState } from "react"
import Link from "next/link"
import { FileUp, UploadCloud } from "lucide-react"

import { api } from "@/lib/api"
import { featureFlags } from "@/lib/feature-flags"
import type { SkillVisible } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export default function NewSkillPage() {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [visible, setVisible] = useState<SkillVisible>("private")
  const [skillUuid, setSkillUuid] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    const skill = await api.createSkill({
      name,
      description,
      visible: featureFlags.enableSkillVisibility ? visible : "private"
    })
    setSkillUuid(skill.id)
    setMessage("Skill 已创建，可以开始上传文件。")
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !skillUuid) {
      return
    }
    setUploading(true)
    try {
      const result = await api.uploadSkillFile(skillUuid, file)
      setFiles((prev) => [...prev, result.filename])
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
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
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Skill 名称</Label>
                <Input
                  id="name"
                  placeholder="例如：pdf"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  placeholder="简要说明 Skill 的用途"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              {featureFlags.enableSkillVisibility && (
                <div className="space-y-2">
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
              <Button type="submit">创建 Skill</Button>
              {message ? <p className="text-sm text-primary">{message}</p> : null}
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>上传文件</CardTitle>
            <CardDescription>支持 SKILL.md 与 reference.md 等文件。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4">
              <UploadCloud className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>创建 Skill 后即可上传文件。</p>
                <p>系统将自动存储在你的私有目录。</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">选择文件</Label>
              <Input id="file" type="file" onChange={handleUpload} disabled={!skillUuid || uploading} />
            </div>
            {uploading ? <p className="text-sm text-muted-foreground">正在上传...</p> : null}
            {files.length > 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2 text-foreground">
                  <FileUp className="h-4 w-4" />
                  已上传文件
                </p>
                <ul className="space-y-1">
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
