"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Shield, AlertCircle } from "lucide-react"

import { api, storeTokens, getErrorMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SSOCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleCallback = async () => {
      // 从 URL 参数获取 id_token 或 code
      const idToken = searchParams.get("id_token")
      const code = searchParams.get("code")
      const errorParam = searchParams.get("error")
      const errorDescription = searchParams.get("error_description")

      if (errorParam) {
        setError(errorDescription || errorParam)
        setLoading(false)
        return
      }

      if (!idToken && !code) {
        setError("缺少认证凭证")
        setLoading(false)
        return
      }

      try {
        // 使用 id_token 或 code 进行登录
        const tokenPair = await api.ssoLogin({ id_token: idToken || code || "" })
        storeTokens(tokenPair)
        router.replace("/dashboard")
      } catch (err) {
        setError(getErrorMessage(err))
        setLoading(false)
      }
    }

    handleCallback()
  }, [router, searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <Card className="w-full max-w-md border-border/80 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-6 w-6" />
              </div>
            </div>
            <CardTitle>SSO 认证中</CardTitle>
            <CardDescription>正在验证您的身份...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <Card className="w-full max-w-md border-border/80 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive text-destructive-foreground">
                <AlertCircle className="h-6 w-6" />
              </div>
            </div>
            <CardTitle>SSO 认证失败</CardTitle>
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