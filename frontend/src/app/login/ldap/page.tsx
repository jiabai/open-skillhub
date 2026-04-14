"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Fingerprint, Shield, User2 } from "lucide-react"

import { api, storeTokens, getErrorMessage } from "@/lib/api"
import { FloatingLanguageToggle } from "@/components/app/floating-language-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/i18n/use-i18n"

export default function LDAPLoginPage() {
  const router = useRouter()
  const { dictionary } = useI18n()
  const { ldapLogin } = dictionary
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username || !password) {
      setError(ldapLogin.emptyCredentialsError)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const tokenPair = await api.ldapLogin({ username, password })
      storeTokens(tokenPair)
      router.replace("/dashboard")
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
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
              <p className="font-display text-xl sm:text-2xl 3xl:text-3xl">{ldapLogin.title}</p>
              <p className="text-xs text-muted-foreground sm:text-sm 3xl:text-base">{ldapLogin.subtitle}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/60 p-4 sm:p-6 3xl:p-8">
            <p className="text-sm text-muted-foreground">{ldapLogin.description}</p>
          </div>
        </div>
        <Card className="w-full max-w-md justify-self-center border-border/80 shadow-lg lg:max-w-none lg:justify-self-auto 3xl:max-w-lg 4k:max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{ldapLogin.cardTitle}</CardTitle>
                <CardDescription>{ldapLogin.cardDescription}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">{ldapLogin.usernameLabel}</Label>
                <div className="relative">
                  <User2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder={ldapLogin.usernamePlaceholder}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{ldapLogin.passwordLabel}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={ldapLogin.passwordPlaceholder}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? ldapLogin.submitting : ldapLogin.submit}
              </Button>
              <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline">
                  {ldapLogin.backToLogin}
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
