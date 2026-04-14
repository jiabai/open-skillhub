"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/i18n/use-i18n"

export default function HomePage() {
  const { dictionary } = useI18n()
  const { home } = dictionary

  return (
    <div className="grid gap-6 3xl:gap-8">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="3xl:text-2xl">{home.title}</CardTitle>
          <CardDescription>{home.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/dashboard">{home.openOverview}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">{home.goToLogin}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
