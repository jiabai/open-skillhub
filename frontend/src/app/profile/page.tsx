"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, User2 } from "lucide-react"

import { api, getErrorMessage } from "@/lib/api"
import { useRuntimeConfig } from "@/hooks/use-runtime-config"
import type { User } from "@/types"
import { UserIdentitySummary } from "@/components/app/user-identity-summary"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/i18n/use-i18n"

export default function ProfilePage() {
  const { config } = useRuntimeConfig()
  const { success, error: showError } = useToast()
  const { dictionary } = useI18n()
  const { profile, usersAdmin } = dictionary
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"loading" | "ready">("loading")
  const [message, setMessage] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isBinding, setIsBinding] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef(countdown)

  useEffect(() => {
    countdownRef.current = countdown
  }, [countdown])

  useEffect(() => {
    const loadProfile = async () => {
      const userData = await api.getMe()
      setUser(userData)
      setUsername(userData.username)
      setEmail(userData.email)
      setStatus("ready")
    }
    loadProfile()
  }, [])

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
    setMessage(profile.updatedMessage)
  }

  const handleSendCode = async () => {
    if (!newEmail) {
      showError(profile.missingNewEmailError)
      return
    }
    setIsSendingCode(true)
    try {
      await api.sendVerificationCode({ email: newEmail, purpose: "bind_email" })
      success(profile.codeSentSuccess)
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
      showError(profile.missingBindInfoError)
      return
    }
    setIsBinding(true)
    try {
      await api.bindEmail({ email: newEmail, code: verificationCode })
      success(profile.bindSuccess)
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
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground 3xl:h-12 3xl:w-12">
          <User2 className="h-5 w-5 3xl:h-6 3xl:w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">{profile.title}</h1>
          <p className="text-sm text-muted-foreground 3xl:text-base">{profile.summary}</p>
        </div>
      </div>
      <UserIdentitySummary
        user={user}
        isLoading={status === "loading"}
        capabilities={config.capabilities}
        profile={profile}
        usersAdmin={usersAdmin}
      />
      <Card>
        <CardHeader>
          <CardTitle>{profile.infoTitle}</CardTitle>
          <CardDescription>{profile.infoDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {profile.loading}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">{profile.displayNameLabel}</Label>
                <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{profile.emailLabel}</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <Button type="submit">{profile.saveChanges}</Button>
              {message ? <p className="text-sm text-primary">{message}</p> : null}
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{profile.bindTitle}</CardTitle>
          <CardDescription>{profile.bindDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBindEmail} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-email">{profile.newEmailLabel}</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder={profile.newEmailPlaceholder}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="verification-code">{profile.verificationCodeLabel}</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                <Input
                  id="verification-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder={profile.verificationCodePlaceholder}
                  required
                  className="sm:flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendCode}
                  disabled={isSendingCode || countdown > 0}
                  className="shrink-0"
                >
                  {countdown > 0 ? `${countdown}s` : isSendingCode ? profile.sendingCode : profile.sendCode}
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={isBinding}>
              {isBinding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isBinding ? profile.bindEmailLoading : profile.bindEmail}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
