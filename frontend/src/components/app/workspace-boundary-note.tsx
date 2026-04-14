"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useI18n } from "@/i18n/use-i18n"

type WorkspaceBoundaryNoteProps = {
  rbacEnabled: boolean
}

export function WorkspaceBoundaryNote({ rbacEnabled }: WorkspaceBoundaryNoteProps) {
  const { dictionary } = useI18n()
  const content = rbacEnabled ? dictionary.workspaceBoundary.governed : dictionary.workspaceBoundary.personal

  return (
    <Card className="border-border/70 bg-muted/30">
      <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm text-muted-foreground">
        <Badge variant="outline">{content.badge}</Badge>
        <span>{content.text}</span>
      </CardContent>
    </Card>
  )
}
