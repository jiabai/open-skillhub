"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Wrench } from "lucide-react"

import { api, getErrorMessage } from "@/lib/api"
import { useField, createEmailRules, createVerificationCodeRules, createUsernameRules } from "@/hooks/use-form-validation"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FloatingLanguageToggle } from "@/components/app/floating-language-toggle"
import { formatMessage } from "@/i18n/format-message"
import { useI18n } from "@/i18n/use-i18n"

export default function RegisterPage() {
  const router = useRouter()
  const { config } = useRuntimeConfig()
  const { dictionary } = useI18n()
  const { appShell, register, validation } = dictionary
  const enablePublicSignup = config.capabilities.public_signup

  useEffect(() => {
    if (!enablePublicSignup) {
      router.replace("/login")
    }
  }, [enablePublicSignup, router])

  const usernameField = useField<string>(
    "",
    createUsernameRules({
      minLength: validation.usernameMinLength,
      maxLength: validation.usernameMaxLength,
      pattern: validation.usernamePattern,
    })
  )
  const emailField = useField<string>("", createEmailRules(validation.emailInvalid))
  const codeField = useField<string>("", createVerificationCodeRules(validation.verificationCodeInvalid))
  const [codeMessage, setCodeMessage] = useState<string | null>(null)
  const [resendSeconds, setResendSeconds] = useState(0)
  const resendSecondsRef = useRef(resendSeconds)

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
      setCodeMessage(formatMessage(register.codeSent, { seconds: response.expires_in ?? 300 }))
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
      setSuccess(register.success)
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
      <FloatingLanguageToggle />
      <div className="mx-auto grid min-h-screen max-w-screen-xl items-center gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 3xl:max-w-screen-2xl 3xl:gap-14 4k:max-w-screen-3xl 4k:gap-16">
        <Card className="w-full max-w-md justify-self-center border-border/80 shadow-lg lg:max-w-none lg:justify-self-auto 3xl:max-w-lg 4k:max-w-xl">
          <CardHeader>
            <CardTitle>{register.title}</CardTitle>
            <CardDescription>{register.description}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">{register.usernameLabel}</Label>
                <Input
                  id="username"
                  placeholder={register.usernamePlaceholder}
                  value={usernameField.value}
                  onChange={(event) => usernameField.setValue(event.target.value)}
                  onBlur={usernameField.handleBlur}
                  disabled={isLoading}
                />
                {usernameField.error ? <p className="text-sm text-destructive">{usernameField.error}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{register.emailLabel}</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder={register.emailPlaceholder}
                  value={emailField.value}
                  onChange={(event) => emailField.setValue(event.target.value)}
                  onBlur={emailField.handleBlur}
                  disabled={isLoading || isSending}
                />
                {emailField.error ? <p className="text-sm text-destructive">{emailField.error}</p> : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">{register.codeLabel}</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                  <Input
                    id="code"
                    inputMode="numeric"
                    placeholder={register.codePlaceholder}
                    value={codeField.value}
                    onChange={(event) => codeField.setValue(event.target.value)}
                    onBlur={codeField.handleBlur}
                    disabled={isLoading}
                    maxLength={6}
                    autoComplete="new-password"
                    className="sm:flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSendCode}
                    disabled={!emailField.value || isSending || resendSeconds > 0}
                    className="shrink-0"
                  >
                    {resendSeconds > 0 ? `${resendSeconds}s` : isSending ? register.sendingCode : register.sendCode}
                  </Button>
                </div>
                {codeField.error ? <p className="text-sm text-destructive">{codeField.error}</p> : null}
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {codeMessage ? <p className="text-sm text-muted-foreground">{codeMessage}</p> : null}
              {success ? <p className="text-sm text-primary">{success}</p> : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? register.createLoading : register.createAccount}
              </Button>
              {success ? (
                <Button type="button" variant="secondary" className="w-full" onClick={handleGoToLogin}>
                  {register.goToLoginNow}
                </Button>
              ) : null}
              <Link href="/login" className="text-sm text-primary hover:underline">
                {register.goToLogin}
              </Link>
            </CardFooter>
          </form>
        </Card>
        <div className="flex flex-col gap-4 sm:gap-6 3xl:gap-8">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:h-12 sm:w-12 3xl:h-14 3xl:w-14">
              <Wrench className="h-5 w-5 sm:h-6 sm:w-6 3xl:h-7 3xl:w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="font-display text-xl sm:text-2xl 3xl:text-3xl">{appShell.brandLabel}</p>
              <p className="text-xs text-muted-foreground sm:text-sm 3xl:text-base">{register.heroSubtitle}</p>
            </div>
          </Link>
          <div className="rounded-lg border border-border bg-muted/60 p-4 sm:p-6 3xl:p-8">
            <p className="font-display text-xl sm:text-2xl 3xl:text-3xl">{register.heroTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{register.heroDescription}</p>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
              <li>{register.featureStorage}</li>
              <li>{register.featureAuth}</li>
              <li>{register.featureObservability}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
