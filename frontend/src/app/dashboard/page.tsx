"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Command, Database, FileText, KeyRound, Shield, Sparkles, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import type { DashboardOverview, SkillCachePolicyResponse } from "@/types"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [cleanupStatus, setCleanupStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [retentionDays, setRetentionDays] = useState("")
  const [resetOpen, setResetOpen] = useState(false)
  const [resetStatus, setResetStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  // 缓存策略状态
  const [cachePolicy, setCachePolicy] = useState<SkillCachePolicyResponse | null>(null)

  const loadOverview = async () => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.getDashboardOverview()
      setOverview(data)
      setStatus("ready")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "加载失败")
    }
  }

  const loadUser = async () => {
    try {
      const user = await api.getMe()
      setIsAdmin(Boolean(user.is_superuser))
    } catch {
      setIsAdmin(false)
    }
  }

  const loadCachePolicy = async () => {
    try {
      const policy = await api.getSkillCachePolicy()
      setCachePolicy(policy)
    } catch {
      // 忽略错误，缓存策略不是必须的
    }
  }

  useEffect(() => {
    loadOverview()
    loadUser()
    loadCachePolicy()
  }, [])

  const handleCleanup = async () => {
    const trimmed = retentionDays.trim()
    if (trimmed) {
      const value = Number(trimmed)
      if (!Number.isFinite(value) || value < 1 || value > 3650) {
        setCleanupStatus("error")
        setCleanupError("请输入 1–3650 之间的保留天数")
        return
      }
    }
    setCleanupStatus("loading")
    setCleanupError(null)
    setCleanupMessage(null)
    try {
      const response = await api.cleanupMetrics(
        trimmed ? { retention_days: Number(trimmed) } : undefined
      )
      setCleanupStatus("done")
      setCleanupMessage(
        `已清理 ${response.removed} 条（将保留最近 ${response.retention_days} 天，cutoff=${response.cutoff}）`
      )
      await loadOverview()
    } catch (err) {
      setCleanupStatus("error")
      setCleanupError(err instanceof Error ? err.message : "清理失败")
    }
  }

  const handleReset24h = async () => {
    setResetStatus("loading")
    setResetMessage(null)
    setResetError(null)
    try {
      const response = await api.resetMetrics24h()
      setResetStatus("done")
      setResetMessage(`已清零过去 ${response.window_hours}h（removed=${response.removed}）`)
      await loadOverview()
    } catch (err) {
      setResetStatus("error")
      setResetError(err instanceof Error ? err.message : "清零失败")
    }
  }

  const successRateText =
    overview?.success_rate == null ? "—" : `${overview.success_rate.toFixed(1)}%`
  const successRateTag = overview
    ? `过去 ${overview.success_rate_window_hours}h · ${overview.success_rate_total} 次`
    : "过去 24h"

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">控制台概览</h1>
          <p className="text-sm text-muted-foreground">集中管理你的多用户 Skill 能力与访问凭证。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/skills/new">创建 Skill</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tokens">管理 Token</Link>
          </Button>
          {isAdmin ? (
            <>
              <AlertDialog
                open={cleanupOpen}
                onOpenChange={(open) => {
                  setCleanupOpen(open)
                  if (!open) {
                    setCleanupStatus("idle")
                    setCleanupMessage(null)
                    setCleanupError(null)
                    setRetentionDays("")
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <Trash2 className="h-4 w-4" />
                    清理历史统计
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>清理历史调用统计</AlertDialogTitle>
                    <AlertDialogDescription>
                      删除早于 cutoff 的小时桶记录。仅管理员可执行；留空使用服务端默认保留天数。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="retention-days">保留最近 N 天</Label>
                    <Input
                      id="retention-days"
                      inputMode="numeric"
                      placeholder="留空使用默认（例如 90）"
                      value={retentionDays}
                      onChange={(event) => setRetentionDays(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      此操作通常不影响“过去 24h 调用次数/成功率”。若将 N 设为 1，可能影响窗口边界的小时桶。
                    </p>
                  </div>
                  {cleanupStatus === "done" && cleanupMessage ? (
                    <p className="text-sm text-primary">{cleanupMessage}</p>
                  ) : null}
                  {cleanupStatus === "error" && cleanupError ? (
                    <p className="text-sm text-destructive">{cleanupError}</p>
                  ) : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCleanup}>
                      {cleanupStatus === "loading" ? "清理中..." : "确认清理"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog
                open={resetOpen}
                onOpenChange={(open) => {
                  setResetOpen(open)
                  if (!open) {
                    setResetStatus("idle")
                    setResetMessage(null)
                    setResetError(null)
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="outline">清零过去 24h</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>清零过去 24h 调用统计</AlertDialogTitle>
                    <AlertDialogDescription>
                      仅清零你账号的过去 24h 窗口（不影响更早的历史统计）。确认后会刷新概览。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {resetStatus === "done" && resetMessage ? (
                    <p className="text-sm text-primary">{resetMessage}</p>
                  ) : null}
                  {resetStatus === "error" && resetError ? (
                    <p className="text-sm text-destructive">{resetError}</p>
                  ) : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset24h}>
                      {resetStatus === "loading" ? "清零中..." : "确认清零"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : null}
        </div>
      </div>
      {status === "error" ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "活跃 Skills", value: overview ? String(overview.active_skills) : "—", tag: "启用中" },
          { title: "可用 Tokens", value: overview ? String(overview.available_tokens) : "—", tag: "未过期" },
          { title: "工具调用成功率", value: successRateText, tag: successRateTag }
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardDescription>{item.title}</CardDescription>
              <CardTitle className="text-3xl">{item.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="accent">{item.tag}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>快捷入口</CardTitle>
            <CardDescription>快速进入常用管理操作。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              { label: "Skills 列表", href: "/skills", icon: Sparkles },
              { label: "上传参考文件", href: "/skills/new", icon: FileText },
              { label: "创建 Token", href: "/tokens", icon: KeyRound }
            ].map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground transition hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>运行提示</CardTitle>
            <CardDescription>保持 MCP 服务稳定运行的建议。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
              <Command className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-foreground">建议每日检查 /metrics</p>
                <p>关注数据库、磁盘与内存使用率。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-foreground">保持 Skill 描述清晰</p>
                <p>可帮助 load_skill_metadata 更好地呈现。</p>
              </div>
            </div>
            {/* 缓存策略信息 */}
            {cachePolicy && (
              <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
                <Database className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-foreground flex items-center gap-2">
                    缓存策略
                    {cachePolicy.encryption_enabled && (
                      <Badge variant="outline" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        加密
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs mt-1">
                    TTL: {Math.floor(cachePolicy.cache_ttl_seconds / 60)} 分钟
                    {cachePolicy.download_encryption_enabled && " · 下载加密"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
