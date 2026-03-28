"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Database, FileText, KeyRound, Shield, Sparkles, Trash2 } from "lucide-react"

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
      {/* 页面标题 */}
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">控制台概览</h1>
        <p className="text-muted-foreground">集中管理你的多用户 Skill 能力与访问凭证。</p>
      </div>

      {/* 错误提示 */}
      {status === "error" ? (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider">活跃 Skills</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{overview?.active_skills ?? "—"}</div>
            <Badge variant="accent" className="mt-2 text-xs">启用中</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider">可用 Tokens</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{overview?.available_tokens ?? "—"}</div>
            <Badge variant="accent" className="mt-2 text-xs">未过期</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider">工具调用成功率</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{successRateText}</div>
            <p className="mt-1 text-xs text-muted-foreground">{successRateTag}</p>
          </CardContent>
        </Card>
      </div>

      {/* 主内容区 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 快捷入口 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">快捷入口</CardTitle>
            <CardDescription>快速进入常用管理操作。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[
              { label: "Skills 列表", href: "/skills", icon: Sparkles, description: "管理私有 Skill 目录" },
              { label: "创建 Skill", href: "/skills/new", icon: FileText, description: "定义新的 Skill" },
              { label: "API Tokens", href: "/tokens", icon: KeyRound, description: "管理访问凭证" }
            ].map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </CardContent>
        </Card>

        {/* 运行提示 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">运行提示</CardTitle>
            <CardDescription>保持 MCP 服务稳定运行的建议。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-background">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">建议每日检查 /metrics</p>
                <p className="text-xs text-muted-foreground">关注数据库、磁盘与内存使用率。</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-background">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">保持 Skill 描述清晰</p>
                <p className="text-xs text-muted-foreground">可帮助 load_skill_metadata 更好地呈现。</p>
              </div>
            </div>
            {cachePolicy && (
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">缓存策略</p>
                    {cachePolicy.encryption_enabled && (
                      <Badge variant="outline" className="text-xs">加密</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    TTL: {Math.floor(cachePolicy.cache_ttl_seconds / 60)} 分钟
                    {cachePolicy.download_encryption_enabled && " · 下载加密"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 管理员操作 */}
      {isAdmin && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">管理员操作</CardTitle>
            <CardDescription>管理统计数据与系统维护。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
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
                  <Button variant="outline" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
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
                      此操作通常不影响「过去 24h 调用次数/成功率」。
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
                  <Button variant="outline" size="sm">清零过去 24h</Button>
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}