"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Download, FileJson, FileSpreadsheet, Filter, ChevronDown, ChevronUp, User } from "lucide-react"

import { api } from "@/lib/api"
import type { AuditLogItem } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

// 常见操作类型选项
const ACTION_OPTIONS = [
  { value: "", label: "全部操作" },
  { value: "skill.create", label: "创建 Skill" },
  { value: "skill.update", label: "更新 Skill" },
  { value: "skill.delete", label: "删除 Skill" },
  { value: "skill.version.rollback", label: "回滚版本" },
  { value: "token.create", label: "创建 Token" },
  { value: "token.revoke", label: "撤销 Token" },
  { value: "user.login", label: "用户登录" },
  { value: "user.logout", label: "用户登出" },
  { value: "user.update", label: "更新用户信息" },
  { value: "user.delete", label: "删除账户" },
]

export default function AuditLogsPage() {
  // 筛选状态
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [action, setAction] = useState("")
  const [actorId, setActorId] = useState("")

  // 数据状态
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // 展开状态
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  // 加载日志
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: { start?: string; end?: string; action?: string; actor_id?: string } = {}
      if (startDate) params.start = new Date(startDate).toISOString()
      if (endDate) params.end = new Date(endDate).toISOString()
      if (action) params.action = action
      if (actorId) params.actor_id = actorId

      const response = await api.listAuditLogs(params)
      setLogs(response.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载日志失败")
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, action, actorId])

  // 初始加载（最近 7 天）
  useEffect(() => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const start = format(sevenDaysAgo, "yyyy-MM-dd")
    const end = format(new Date(), "yyyy-MM-dd")
    setStartDate(start)
    setEndDate(end)
    // 自动加载数据
    fetchLogs()
  }, [fetchLogs])

  // 应用筛选
  const handleApplyFilter = () => {
    fetchLogs()
  }

  // 导出日志
  const handleExport = async (formatType: "json" | "csv") => {
    setExporting(true)
    try {
      const payload = {
        format: formatType,
        filters: {
          ...(startDate && { start: new Date(startDate).toISOString() }),
          ...(endDate && { end: new Date(endDate).toISOString() }),
          ...(action && { action }),
          ...(actorId && { actor_id: actorId }),
        },
      }
      const result = await api.exportAuditLogs(payload)

      // 创建下载
      const blob = new Blob([result.content], {
        type: formatType === "json" ? "application/json" : "text/csv",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `audit-logs-${format(new Date(), "yyyyMMdd-HHmmss")}.${formatType}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败")
    } finally {
      setExporting(false)
    }
  }

  // 切换展开
  const toggleExpand = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

  // 渲染日志列表
  const renderLogList = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )
    }

    if (error) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchLogs}>
              重试
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (logs.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Filter className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无日志记录</p>
            <p className="text-xs text-muted-foreground mt-1">调整筛选条件查看更多</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-3">
        {logs.map((log) => (
          <Collapsible
            key={log.id}
            open={expandedLogs.has(log.id)}
            onOpenChange={() => toggleExpand(log.id)}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss", { locale: zhCN })}
                      </span>
                      <Badge variant={log.result === "success" ? "accent" : "destructive"}>
                        {log.result === "success" ? "成功" : "失败"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">{log.actor_id.slice(0, 8)}</span>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="text-xs">
                        {log.action}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-sm text-muted-foreground truncate">{log.target}</span>
                    </div>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {expandedLogs.has(log.id) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">IP 地址</Label>
                        <p className="text-sm">{log.ip}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">User Agent</Label>
                        <p className="text-sm text-muted-foreground truncate">{log.user_agent}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">详细信息</Label>
                      <pre className="mt-1 text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">审计日志</h1>
        <p className="text-sm text-muted-foreground">查看系统操作记录</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* 左侧筛选面板 */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              筛选条件
            </CardTitle>
            <CardDescription>设置时间范围和操作类型</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">开始日期</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">结束日期</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">操作类型</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="选择操作类型" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="actor-id">操作者 ID</Label>
              <Input
                id="actor-id"
                placeholder="输入用户 ID"
                value={actorId}
                onChange={(e) => setActorId(e.target.value)}
              />
            </div>
            <Button onClick={handleApplyFilter} className="w-full">
              <Filter className="mr-2 h-4 w-4" />
              应用筛选
            </Button>

            <div className="pt-4 border-t space-y-2">
              <p className="text-sm font-medium">导出日志</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleExport("json")}
                  disabled={exporting}
                >
                  <FileJson className="mr-2 h-4 w-4" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleExport("csv")}
                  disabled={exporting}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </div>
              {exporting && (
                <p className="text-xs text-muted-foreground">导出中...</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右侧日志列表 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 {logs.length} 条记录
            </p>
          </div>
          {renderLogList()}
        </div>
      </div>
    </div>
  )
}
