"use client"

import { useState } from "react"
import { ShieldCheck, Trash2 } from "lucide-react"

import { api, clearTokens } from "@/lib/api"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SecurityPage() {
  const [deleteCode, setDeleteCode] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const handleDeleteAccount = async () => {
    await api.deleteAccount({ code: deleteCode })
    clearTokens()
    window.location.href = "/login"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl">安全设置</h1>
          <p className="text-sm text-muted-foreground">管理账户安全与数据。</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>删除账户</CardTitle>
          <CardDescription>此操作不可恢复，请先申请删除验证码。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-code">删除验证码</Label>
            <Input
              id="delete-code"
              type="text"
              value={deleteCode}
              onChange={(event) => setDeleteCode(event.target.value)}
              placeholder="6 位验证码"
              maxLength={6}
              required
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" />
                删除账户
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除账户？</AlertDialogTitle>
                <AlertDialogDescription>删除后你的 Skill 与 Token 都将失效，此操作不可恢复。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>确认删除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {message ? <p className="text-sm text-primary">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
