"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Shield, AlertCircle } from "lucide-react"

import { storeTokens } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SSOCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
        setError("无法读取登录结果")
        setLoading(false)
        return
      }

      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""))
      const accessToken = fragment.get("access_token")
      const refreshToken = fragment.get("refresh_token")
      if (!accessToken || !refreshToken) {
        setError("缺少认证凭证")
        setLoading(false)
        return
      }

      storeTokens({ access_token: accessToken, refresh_token: refreshToken })
      window.history.replaceState(null, "", window.location.pathname)
      router.replace("/dashboard")
    }

    handleCallback()
  }, [router, searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6">
        <Card className="w-full max-w-md border-border/80 shadow-lg 3xl:max-w-lg 4k:max-w-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:h-12 sm:w-12 3xl:h-14 3xl:w-14">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 3xl:h-7 3xl:w-7" />
              </div>
            </div>
            <CardTitle className="3xl:text-xl">SSO 认证中</CardTitle>
            <CardDescription>正在验证您的身份...</CardDescription>
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
      <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6">
        <Card className="w-full max-w-md border-border/80 shadow-lg 3xl:max-w-lg 4k:max-w-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive text-destructive-foreground sm:h-12 sm:w-12 3xl:h-14 3xl:w-14">
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 3xl:h-7 3xl:w-7" />
              </div>
            </div>
            <CardTitle className="3xl:text-xl">SSO 认证失败</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => router.push("/login")} className="w-full">
              返回登录
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
