"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mail, Shield, Fingerprint, Building2 } from "lucide-react"

import { api, storeTokens, getErrorMessage } from "@/lib/api"
import { featureFlags } from "@/lib/feature-flags"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [codeMessage, setCodeMessage] = useState<string | null>(null)
  const [resendSeconds, setResendSeconds] = useState(0)
  const resendSecondsRef = useRef(resendSeconds)

  // 保持 ref 和 state 同步
  useEffect(() => {
    resendSecondsRef.current = resendSeconds
  }, [resendSeconds])
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSendCode = async () => {
    if (!email || isSending || resendSeconds > 0) {
      return
    }
    setIsSending(true)
    setError(null)
    setCodeMessage(null)
    try {
      const response = await api.sendVerificationCode({ email, purpose: "login" })
      const cooldown = response.resend_interval ?? 60
      setResendSeconds(cooldown)
      setCodeMessage(`验证码已发送，有效期 ${response.expires_in ?? 300} 秒`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSending(false)
    }
  }

  useEffect(() => {
    if (resendSecondsRef.current <= 0) {
      return
    }
    const timer = window.setInterval(() => {
      setResendSeconds((current) => (current > 0 ? current - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const tokenPair = await api.login({ email, code })
      storeTokens(tokenPair)
      router.replace("/dashboard")
      setSuccess("登录成功，已保存凭证。")
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSSOLogin = async () => {
    setError(null)
    setSuccess(null)
    try {
      // SSO 登录需要跳转到 SSO 提供商
      // 这里简化处理，实际实现可能需要打开新窗口或跳转
      window.location.href = `/api/v1/auth/sso/authorize`
    } catch (err) {
      setError(err instanceof Error ? err.message : "SSO 登录失败")
    }
  }

  const handleLDAPLogin = async () => {
    setError(null)
    setSuccess(null)
    // LDAP 登录可以弹出对话框输入用户名密码
    // 或者跳转到专门的 LDAP 登录页面
    router.push("/login/ldap")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-screen-xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-2xl">欢迎回来</p>
              <p className="text-sm text-muted-foreground">安全地进入你的 Skill 空间</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/60 p-6">
            <p className="text-sm text-muted-foreground">
              你将访问私有 MCP Skill 目录、API Token 管理与运行记录。所有动作都记录在账户下。
            </p>
          </div>
        </div>
        <Card className="border-border/80 shadow-lg">
          <CardHeader>
            <CardTitle>欢迎回来</CardTitle>
            <CardDescription>请输入邮箱并验证验证码继续。</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    inputMode="numeric"
                    placeholder="6 位验证码"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                    pattern="[0-9]{6}"
                    maxLength={6}
                    title="请输入 6 位数字验证码"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSendCode}
                    disabled={!email || isSending || resendSeconds > 0}
                  >
                    {resendSeconds > 0 ? `${resendSeconds}s` : isSending ? "发送中..." : "发送验证码"}
                  </Button>
                </div>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {codeMessage ? <p className="text-sm text-muted-foreground">{codeMessage}</p> : null}
              {success ? <p className="text-sm text-primary">{success}</p> : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              {(featureFlags.enableSSO || featureFlags.enableLDAP) && (
                <>
                  <div className="flex w-full gap-2">
                    {featureFlags.enableSSO && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleSSOLogin}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        SSO 登录
                      </Button>
                    )}
                    {featureFlags.enableLDAP && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleLDAPLogin}
                      >
                        <Fingerprint className="mr-2 h-4 w-4" />
                        LDAP 登录
                      </Button>
                    )}
                  </div>
                  <div className="relative w-full">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        或
                      </span>
                    </div>
                  </div>
                </>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "正在登录..." : "邮箱验证码登录"}
              </Button>
              <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  仅用于认证
                </span>
                {featureFlags.enablePublicSignup && (
                  <Link href="/register" className="text-primary hover:underline">
                    创建账户
                  </Link>
                )}
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
