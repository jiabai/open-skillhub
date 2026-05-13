"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, Download, KeyRound, Laptop, Loader2, Trash2 } from "lucide-react"

import { NextStepCard } from "@/components/app/next-step-card"
import { PageIntro } from "@/components/app/page-intro"
import { WorkspaceBoundaryNote } from "@/components/app/workspace-boundary-note"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { copyTextToClipboard } from "@/lib/clipboard"
import { api } from "@/lib/api"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import { createTokenNameRules, useField } from "@/hooks/use-form-validation"
import type { Token } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"

export default function TokensPage() {
  const { config } = useRuntimeConfig()
  const { success, error: showError } = useToast()
  const { dictionary } = useI18n()
  const { tokens: copy, validation } = dictionary
  const desktopVersion = useMemo(() => {
    const url = config.capabilities.desktop_release_url
    if (!url) return ""
    const match = url.match(/\/tag\/(v[\d.]+)$/)
    return match ? match[1] : ""
  }, [config.capabilities.desktop_release_url])
  const [tokens, setTokens] = useState<Token[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const nameField = useField<string>(
    "",
    createTokenNameRules({
      minLength: validation.tokenNameRequired,
      maxLength: validation.tokenNameMaxLength,
    })
  )
  const [days, setDays] = useState("30")
  const [newToken, setNewToken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const rbacEnabled = config.capabilities.rbac

  const loadTokens = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.listTokens()
      setTokens(data.items)
      setStatus("ready")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : copy.loadFailed)
    }
  }, [copy.loadFailed])

  useEffect(() => {
    loadTokens()
  }, [loadTokens])

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    nameField.validate()
    if (!nameField.value.trim()) return

    setCreating(true)
    try {
      const expiresAt = days ? new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString() : null
      const token = await api.createToken({ name: nameField.value, expires_at: expiresAt || undefined })
      setNewToken(token.token || null)
      nameField.reset()
      setDays("30")
      await loadTokens()
      success(copy.createSuccessTitle, { description: copy.createSuccessDescription })
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.createFailedTitle
      setError(message)
      showError(copy.createFailedTitle, { description: message })
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (tokenId: string) => {
    try {
      await api.revokeToken(tokenId)
      await loadTokens()
      success(copy.revokeSuccess)
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.revokeFailedTitle
      setError(message)
      showError(copy.revokeFailedTitle, { description: message })
    }
  }

  const handleCopy = async () => {
    if (!newToken) return

    try {
      await copyTextToClipboard(newToken)
      success(copy.copySuccessTitle, { description: copy.copySuccessDescription })
    } catch {
      showError(copy.copyFailedTitle, { description: copy.copyFailedDescription })
    }
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <PageIntro
        title={copy.title}
        summary={rbacEnabled ? copy.summaryGoverned : copy.summaryPersonal}
      />
      <WorkspaceBoundaryNote rbacEnabled={rbacEnabled} />

      {newToken ? (
        <NextStepCard
          title={copy.nextStepTitle}
          description={copy.nextStepDescription}
          href="/tokens"
          actionLabel={copy.nextStepAction}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.createTitle}</CardTitle>
            <CardDescription>{copy.createDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{copy.tokenNameLabel}</Label>
                <Input id="name" placeholder={copy.tokenNamePlaceholder} value={nameField.value} onChange={(event) => nameField.setValue(event.target.value)} onBlur={nameField.handleBlur} />
                {nameField.error ? <p className="text-sm text-destructive">{nameField.error}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="days">{copy.validForDaysLabel}</Label>
                <Input id="days" type="number" min="1" value={days} onChange={(event) => setDays(event.target.value)} />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? copy.createLoading : copy.createAction}
              </Button>
            </form>
            {newToken ? (
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <KeyRound className="h-4 w-4 text-primary" />
                    {copy.newTokenShownOnlyOnce}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                    {copy.copy}
                  </Button>
                </div>
                <Textarea className="mt-3 text-xs" value={newToken} readOnly />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{copy.connectClientTitle}</CardTitle>
              <CardDescription>{copy.connectClientDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{copy.connectStepOne}</p>
              <p>{copy.connectStepTwo}</p>
              <p>{copy.connectStepThree}</p>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-primary">
                    <Laptop className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{copy.desktopDownloadTitle}</p>
                    <p className="mt-1 text-muted-foreground">{formatMessage(copy.desktopDownloadDescription, { version: desktopVersion })}</p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <a href={config.capabilities.desktop_release_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {formatMessage(copy.downloadWindowsDesktop, { version: desktopVersion })}
                  </a>
                </Button>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-primary">
                    <Laptop className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{copy.desktopDownloadTitleMacOS}</p>
                    <p className="mt-1 text-muted-foreground">{formatMessage(copy.desktopDownloadDescriptionMacOS, { version: desktopVersion })}</p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <a href={config.capabilities.desktop_release_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {formatMessage(copy.downloadMacOSDesktop, { version: desktopVersion })}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{copy.tokenListTitle}</CardTitle>
              <CardDescription>{copy.tokenListDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {status === "loading" ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.loading}
                </div>
              ) : null}
              {status === "error" ? <p className="text-sm text-destructive">{error}</p> : null}
              {status === "ready" && tokens.length === 0 ? <p className="text-sm text-muted-foreground">{copy.empty}</p> : null}
              {tokens.map((token) => {
                const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false
                const isActive = token.is_active && !isExpired

                return (
                  <div key={token.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">{token.name}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="muted">id: {token.id.slice(0, 8)}</Badge>
                        <Badge variant={isActive ? "accent" : isExpired ? "outline" : "muted"}>
                          {isActive ? copy.active : isExpired ? copy.expired : copy.revoked}
                        </Badge>
                        {token.expires_at ? <Badge variant="outline">{formatMessage(copy.expiresOn, { date: token.expires_at.slice(0, 10) })}</Badge> : null}
                        {token.last_used_at ? <Badge variant="outline">{formatMessage(copy.lastUsedOn, { date: token.last_used_at.slice(0, 10) })}</Badge> : null}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{copy.revokeTitle}</AlertDialogTitle>
                          <AlertDialogDescription>{copy.revokeDescription}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRevoke(token.id)}>{copy.revoke}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
