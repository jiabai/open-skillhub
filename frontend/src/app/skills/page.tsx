"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Search, Trash2 } from "lucide-react"

import { api } from "@/lib/api"
import type { Skill } from "@/types"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function SkillsPage() {
  const [query, setQuery] = useState("")
  const [skills, setSkills] = useState<Skill[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const loadSkills = async (search?: string) => {
    setStatus("loading")
    setError(null)
    try {
      const data = await api.listSkills(search)
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
    loadSkills(query)
  }

  const handleDelete = async (skillUuid: string) => {
    await api.deleteSkill(skillUuid)
    await loadSkills(query)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Skills</h1>
          <p className="text-sm text-muted-foreground">管理你的私有 Agent Skills 目录。</p>
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
          return (
          <Card key={skill.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle>{skill.name}</CardTitle>
                <CardDescription>{skill.description || "暂无描述"}</CardDescription>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="muted">私有目录</Badge>
                  <Badge variant="outline">id: {skill.id.slice(0, 8)}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/skills/${skillUuid}`}>查看</Link>
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
                      <AlertDialogDescription>删除后将无法恢复该 Skill 及其文件。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(skillUuid)}>确认删除</AlertDialogAction>
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
