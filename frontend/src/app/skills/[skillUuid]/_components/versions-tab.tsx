"use client"

import { useCallback, useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { GitCompare, Loader2, RotateCcw, Package, FileCode, Clock, ListTree } from "lucide-react"

import { api } from "@/lib/api"
import type { SkillVersion, SkillVersionDiff } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

type VersionsTabProps = {
  skillUuid: string
}

export function VersionsTab({ skillUuid }: VersionsTabProps) {
  const [versions, setVersions] = useState<SkillVersion[]>([])
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [diffResult, setDiffResult] = useState<SkillVersionDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [diffLoading, setDiffLoading] = useState(false)
  const [rollbackLoading, setRollbackLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 版本详情状态
  const [versionDetail, setVersionDetail] = useState<SkillVersion | null>(null)
  const [versionDetailLoading, setVersionDetailLoading] = useState(false)
  const [versionDetailError, setVersionDetailError] = useState<string | null>(null)

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.listSkillVersions(skillUuid)
      setVersions(response.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载版本列表失败")
    } finally {
      setLoading(false)
    }
  }, [skillUuid])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  const handleVersionSelect = useCallback((version: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version)
      }
      if (prev.length >= 2) {
        return [prev[1], version]
      }
      return [...prev, version]
    })
  }, [])

  useEffect(() => {
    const abortController = new AbortController()

    if (selectedVersions.length === 2) {
      const fetchDiff = async () => {
        setDiffLoading(true)
        try {
          const result = await api.diffSkillVersions(
            skillUuid,
            selectedVersions[0],
            selectedVersions[1]
          )
          // Check if component is still mounted
          if (!abortController.signal.aborted) {
            setDiffResult(result)
          }
        } catch (err) {
          if (!abortController.signal.aborted) {
            console.error("Failed to fetch diff:", err)
          }
        } finally {
          if (!abortController.signal.aborted) {
            setDiffLoading(false)
          }
        }
      }
      fetchDiff()
    } else {
      setDiffResult(null)
    }

    return () => abortController.abort()
  }, [selectedVersions, skillUuid])

  // 获取单个版本详情
  useEffect(() => {
    const abortController = new AbortController()

    if (selectedVersions.length === 1) {
      const fetchVersionDetail = async () => {
        setVersionDetailLoading(true)
        setVersionDetailError(null)
        try {
          const result = await api.getSkillVersion(skillUuid, selectedVersions[0])
          if (!abortController.signal.aborted) {
            setVersionDetail(result)
          }
        } catch (err) {
          if (!abortController.signal.aborted) {
            setVersionDetailError(err instanceof Error ? err.message : "获取版本详情失败")
          }
        } finally {
          if (!abortController.signal.aborted) {
            setVersionDetailLoading(false)
          }
        }
      }
      fetchVersionDetail()
    } else {
      setVersionDetail(null)
      setVersionDetailError(null)
    }

    return () => abortController.abort()
  }, [selectedVersions, skillUuid])

  const handleRollback = async (version: string) => {
    setRollbackLoading(true)
    try {
      await api.rollbackSkillVersion(skillUuid, version)
      await fetchVersions()
      setSelectedVersions([])
    } catch (err) {
      console.error("Failed to rollback:", err)
      setError(err instanceof Error ? err.message : "回滚失败")
    } finally {
      setRollbackLoading(false)
    }
  }

  const renderVersionList = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )
    }

    if (error) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchVersions}>
              重试
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (versions.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Package className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">暂无版本记录</p>
            <p className="text-xs text-muted-foreground mt-1">版本会在部署时自动生成</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-2">
        {versions.map((v) => (
          <Card
            key={v.version}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedVersions.includes(v.version) ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => handleVersionSelect(v.version)}
          >
            <CardContent className="flex items-start gap-3 py-3">
              <Checkbox
                checked={selectedVersions.includes(v.version)}
                onCheckedChange={() => handleVersionSelect(v.version)}
                aria-label={`选择版本 ${v.version}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{v.version}</span>
                  {selectedVersions.length === 2 &&
                    selectedVersions.includes(v.version) && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedVersions[0] === v.version ? "旧" : "新"}
                      </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {v.description || "无描述"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(v.created_at), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const renderSingleVersion = (version: SkillVersion | null, isLoading: boolean, loadError: string | null) => {
    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )
    }

    if (loadError) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            <p>{loadError}</p>
          </CardContent>
        </Card>
      )
    }

    if (!version) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>版本 {version.version}</span>
            {version.dependencies.length > 0 && (
              <Badge variant="outline">{version.dependencies.length} 个依赖</Badge>
            )}
            {version.dependency_spec_version && (
              <Badge variant="secondary" className="text-xs">
                Spec v{version.dependency_spec_version}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            创建于 {new Date(version.created_at).toLocaleString("zh-CN")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">描述</h4>
            <p className="text-sm text-muted-foreground">
              {version.description || "无描述"}
            </p>
          </div>

          {/* 依赖列表 */}
          <div>
            <h4 className="text-sm font-medium mb-2">依赖</h4>
            {version.dependencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">无依赖</p>
            ) : (
              <ul className="space-y-1">
                {version.dependencies.map((dep) => (
                  <li key={dep} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {dep}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 依赖规范详情 (dependency_spec) */}
          {version.dependency_spec && Object.keys(version.dependency_spec).length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="dependency-spec" className="border-none">
                <AccordionTrigger className="text-sm font-medium py-2 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <ListTree className="h-4 w-4" />
                    依赖规范详情
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {/* Python 依赖 */}
                    {version.dependency_spec.python && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">Python</Badge>
                          <span className="text-xs text-muted-foreground">
                            管理器: {version.dependency_spec.python.manager || "pip"}
                          </span>
                        </div>
                        {version.dependency_spec.python.requirements?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">依赖包:</p>
                            <ul className="text-xs space-y-0.5">
                              {version.dependency_spec.python.requirements.map((req: string) => (
                                <li key={req} className="text-muted-foreground">• {req}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {version.dependency_spec.python.files?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">配置文件:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {version.dependency_spec.python.files.map((file: string) => (
                                <Badge key={file} variant="secondary" className="text-xs">
                                  <FileCode className="h-3 w-3 mr-1" />
                                  {file}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Node 依赖 */}
                    {version.dependency_spec.node && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">Node.js</Badge>
                          <span className="text-xs text-muted-foreground">
                            管理器: {version.dependency_spec.node.manager || "npm"}
                          </span>
                        </div>
                        {version.dependency_spec.node.package_json && (
                          <div className="text-xs text-muted-foreground">
                            <p>package.json 已包含</p>
                          </div>
                        )}
                        {version.dependency_spec.node.lockfile && (
                          <div className="mt-2 flex items-center gap-1">
                            <FileCode className="h-3 w-3" />
                            <span className="text-xs text-muted-foreground">
                              锁定文件: {version.dependency_spec.node.lockfile}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 原始 JSON */}
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        查看原始 JSON
                      </summary>
                      <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-2 overflow-auto max-h-48">
                        {JSON.stringify(version.dependency_spec, null, 2)}
                      </pre>
                    </details>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* 元数据 */}
          {version.metadata && Object.keys(version.metadata).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">元数据</h4>
              <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-48">
                {JSON.stringify(version.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* 回滚确认对话框 */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                回滚到此版本
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认回滚</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要回滚到版本 {version.version} 吗？当前文件将被替换为该版本的文件。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleRollback(version.version)}
                  disabled={rollbackLoading}
                >
                  {rollbackLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  确认回滚
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    )
  }

  const renderDiff = () => {
    if (!diffResult) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            版本对比
          </CardTitle>
          <CardDescription>
            {diffResult.from_version} → {diffResult.to_version}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {diffLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {(diffResult.added.length > 0 || diffResult.removed.length > 0) && (
                <div>
                  <h4 className="text-sm font-medium mb-2">依赖变更</h4>
                  {diffResult.added.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground mb-1">新增:</p>
                      <ul className="space-y-1">
                        {diffResult.added.map((dep) => (
                          <li key={dep} className="text-sm text-green-600">
                            + {dep}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {diffResult.removed.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">移除:</p>
                      <ul className="space-y-1">
                        {diffResult.removed.map((dep) => (
                          <li key={dep} className="text-sm text-red-600">
                            - {dep}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {diffResult.modified.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">文件变更</h4>
                  <div className="space-y-2">
                    {diffResult.modified.map((mod) => (
                      <div key={mod.path} className="text-sm">
                        <p className="font-medium">{mod.path}</p>
                        <pre className="text-xs text-muted-foreground bg-muted p-2 rounded mt-1 overflow-auto">
                          {mod.diff}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => handleRollback(diffResult.from_version)}
                disabled={rollbackLoading}
              >
                {rollbackLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                回滚到 {diffResult.from_version}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderRightPanel = () => {
    if (selectedVersions.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GitCompare className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">选择版本查看详情或对比</p>
            <p className="text-xs text-muted-foreground mt-1">
              选择单个版本查看详情，选择两个版本进行对比
            </p>
          </CardContent>
        </Card>
      )
    }

    if (selectedVersions.length === 1) {
      return renderSingleVersion(versionDetail, versionDetailLoading, versionDetailError)
    }

    return renderDiff()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">版本列表</h3>
        {renderVersionList()}
      </div>
      <div>{renderRightPanel()}</div>
    </div>
  )
}
