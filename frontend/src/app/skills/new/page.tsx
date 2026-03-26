"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { UploadCloud, FileArchive, CheckCircle2, Loader2, AlertCircle } from "lucide-react"

import { api } from "@/lib/api"
import { featureFlags } from "@/lib/feature-flags"
import type { SkillVisible } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

type UploadState = "idle" | "dragover" | "uploading" | "success" | "error"

export default function NewSkillPage() {
  const router = useRouter()
  const { error: showError, success } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [visibility, setVisibility] = useState<SkillVisible>("private")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [createdSkill, setCreatedSkill] = useState<{
    id: string
    name: string
    description: string
    version: string
  } | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadState("dragover")
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (uploadState === "dragover") {
      setUploadState("idle")
    }
  }, [uploadState])

  const validateFile = useCallback((file: File): string | null => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return "请上传 ZIP 格式的文件"
    }
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return "文件大小不能超过 50MB"
    }
    return null
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadState("idle")

    const files = e.dataTransfer.files
    if (files.length === 0) return

    const file = files[0]
    const validationError = validateFile(file)
    if (validationError) {
      showError(validationError)
      return
    }

    setSelectedFile(file)
    setErrorMessage(null)
    setCreatedSkill(null)
  }, [validateFile, showError])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const validationError = validateFile(file)
    if (validationError) {
      showError(validationError)
      return
    }

    setSelectedFile(file)
    setErrorMessage(null)
    setCreatedSkill(null)
  }, [validateFile, showError])

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploadState("uploading")
    setProgress(0)
    setErrorMessage(null)

    try {
      const result = await api.uploadSkillZip(
        selectedFile,
        featureFlags.enableSkillVisibility ? visibility : undefined,
        (p) => setProgress(p)
      )

      setCreatedSkill({
        id: result.id,
        name: result.name,
        description: result.description,
        version: result.version,
      })
      setUploadState("success")
      success(`Skill "${result.name}" 创建成功！`)

      setTimeout(() => {
        router.push(`/skills/${result.id}`)
      }, 1500)
    } catch (err) {
      setUploadState("error")
      setErrorMessage(err instanceof Error ? err.message : "上传失败，请重试")
    }
  }

  const handleReset = () => {
    setUploadState("idle")
    setProgress(0)
    setSelectedFile(null)
    setErrorMessage(null)
    setCreatedSkill(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div>
        <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">上传 Skill</h1>
        <p className="text-sm 3xl:text-base text-muted-foreground">
          上传包含 SKILL.md 的 ZIP 包，系统将自动解析并创建 Skill
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] 3xl:gap-8 4k:gap-10">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            {/* 拖拽上传区域 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !selectedFile && fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center
                min-h-[320px] 3xl:min-h-[400px] 4k:min-h-[480px]
                rounded-xl border-2 border-dashed cursor-pointer
                transition-all duration-300 ease-out
                ${uploadState === "dragover"
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : uploadState === "success"
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : uploadState === "error"
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* 空闲状态 */}
              {uploadState === "idle" && !selectedFile && (
                <div className="flex flex-col items-center gap-4 text-center px-4">
                  <div className="relative">
                    <UploadCloud className="size-16 text-muted-foreground/50" />
                    <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-xl" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">拖拽 ZIP 文件到此处</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      或点击选择文件
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 rounded-md bg-muted">.zip</span>
                    <span className="px-2 py-1 rounded-md bg-muted">最大 50MB</span>
                    <span className="px-2 py-1 rounded-md bg-muted">需包含 SKILL.md</span>
                  </div>
                </div>
              )}

              {/* 已选择文件 */}
              {uploadState === "idle" && selectedFile && (
                <div className="flex flex-col items-center gap-4 text-center px-4">
                  <FileArchive className="size-16 text-primary" />
                  <div>
                    <p className="text-lg font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpload} size="lg">
                      <UploadCloud className="mr-2 size-4" />
                      开始上传
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      重新选择
                    </Button>
                  </div>
                </div>
              )}

              {/* 上传中 */}
              {uploadState === "uploading" && (
                <div className="flex flex-col items-center gap-4 text-center px-4 w-full max-w-md">
                  <Loader2 className="size-16 text-primary animate-spin" />
                  <div className="w-full space-y-2">
                    <p className="text-lg font-medium">正在上传...</p>
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground">{progress}%</p>
                  </div>
                </div>
              )}

              {/* 成功状态 */}
              {uploadState === "success" && createdSkill && (
                <div className="flex flex-col items-center gap-4 text-center px-4">
                  <CheckCircle2 className="size-16 text-emerald-500" />
                  <div>
                    <p className="text-lg font-medium text-emerald-600">上传成功！</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      正在跳转到 Skill 详情页...
                    </p>
                  </div>
                  <Card className="w-full max-w-sm mt-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{createdSkill.name}</CardTitle>
                      <CardDescription className="text-xs">
                        版本 {createdSkill.version}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {createdSkill.description || "无描述"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 错误状态 */}
              {uploadState === "error" && (
                <div className="flex flex-col items-center gap-4 text-center px-4">
                  <AlertCircle className="size-16 text-destructive" />
                  <div>
                    <p className="text-lg font-medium text-destructive">上传失败</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {errorMessage}
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleReset}>
                    重新上传
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右侧配置面板 */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">上传配置</CardTitle>
              <CardDescription>设置 Skill 的可见性</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {featureFlags.enableSkillVisibility ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="visibility">可见性</Label>
                  <Select
                    value={visibility}
                    onValueChange={(v) => setVisibility(v as SkillVisible)}
                    disabled={uploadState === "uploading"}
                  >
                    <SelectTrigger id="visibility">
                      <SelectValue />
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
              ) : (
                <p className="text-sm text-muted-foreground">
                  可见性设置已禁用，所有 Skill 默认为私有
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ZIP 包要求</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>必须包含 <code className="px-1 py-0.5 rounded bg-muted text-xs">SKILL.md</code> 文件</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>SKILL.md 需包含 frontmatter 元数据</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>name 字段为必填项</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>支持 requirements.txt、package.json 等依赖文件</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SKILL.md 示例</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`---
name: my-skill
description: A sample skill
version: 1.0.0
dependencies:
  - requests>=2.28.0
---

# My Skill

Skill description here...`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
