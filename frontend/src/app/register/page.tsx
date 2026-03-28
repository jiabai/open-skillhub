"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"

import { api, getErrorMessage } from "@/lib/api"
import { useField, createEmailRules, createVerificationCodeRules, createUsernameRules } from "@/hooks/use-form-validation"
import { featureFlags } from "@/lib/feature-flags"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function RegisterPage() {
  const router = useRouter()

  // 如果注册被禁用，重定向到登录页
  useEffect(() => {
    if (!featureFlags.enablePublicSignup) {
      router.replace("/login")
    }
  }, [router])

  const usernameField = useField<string>("", createUsernameRules())
  const emailField = useField<string>("", createEmailRules())
  const codeField = useField<string>("", createVerificationCodeRules())
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
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSendCode = async () => {
    if (!emailField.value || isSending || resendSeconds > 0) {
      return
    }
    setIsSending(true)
    setError(null)
    setCodeMessage(null)
    try {
      const response = await api.sendVerificationCode({ email: emailField.value, purpose: "register" })
      const cooldown = response.resend_interval ?? 60
      setResendSeconds(cooldown)
      setCodeMessage(`验证码已发送，有效期 ${response.expires_in ?? 300} 秒`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    usernameField.validate()
    emailField.validate()
    codeField.validate()
    if (!usernameField.isValid || !emailField.isValid || !codeField.isValid) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await api.register({ username: usernameField.value, email: emailField.value, code: codeField.value })
      setSuccess("注册成功，请登录。")
      usernameField.reset()
      emailField.reset()
      codeField.reset()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoToLogin = () => {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current)
    }
    router.replace("/login")
  }

  useEffect(() => {
    if (!success) {
      return
    }
    redirectTimer.current = setTimeout(() => {
      router.replace("/login")
    }, 2000)
    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current)
      }
    }
  }, [router, success])

  useEffect(() => {
    if (resendSecondsRef.current <= 0) {
      return
    }
    const timer = window.setInterval(() => {
      setResendSeconds((current) => (current > 0 ? current - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-screen-xl items-center gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 3xl:max-w-screen-2xl 3xl:gap-14 4k:max-w-screen-3xl 4k:gap-16">
        <Card className="w-full max-w-md justify-self-center border-border/80 shadow-lg lg:max-w-none lg:justify-self-auto 3xl:max-w-lg 4k:max-w-xl">
          <CardHeader>
            <CardTitle>创建账户</CardTitle>
            <CardDescription>使用邮箱验证码创建账户。</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  placeholder="你的显示名称"
                  value={usernameField.value}
                  onChange={(event) => usernameField.setValue(event.target.value)}
                  onBlur={usernameField.handleBlur}
                  disabled={isLoading}
                />
                {usernameField.error && <p className="text-sm text-destructive">{usernameField.error}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="you@company.com"
                  value={emailField.value}
                  onChange={(event) => emailField.setValue(event.target.value)}
                  onBlur={emailField.handleBlur}
                  disabled={isLoading || isSending}
                />
                {emailField.error && <p className="text-sm text-destructive">{emailField.error}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">验证码</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                  <Input
                    id="code"
                    inputMode="numeric"
                    placeholder="6 位验证码"
                    value={codeField.value}
                    onChange={(event) => codeField.setValue(event.target.value)}
                    onBlur={codeField.handleBlur}
                    disabled={isLoading}
                    maxLength={6}
                    className="sm:flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSendCode}
                    disabled={!emailField.value || isSending || resendSeconds > 0}
                    className="shrink-0"
                  >
                    {resendSeconds > 0 ? `${resendSeconds}s` : isSending ? "发送中..." : "发送验证码"}
                  </Button>
                </div>
                {codeField.error && <p className="text-sm text-destructive">{codeField.error}</p>}
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {codeMessage ? <p className="text-sm text-muted-foreground">{codeMessage}</p> : null}
              {success ? <p className="text-sm text-primary">{success}</p> : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "正在创建..." : "创建账户"}
              </Button>
              {success ? (
                <Button type="button" variant="secondary" className="w-full" onClick={handleGoToLogin}>
                  立即登录
                </Button>
              ) : null}
              <Link href="/login" className="text-sm text-primary hover:underline">
                已有账户？前往登录
              </Link>
            </CardFooter>
          </form>
        </Card>
        <div className="flex flex-col gap-4 sm:gap-6 3xl:gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground sm:h-12 sm:w-12 3xl:h-14 3xl:w-14">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 3xl:h-7 3xl:w-7" />
            </div>
            <div>
              <p className="font-display text-xl sm:text-2xl 3xl:text-3xl">即刻启动</p>
              <p className="text-xs sm:text-sm 3xl:text-base text-muted-foreground">多用户隔离、API Token 与 MCP 工具整合</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/60 p-4 sm:p-6 3xl:p-8">
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li>独立 Skill 存储目录与授权</li>
              <li>验证码登录 + MCP API Token 双认证</li>
              <li>运行历史与可观测性指标</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
