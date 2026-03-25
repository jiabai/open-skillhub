"use client"

import { useEffect, useState } from "react"
import { Copy, KeyRound, Loader2, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import { useField, createTokenNameRules } from "@/hooks/use-form-validation"
import type { Token } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function TokensPage() {
  const { success, error: showError } = useToast()
  const [tokens, setTokens] = useState<Token[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const nameField = useField("", createTokenNameRules())
  const [days, setDays] = useState("30")
  const [newToken, setNewToken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const loadTokens = async () => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.listTokens()
      setTokens(data.items)
      setStatus("ready")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "加载失败")
    }
  }

  useEffect(() => {
    loadTokens()
  }, [])

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    nameField.validate()
    if (!nameField.isValid) return

    setCreating(true)
    try {
      const expiresAt = days ? new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString() : null
      const token = await api.createToken({ name: nameField.value, expires_at: expiresAt || undefined })
      setNewToken(token.token || null)
      nameField.reset()
      setDays("30")
      await loadTokens()
      success("Token 创建成功", { description: "请保存好您的 Token，它只会显示一次" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建失败"
      setError(message)
      showError("创建失败", { description: message })
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (tokenId: string) => {
    try {
      await api.revokeToken(tokenId)
      await loadTokens()
      success("Token 已撤销")
    } catch (err) {
      const message = err instanceof Error ? err.message : "撤销失败"
      setError(message)
      showError("撤销失败", { description: message })
    }
  }

  const handleCopy = async () => {
    if (!newToken) {
      return
    }
    await navigator.clipboard.writeText(newToken)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">API Tokens</h1>
          <p className="text-sm text-muted-foreground">管理 MCP API Token，仅创建时展示明文。</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>创建 Token</CardTitle>
            <CardDescription>为 MCP 访问生成新的凭证。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Token 名称</Label>
                <Input
                  id="name"
                  placeholder="例如：prod-client"
                  value={nameField.value}
                  onChange={(event) => nameField.setValue(event.target.value)}
                  onBlur={nameField.handleBlur}
                />
                {nameField.error && <p className="text-sm text-destructive">{nameField.error}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="days">有效天数</Label>
                <Input
                  id="days"
                  type="number"
                  min="1"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "创建中..." : "创建 Token"}
              </Button>
            </form>
            {newToken ? (
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <KeyRound className="h-4 w-4 text-primary" />
                    新 Token 仅展示一次
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                    复制
                  </Button>
                </div>
                <Textarea className="mt-3 text-xs" value={newToken} readOnly />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Token 列表</CardTitle>
            <CardDescription>管理已创建的 Token。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {status === "loading" ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在加载
              </div>
            ) : null}
            {status === "error" ? <p className="text-sm text-destructive">{error}</p> : null}
            {status === "ready" && tokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无 Token。</p>
            ) : null}
            {tokens.map((token) => {
              // 计算 Token 状态
              const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false
              const isRevoked = !token.is_active
              const isActive = token.is_active && !isExpired

              return (
                <div key={token.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">{token.name}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="muted">id: {token.id.slice(0, 8)}</Badge>
                      <Badge variant={isActive ? "accent" : isExpired ? "outline" : "muted"}>
                        {isActive ? "活跃" : isExpired ? "已过期" : "已撤销"}
                      </Badge>
                      {token.expires_at && <Badge variant="outline">到期：{token.expires_at.slice(0, 10)}</Badge>}
                      {token.last_used_at && <Badge variant="outline">最后使用：{token.last_used_at.slice(0, 10)}</Badge>}
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
                        <AlertDialogTitle>撤销 Token？</AlertDialogTitle>
                        <AlertDialogDescription>撤销后该 Token 将无法访问 MCP 服务。</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRevoke(token.id)}>确认撤销</AlertDialogAction>
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
  )
}
