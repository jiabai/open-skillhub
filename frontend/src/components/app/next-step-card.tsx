import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type NextStepCardProps = {
  title: string
  description: string
  href: string
  actionLabel: string
  external?: boolean
}

export function NextStepCard({ title, description, href, actionLabel, external = false }: NextStepCardProps) {
  const Icon = external ? ExternalLink : ArrowRight

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild size="sm">
          {external ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {actionLabel}
              <Icon className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <Link href={href}>
              {actionLabel}
              <Icon className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
