"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck, Trash2 } from "lucide-react"

import { api, clearTokens } from "@/lib/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/i18n/use-i18n"

export default function SecurityPage() {
  const router = useRouter()
  const { dictionary } = useI18n()
  const { security } = dictionary
  const [deleteCode, setDeleteCode] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRequestDeleteCode = async () => {
    setIsRequestingCode(true)
    setError(null)
    setMessage(null)
    try {
      await api.requestDeleteAccount()
      setCodeSent(true)
      setMessage(security.codeSentMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : security.requestCodeFailed)
    } finally {
      setIsRequestingCode(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await api.deleteAccount({ code: deleteCode })
      clearTokens()
      router.replace("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : security.deleteFailed)
    }
  }

  return (
    <div className="flex flex-col gap-6 3xl:gap-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground 3xl:h-12 3xl:w-12">
          <ShieldCheck className="h-5 w-5 3xl:h-6 3xl:w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">{security.title}</h1>
          <p className="text-sm text-muted-foreground 3xl:text-base">{security.summary}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{security.deleteTitle}</CardTitle>
          <CardDescription>{security.deleteDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!codeSent ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{security.intro}</p>
              <Button variant="outline" onClick={handleRequestDeleteCode} disabled={isRequestingCode}>
                {isRequestingCode ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {security.sending}
                  </>
                ) : (
                  security.requestCode
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="delete-code">{security.codeLabel}</Label>
                <Input
                  id="delete-code"
                  type="text"
                  value={deleteCode}
                  onChange={(event) => setDeleteCode(event.target.value)}
                  placeholder={security.codePlaceholder}
                  maxLength={6}
                  required
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                <Button variant="outline" onClick={handleRequestDeleteCode} disabled={isRequestingCode} className="sm:flex-1">
                  {isRequestingCode ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {security.resending}
                    </>
                  ) : (
                    security.resendCode
                  )}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={!deleteCode} className="sm:flex-1">
                      <Trash2 className="mr-2 h-4 w-4" />
                      {security.deleteAccount}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{security.confirmTitle}</AlertDialogTitle>
                      <AlertDialogDescription>{security.confirmDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{security.cancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive">
                        {security.confirmDelete}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          {message ? <p className="text-sm text-primary">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
