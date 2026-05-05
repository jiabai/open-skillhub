"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, FileArchive, Loader2, UploadCloud } from "lucide-react"

import { api } from "@/lib/api"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import {
  DEFAULT_SKILL_VISIBILITY,
  WRITABLE_SKILL_VISIBILITY_VALUES,
  getSkillVisibilityLabel,
  type WritableSkillVisible,
} from "@/lib/skill-visibility"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"

type UploadState = "idle" | "dragover" | "uploading" | "success" | "error"

export default function NewSkillPage() {
  const { config } = useRuntimeConfig()
  const router = useRouter()
  const { error: showError, success } = useToast()
  const { dictionary } = useI18n()
  const { newSkill } = dictionary
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [visibility, setVisibility] = useState<WritableSkillVisible>(DEFAULT_SKILL_VISIBILITY)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [createdSkill, setCreatedSkill] = useState<{
    id: string
    name: string
    description: string
    version: string
  } | null>(null)

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setUploadState("dragover")
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (uploadState === "dragover") {
      setUploadState("idle")
    }
  }, [uploadState])

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        return newSkill.invalidZip
      }
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        return newSkill.fileTooLarge
      }
      return null
    },
    [newSkill.fileTooLarge, newSkill.invalidZip]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setUploadState("idle")

      const files = event.dataTransfer.files
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
    },
    [showError, validateFile]
  )

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
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
    },
    [showError, validateFile]
  )

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploadState("uploading")
    setProgress(0)
    setErrorMessage(null)

    try {
      const result = await api.uploadSkillZip(
        selectedFile,
        config.capabilities.skill_visibility ? visibility : undefined,
        (currentProgress) => setProgress(currentProgress)
      )

      setCreatedSkill({
        id: result.id,
        name: result.name,
        description: result.description,
        version: result.version,
      })
      setUploadState("success")
      success(formatMessage(newSkill.uploadSuccess, { name: result.name }))

      setTimeout(() => {
        router.push(`/skills/${result.id}`)
      }, 1500)
    } catch (err) {
      setUploadState("error")
      setErrorMessage(err instanceof Error ? err.message : newSkill.uploadFailed)
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
        <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">{newSkill.title}</h1>
        <p className="text-sm text-muted-foreground 3xl:text-base">{newSkill.summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] 3xl:gap-8 4k:gap-10">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !selectedFile && fileInputRef.current?.click()}
              className={`
                relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed
                transition-all duration-300 ease-out 3xl:min-h-[400px] 4k:min-h-[480px]
                ${
                  uploadState === "dragover"
                    ? "scale-[1.02] border-primary bg-primary/5"
                    : uploadState === "success"
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : uploadState === "error"
                        ? "border-destructive/50 bg-destructive/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                }
              `}
            >
              <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileSelect} className="hidden" />

              {uploadState === "idle" && !selectedFile ? (
                <div className="flex flex-col items-center gap-4 px-4 text-center">
                  <div className="relative">
                    <UploadCloud className="size-16 text-muted-foreground/50" />
                    <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-xl" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">{newSkill.uploadAreaTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{newSkill.uploadAreaSubtitle}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-2 py-1">.zip</span>
                    <span className="rounded-md bg-muted px-2 py-1">{newSkill.maxSize}</span>
                    <span className="rounded-md bg-muted px-2 py-1">{newSkill.mustContainSkillMd}</span>
                  </div>
                </div>
              ) : null}

              {uploadState === "idle" && selectedFile ? (
                <div className="flex flex-col items-center gap-4 px-4 text-center">
                  <FileArchive className="size-16 text-primary" />
                  <div>
                    <p className="text-lg font-medium">{selectedFile.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpload} size="lg">
                      <UploadCloud className="mr-2 size-4" />
                      {newSkill.startUpload}
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      {newSkill.chooseAgain}
                    </Button>
                  </div>
                </div>
              ) : null}

              {uploadState === "uploading" ? (
                <div className="flex w-full max-w-md flex-col items-center gap-4 px-4 text-center">
                  <Loader2 className="size-16 animate-spin text-primary" />
                  <div className="w-full space-y-2">
                    <p className="text-lg font-medium">{newSkill.uploading}</p>
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground">{progress}%</p>
                  </div>
                </div>
              ) : null}

              {uploadState === "success" && createdSkill ? (
                <div className="flex flex-col items-center gap-4 px-4 text-center">
                  <CheckCircle2 className="size-16 text-emerald-500" />
                  <div>
                    <p className="text-lg font-medium text-emerald-600">{newSkill.uploadDone}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{newSkill.redirecting}</p>
                  </div>
                  <Card className="mt-2 w-full max-w-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{createdSkill.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {formatMessage(newSkill.versionLabel, { version: createdSkill.version })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {createdSkill.description || newSkill.noDescription}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {uploadState === "error" ? (
                <div className="flex flex-col items-center gap-4 px-4 text-center">
                  <AlertCircle className="size-16 text-destructive" />
                  <div>
                    <p className="text-lg font-medium text-destructive">{newSkill.uploadErrorTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
                  </div>
                  <Button variant="outline" onClick={handleReset}>
                    {newSkill.uploadAgain}
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{newSkill.uploadConfigTitle}</CardTitle>
              <CardDescription>{newSkill.uploadConfigDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {config.capabilities.skill_visibility ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="visibility">{newSkill.visibilityLabel}</Label>
                  <Select value={visibility} onValueChange={(value) => setVisibility(value as WritableSkillVisible)} disabled={uploadState === "uploading"}>
                    <SelectTrigger id="visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WRITABLE_SKILL_VISIBILITY_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {getSkillVisibilityLabel(value, newSkill)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{newSkill.visibilityHelp}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{newSkill.visibilityDisabled}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{newSkill.zipRequirementsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{newSkill.requirementSkillMd}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{newSkill.requirementFrontmatter}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{newSkill.requirementName}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{newSkill.requirementDependencies}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{newSkill.exampleTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
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
