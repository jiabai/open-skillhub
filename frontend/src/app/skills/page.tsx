"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Search, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import type { Skill } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SkillsPage() {
  const { success, error: showError } = useToast()
  const [query, setQuery] = useState("")
  const [includeInactive, setIncludeInactive] = useState(false)
  const [skills, setSkills] = useState<Skill[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const loadSkills = async (search?: string, includeInactiveParam?: boolean) => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.listSkills(search, includeInactiveParam)
      setSkills(data.items)
      setStatus("idle")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "加载失败")
    }
  }

  useEffect(() => {
    loadSkills()
  }, [])

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    loadSkills(query, includeInactive)
  }

  const handleDelete = async (skillUuid: string, deleteArchives: boolean) => {
    await api.deleteSkill(skillUuid, deleteArchives)
    await loadSkills(query)
  }

  const handleToggleActive = async (skillUuid: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await api.deactivateSkill(skillUuid)
        success("Skill 已停用")
      } else {
        await api.activateSkill(skillUuid)
        success("Skill 已启用")
      }
      await loadSkills(query)
    } catch (err) {
      const message = err instanceof Error ? err.message : "操作失败"
      setError(message)
      showError("操作失败", { description: message })
    }
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">Skills</h1>
          <p className="text-sm 3xl:text-base text-muted-foreground">管理你的私有 Agent Skills 目录。</p>
        </div>
        <Button asChild>
          <Link href="/skills/new">创建 Skill</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>搜索与筛选</CardTitle>
          <CardDescription>按名称或描述查找 Skill。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="border-0 px-0 focus-visible:ring-0"
                placeholder="搜索 Skill"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={(checked) => setIncludeInactive(checked === true)}
              />
              <Label htmlFor="include-inactive" className="text-sm whitespace-nowrap">
                显示已停用
              </Label>
            </div>
            <Button type="submit" variant="secondary">
              搜索
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {status === "loading" ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载 Skills
            </CardContent>
          </Card>
        ) : null}
        {status === "error" ? (
          <Card>
            <CardContent className="py-10 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}
        {status === "idle" && skills.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              当前没有 Skill，创建一个新的 Skill 开始管理。
            </CardContent>
          </Card>
        ) : null}
        {skills.map((skill) => {
          const skillUuid = skill.id
          const isReference = skill.skill_kind === "reference" || skill.is_reference_read_only
          const kindLabel =
            skill.skill_kind === "reference"
              ? "Reference"
              : skill.skill_kind === "clone"
                ? "Clone"
                : skill.skill_kind === "public"
                  ? "Public"
                  : "Private"
          return (
          <Card key={skill.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <CardTitle>{skill.name}</CardTitle>
                <CardDescription>{skill.description || "暂无描述"}</CardDescription>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={skill.is_active ? "accent" : "muted"}>
                    {skill.is_active ? "已启用" : "已停用"}
                  </Badge>
                  <Badge variant="muted">{kindLabel}</Badge>
                  {skill.resolved_version ? <Badge variant="outline">v{skill.resolved_version}</Badge> : null}
                  {skill.pinned_version ? <Badge variant="outline">Pinned {skill.pinned_version}</Badge> : null}
                  <Badge variant="outline">id: {skill.id.slice(0, 8)}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/skills/${skillUuid}`}>查看</Link>
                </Button>
                <Button
                  variant={skill.is_active ? "secondary" : "outline"}
                  size="sm"
                  disabled={isReference}
                  onClick={() => handleToggleActive(skillUuid, skill.is_active ?? false)}
                >
                  {skill.is_active ? "停用" : "启用"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" aria-label="删除 Skill">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除 Skill？</AlertDialogTitle>
                      <AlertDialogDescription>请选择删除方式：</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-2 py-4 text-sm">
                      <p className="text-muted-foreground">
                        <strong>仅删除技能</strong>：保留存档，后续可重新上传同名技能
                      </p>
                      <p className="text-muted-foreground">
                        <strong>彻底删除</strong>：同时删除存档，无法恢复
                      </p>
                    </div>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(skillUuid, false)}>
                        仅删除技能
                      </AlertDialogAction>
                      <AlertDialogAction
                        onClick={() => handleDelete(skillUuid, true)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        彻底删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
          </Card>
          )
        })}
      </div>
    </div>
  )
}
