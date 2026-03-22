"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, User2 } from "lucide-react"

import { api, getErrorMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export default function ProfilePage() {
  const { success, error: showError } = useToast()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  const [message, setMessage] = useState<string | null>(null)

  // 邮箱绑定相关状态
  const [newEmail, setNewEmail] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isBinding, setIsBinding] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef(countdown)

  // 保持 ref 和 state 同步
  useEffect(() => {
    countdownRef.current = countdown
  }, [countdown])

  useEffect(() => {
    const loadProfile = async () => {
      const user = await api.getMe()
      setUsername(user.username)
      setEmail(user.email)
      setStatus("ready")
    }
    loadProfile()
  }, [])

  // 倒计时 effect
  useEffect(() => {
    if (countdownRef.current <= 0) {
      return
    }
    const timer = window.setInterval(() => {
      setCountdown((current) => (current > 0 ? current - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    await api.updateMe({ username, email })
    setMessage("个人信息已更新。")
  }

  const handleSendCode = async () => {
    if (!newEmail) {
      showError("请输入新邮箱")
      return
    }
    setIsSendingCode(true)
    try {
      await api.sendVerificationCode({ email: newEmail, purpose: "bind_email" })
      success("验证码已发送")
      setCountdown(60)
    } catch (err) {
      showError(getErrorMessage(err))
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleBindEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newEmail || !verificationCode) {
      showError("请填写完整信息")
      return
    }
    setIsBinding(true)
    try {
      await api.bindEmail({ email: newEmail, code: verificationCode })
      success("邮箱绑定成功")
      setEmail(newEmail)
      setNewEmail("")
      setVerificationCode("")
    } catch (err) {
      showError(getErrorMessage(err))
    } finally {
      setIsBinding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <User2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl">个人信息</h1>
          <p className="text-sm text-muted-foreground">更新账户基础资料。</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>资料信息</CardTitle>
          <CardDescription>所有变更立即生效。</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">显示名称</Label>
                <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <Button type="submit">保存变更</Button>
              {message ? <p className="text-sm text-primary">{message}</p> : null}
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>绑定新邮箱</CardTitle>
          <CardDescription>绑定新邮箱需要验证。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBindEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">新邮箱</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="输入新邮箱地址"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verification-code">验证码</Label>
              <div className="flex gap-2">
                <Input
                  id="verification-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="输入验证码"
                  required
                />
                <Button
                  variant="outline"
                  onClick={handleSendCode}
                  disabled={isSendingCode || countdown > 0}
                >
                  {countdown > 0 ? `${countdown}s` : "获取验证码"}
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={isBinding}>
              {isBinding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              绑定邮箱
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
