import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

type WorkspaceBoundaryNoteProps = {
  rbacEnabled: boolean
}

export function WorkspaceBoundaryNote({ rbacEnabled }: WorkspaceBoundaryNoteProps) {
  const content = rbacEnabled
    ? {
        badge: "Scoped Access",
        text: "This console uses scoped permissions, visibility rules, and organization controls.",
      }
    : {
        badge: "Personal Workspace",
        text: "This workspace is personal: manage your own Skills, reuse public Skills, and connect your own client tokens.",
      }

  return (
    <Card className="border-border/70 bg-muted/30">
      <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm text-muted-foreground">
        <Badge variant="outline">{content.badge}</Badge>
        <span>{content.text}</span>
      </CardContent>
    </Card>
  )
}
