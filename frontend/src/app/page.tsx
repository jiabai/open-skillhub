import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>SkillHub 控制台</CardTitle>
          <CardDescription>为你的私有 Skills 提供清晰、可追踪的管理体验。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/dashboard">进入概览</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">前往登录</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
