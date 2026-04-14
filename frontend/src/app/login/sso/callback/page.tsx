"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Loader2, Shield } from "lucide-react"

import { storeTokens } from "@/lib/api"
import { FloatingLanguageToggle } from "@/components/app/floating-language-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/i18n/use-i18n"

export default function SSOCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dictionary } = useI18n()
  const { ssoCallback } = dictionary
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleCallback = () => {
      const errorParam = searchParams.get("error")
      const errorDescription = searchParams.get("error_description")

      if (errorParam) {
        setError(errorDescription || errorParam)
        setLoading(false)
        return
      }

      if (typeof window === "undefined") {
        setError(ssoCallback.readResultError)
        setLoading(false)
        return
      }

      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""))
      const accessToken = fragment.get("access_token")
      const refreshToken = fragment.get("refresh_token")
      if (!accessToken || !refreshToken) {
        setError(ssoCallback.missingCredentials)
        setLoading(false)
        return
      }

      storeTokens({ access_token: accessToken, refresh_token: refreshToken })
      window.history.replaceState(null, "", window.location.pathname)
      router.replace("/dashboard")
    }

    handleCallback()
  }, [router, searchParams, ssoCallback.missingCredentials, ssoCallback.readResultError])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
        <FloatingLanguageToggle />
        <Card className="w-full max-w-md border-border/80 shadow-lg 3xl:max-w-lg 4k:max-w-xl">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:h-12 sm:w-12 3xl:h-14 3xl:w-14">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 3xl:h-7 3xl:w-7" />
              </div>
            </div>
            <CardTitle className="3xl:text-xl">{ssoCallback.loadingTitle}</CardTitle>
            <CardDescription>{ssoCallback.loadingDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary 3xl:h-10 3xl:w-10" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6">
        <FloatingLanguageToggle />
        <Card className="w-full max-w-md border-border/80 shadow-lg 3xl:max-w-lg 4k:max-w-xl">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive text-destructive-foreground sm:h-12 sm:w-12 3xl:h-14 3xl:w-14">
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 3xl:h-7 3xl:w-7" />
              </div>
            </div>
            <CardTitle className="3xl:text-xl">{ssoCallback.errorTitle}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => router.push("/login")} className="w-full">
              {ssoCallback.backToLogin}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
