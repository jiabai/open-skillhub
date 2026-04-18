"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mail, Shield, Fingerprint, Building2 } from "lucide-react"

import { api, apiBaseUrl, storeTokens, getErrorMessage } from "@/lib/api"
import { useField, createEmailRules, createVerificationCodeRules } from "@/hooks/use-form-validation"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { FloatingLanguageToggle } from "@/components/app/floating-language-toggle"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"

export default function LoginPage() {
  const router = useRouter()
  const { config } = useRuntimeConfig()
  const { dictionary } = useI18n()
  const { login, validation } = dictionary
  const capabilities = config.capabilities
  const showsEmailAuthOnly = capabilities.email_otp_login && !capabilities.sso && !capabilities.ldap
  const emailField = useField<string>("", createEmailRules(validation.emailInvalid))
  const codeField = useField<string>("", createVerificationCodeRules(validation.verificationCodeInvalid))
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
    if (!emailField.value || isSending || resendSeconds > 0) {
      return
    }
    setIsSending(true)
    setError(null)
    setCodeMessage(null)
    try {
      const response = await api.sendVerificationCode({ email: emailField.value, purpose: "login" })
      const cooldown = response.resend_interval ?? 60
      setResendSeconds(cooldown)
      setCodeMessage(formatMessage(login.codeSent, { seconds: response.expires_in ?? 300 }))
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
    emailField.validate()
    codeField.validate()
    if (!emailField.isValid || !codeField.isValid) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const tokenPair = await api.login({ email: emailField.value, code: codeField.value })
      storeTokens(tokenPair)
      router.replace("/dashboard")
      setSuccess(login.loginSuccess)
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
      window.location.href = `${apiBaseUrl}/api/v1/auth/sso/authorize`
    } catch (err) {
      setError(err instanceof Error ? err.message : login.ssoLoginFailed)
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
      <FloatingLanguageToggle />
      <div className="mx-auto grid min-h-screen max-w-screen-xl items-center gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 3xl:max-w-screen-2xl 3xl:gap-14 4k:max-w-screen-3xl 4k:gap-16">
        <div className="flex flex-col gap-4 sm:gap-6 3xl:gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:h-12 sm:w-12 3xl:h-14 3xl:w-14">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 3xl:h-7 3xl:w-7" />
            </div>
            <div>
              <p className="font-display text-xl sm:text-2xl 3xl:text-3xl">{login.heroTitle}</p>
              <p className="text-xs sm:text-sm 3xl:text-base text-muted-foreground">{login.heroSubtitle}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/60 p-4 sm:p-6 3xl:p-8">
            <p className="text-sm text-muted-foreground">
              {login.heroDescription}
            </p>
          </div>
        </div>
        <Card className="w-full max-w-md justify-self-center border-border/80 shadow-lg lg:max-w-none lg:justify-self-auto 3xl:max-w-lg 4k:max-w-xl">
          <CardHeader>
            <CardTitle>{login.cardTitle}</CardTitle>
            <CardDescription>
              {capabilities.email_otp_login
                ? login.cardDescriptionWithOtp
                : login.cardDescriptionWithoutOtp}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            {capabilities.email_otp_login && (
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{login.emailLabel}</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder={login.emailPlaceholder}
                    value={emailField.value}
                    onChange={(event) => emailField.setValue(event.target.value)}
                    onBlur={emailField.handleBlur}
                  />
                  {emailField.error && <p className="text-sm text-destructive">{emailField.error}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">{login.codeLabel}</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                    <Input
                      id="code"
                      inputMode="numeric"
                      placeholder={login.codePlaceholder}
                      value={codeField.value}
                      onChange={(event) => codeField.setValue(event.target.value)}
                      onBlur={codeField.handleBlur}
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
                      {resendSeconds > 0 ? `${resendSeconds}s` : isSending ? login.sendingCode : login.sendCode}
                    </Button>
                  </div>
                  {codeField.error && <p className="text-sm text-destructive">{codeField.error}</p>}
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {codeMessage ? <p className="text-sm text-muted-foreground">{codeMessage}</p> : null}
                {success ? <p className="text-sm text-primary">{success}</p> : null}
              </CardContent>
            )}
            <CardFooter className="flex flex-col gap-3">
              {capabilities.email_otp_login && (
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? login.loginLoading : login.loginWithOtp}
                </Button>
              )}
              {(capabilities.sso || capabilities.ldap) && (
                <>
                  {capabilities.email_otp_login && (
                    <div className="relative w-full">
                      <div className="absolute inset-0 flex items-center">
                        <Separator className="w-full" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          {login.dividerOr}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex w-full flex-col gap-2 sm:flex-row">
                    {capabilities.sso && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleSSOLogin}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        {login.ssoLogin}
                      </Button>
                    )}
                    {capabilities.ldap && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleLDAPLogin}
                      >
                        <Fingerprint className="mr-2 h-4 w-4" />
                        {login.ldapLogin}
                      </Button>
                    )}
                  </div>
                </>
              )}
              <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
                {showsEmailAuthOnly ? (
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {login.emailAuthOnly}
                  </span>
                ) : (
                  <span />
                )}
                {capabilities.public_signup && (
                  <Link href="/register" className="text-primary hover:underline">
                    {login.createAccount}
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
