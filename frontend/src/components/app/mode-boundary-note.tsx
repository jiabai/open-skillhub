import type { AppMode } from "@/lib/app-mode"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const contentByMode: Record<AppMode, { badge: string; text: string }> = {
  "no-rbac": {
    badge: "No-RBAC",
    text: "This mode is a personal workspace: manage your own Skills, reuse public Skills, and connect your own client tokens.",
  },
  rbac: {
    badge: "RBAC",
    text: "This mode is a governed console: work within scoped permissions, visibility rules, and organization controls.",
  },
}

type ModeBoundaryNoteProps = {
  mode: AppMode
}

export function ModeBoundaryNote({ mode }: ModeBoundaryNoteProps) {
  const content = contentByMode[mode]

  return (
    <Card className="border-border/70 bg-muted/30">
      <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm text-muted-foreground">
        <Badge variant="outline">{content.badge}</Badge>
        <span>{content.text}</span>
      </CardContent>
    </Card>
  )
}
