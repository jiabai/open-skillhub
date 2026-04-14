"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ChevronDown, ChevronUp, Download, FileJson, FileSpreadsheet, Filter, User } from "lucide-react"

import { api } from "@/lib/api"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import type { AuditLogItem } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getDateFnsLocale } from "@/i18n/date-fns"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"

type AuditLogFilters = {
  startDate?: string
  endDate?: string
  action?: string
  actorId?: string
}

export default function AuditLogsPage() {
  const { config } = useRuntimeConfig()
  const { dictionary, locale } = useI18n()
  const { audit } = dictionary
  const dateLocale = getDateFnsLocale(locale)
  const actionOptions = useMemo(
    () => [
      { value: "all", label: audit.actionAll },
      { value: "skill.create", label: audit.actionSkillCreate },
      { value: "skill.update", label: audit.actionSkillUpdate },
      { value: "skill.delete", label: audit.actionSkillDelete },
      { value: "skill.version.rollback", label: audit.actionSkillRollback },
      { value: "token.create", label: audit.actionTokenCreate },
      { value: "token.revoke", label: audit.actionTokenRevoke },
      { value: "user.login", label: audit.actionUserLogin },
      { value: "user.logout", label: audit.actionUserLogout },
      { value: "user.update", label: audit.actionUserUpdate },
      { value: "user.delete", label: audit.actionUserDelete },
    ],
    [audit]
  )
  const [defaultDateRange] = useState(() => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    return {
      startDate: format(sevenDaysAgo, "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    }
  })
  const [startDate, setStartDate] = useState(defaultDateRange.startDate)
  const [endDate, setEndDate] = useState(defaultDateRange.endDate)
  const [action, setAction] = useState("all")
  const [actorId, setActorId] = useState("")
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  const fetchLogsWithFilters = useCallback(async ({ startDate, endDate, action, actorId }: AuditLogFilters = {}) => {
    setLoading(true)
    setError(null)
    try {
      const params: { start?: string; end?: string; action?: string; actor_id?: string } = {}
      if (startDate) params.start = new Date(startDate).toISOString()
      if (endDate) params.end = new Date(endDate).toISOString()
      if (action && action !== "all") params.action = action
      if (actorId) params.actor_id = actorId

      const response = await api.listAuditLogs(params)
      setLogs(response.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : audit.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [audit.loadFailed])

  const fetchLogs = useCallback(async () => {
    await fetchLogsWithFilters({ startDate, endDate, action, actorId })
  }, [action, actorId, endDate, fetchLogsWithFilters, startDate])

  useEffect(() => {
    void fetchLogsWithFilters({
      startDate: defaultDateRange.startDate,
      endDate: defaultDateRange.endDate,
      action: "all",
      actorId: "",
    })
  }, [defaultDateRange, fetchLogsWithFilters])

  const handleExport = async (formatType: "json" | "csv") => {
    setExporting(true)
    try {
      const payload = {
        format: formatType,
        filters: {
          ...(startDate && { start: new Date(startDate).toISOString() }),
          ...(endDate && { end: new Date(endDate).toISOString() }),
          ...(action && action !== "all" && { action }),
          ...(actorId && { actor_id: actorId }),
        },
      }
      const result = await api.exportAuditLogs(payload)
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
      setError(err instanceof Error ? err.message : audit.exportFailed)
    } finally {
      setExporting(false)
    }
  }

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

  const renderLogList = () => {
    if (loading) {
      return (
        <div className="flex flex-col gap-3">
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
              {audit.retry}
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
            <p className="text-sm text-muted-foreground">{audit.empty}</p>
            <p className="mt-1 text-xs text-muted-foreground">{audit.emptyHint}</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        {logs.map((log) => (
          <Collapsible
            key={log.id}
            open={expandedLogs.has(log.id)}
            onOpenChange={() => toggleExpand(log.id)}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss", { locale: dateLocale })}
                      </span>
                      <Badge variant={log.result === "success" ? "accent" : "destructive"}>
                        {log.result === "success" ? audit.resultSuccess : audit.resultFailure}
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
                      <span className="truncate text-sm text-muted-foreground">{log.target}</span>
                    </div>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {expandedLogs.has(log.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="mt-4 flex flex-col gap-3 border-t pt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">{audit.ipAddress}</Label>
                        <p className="text-sm">{log.ip}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{audit.userAgent}</Label>
                        <p className="truncate text-sm text-muted-foreground">{log.user_agent}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{audit.details}</Label>
                      <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
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
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div>
        <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">{audit.title}</h1>
        <p className="text-sm text-muted-foreground 3xl:text-base">{audit.summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr] 3xl:gap-8 4k:grid-cols-[360px_1fr] 4k:gap-10">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {audit.filterTitle}
            </CardTitle>
            <CardDescription>{audit.filterDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start-date">{audit.startDate}</Label>
              <Input id="start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end-date">{audit.endDate}</Label>
              <Input id="end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="action">{audit.actionType}</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="action">
                  <SelectValue placeholder={audit.actionPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="actor-id">{audit.actorId}</Label>
              <Input id="actor-id" placeholder={audit.actorIdPlaceholder} value={actorId} onChange={(event) => setActorId(event.target.value)} />
            </div>
            <Button onClick={fetchLogs} className="w-full">
              <Filter className="mr-2 h-4 w-4" />
              {audit.applyFilter}
            </Button>

            {config.capabilities.audit_export ? (
              <div className="flex flex-col gap-2 border-t pt-4">
                <p className="text-sm font-medium">{audit.exportLogs}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleExport("json")} disabled={exporting}>
                    <FileJson className="mr-2 h-4 w-4" />
                    JSON
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleExport("csv")} disabled={exporting}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                </div>
                {exporting ? <p className="text-xs text-muted-foreground">{audit.exporting}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{formatMessage(audit.totalRecords, { count: logs.length })}</p>
          </div>
          {renderLogList()}
        </div>
      </div>
    </div>
  )
}
