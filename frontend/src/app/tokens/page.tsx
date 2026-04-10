"use client"

import { useEffect, useState } from "react"
import { Copy, KeyRound, Loader2, Trash2 } from "lucide-react"

import { ModeBoundaryNote } from "@/components/app/mode-boundary-note"
import { NextStepCard } from "@/components/app/next-step-card"
import { PageIntro } from "@/components/app/page-intro"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getAppMode } from "@/lib/app-mode"
import { api } from "@/lib/api"
import { createTokenNameRules, useField } from "@/hooks/use-form-validation"
import type { Token } from "@/types"
import { useToast } from "@/hooks/use-toast"

export default function TokensPage() {
  const { success, error: showError } = useToast()
  const [tokens, setTokens] = useState<Token[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const nameField = useField<string>("", createTokenNameRules())
  const [days, setDays] = useState("30")
  const [newToken, setNewToken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const appMode = getAppMode()

  const loadTokens = async () => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.listTokens()
      setTokens(data.items)
      setStatus("ready")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to load tokens")
    }
  }

  useEffect(() => {
    loadTokens()
  }, [])

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
      success("Token created", { description: "This token is only shown once. Save it before leaving this page." })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Creation failed"
      setError(message)
      showError("Creation failed", { description: message })
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (tokenId: string) => {
    try {
      await api.revokeToken(tokenId)
      await loadTokens()
      success("Token revoked")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Revoke failed"
      setError(message)
      showError("Revoke failed", { description: message })
    }
  }

  const handleCopy = async () => {
    if (!newToken) return
    await navigator.clipboard.writeText(newToken)
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <PageIntro
        title="Tokens"
        summary={
          appMode === "no-rbac"
            ? "Create tokens when you are ready to let your own client tools access the Skills visible in your workspace."
            : "Create and manage tokens for governed access across scoped clients and automation."
        }
      />
      <ModeBoundaryNote mode={appMode} />

      {newToken ? (
        <NextStepCard
          title="Token created"
          description="Copy the token now, then use it in your MCP or other client configuration so your client can access visible Skills."
          href="/tokens"
          actionLabel="Stay on Tokens"
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create Token</CardTitle>
            <CardDescription>Generate a token for client access. Browser management and client access are separate steps.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Token name</Label>
                <Input id="name" placeholder="for example: local-mcp-client" value={nameField.value} onChange={(event) => nameField.setValue(event.target.value)} onBlur={nameField.handleBlur} />
                {nameField.error ? <p className="text-sm text-destructive">{nameField.error}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="days">Valid for days</Label>
                <Input id="days" type="number" min="1" value={days} onChange={(event) => setDays(event.target.value)} />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Token"}
              </Button>
            </form>
            {newToken ? (
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <KeyRound className="h-4 w-4 text-primary" />
                    New token shown only once
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                    Copy
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
              <CardTitle>Connect Client</CardTitle>
              <CardDescription>After creating a token, the next step is to place it in your MCP or client configuration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1. Create a token here.</p>
              <p>2. Copy it immediately because you cannot reveal it again later.</p>
              <p>3. Use it in your own client so that client can access the Skills visible in this workspace.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Token List</CardTitle>
              <CardDescription>Review active, expired, or revoked tokens.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {status === "loading" ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </div>
              ) : null}
              {status === "error" ? <p className="text-sm text-destructive">{error}</p> : null}
              {status === "ready" && tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tokens yet. Without a token, client tools cannot access the Skills visible in this workspace.
                </p>
              ) : null}
              {tokens.map((token) => {
                const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false
                const isActive = token.is_active && !isExpired

                return (
                  <div key={token.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">{token.name}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="muted">id: {token.id.slice(0, 8)}</Badge>
                        <Badge variant={isActive ? "accent" : isExpired ? "outline" : "muted"}>{isActive ? "Active" : isExpired ? "Expired" : "Revoked"}</Badge>
                        {token.expires_at ? <Badge variant="outline">Expires {token.expires_at.slice(0, 10)}</Badge> : null}
                        {token.last_used_at ? <Badge variant="outline">Last used {token.last_used_at.slice(0, 10)}</Badge> : null}
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
                          <AlertDialogTitle>Revoke token?</AlertDialogTitle>
                          <AlertDialogDescription>After revocation, this token can no longer access the service.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRevoke(token.id)}>Revoke</AlertDialogAction>
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
