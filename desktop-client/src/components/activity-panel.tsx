import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-primitives"

type ActivityEntry = {
  id: string
  title: string
  detail: string
  timestamp: string
  tone: "neutral" | "success" | "warning"
}

type ActivityPanelProps = {
  entries: ActivityEntry[]
}

const toneBadges: Record<ActivityEntry["tone"], "neutral" | "success" | "warning"> = {
  neutral: "neutral",
  success: "success",
  warning: "warning"
}

export function ActivityPanel({ entries }: ActivityPanelProps) {
  return (
    <Card aria-labelledby="activity-heading" flat>
      <CardHeader>
        <span className="section-heading__eyebrow">Activity</span>
        <CardTitle id="activity-heading">Recent actions</CardTitle>
        <CardDescription>Latest local events from this desktop session.</CardDescription>
      </CardHeader>

      <CardContent>
        {entries.length === 0 ? (
          <div className="callout">No recent actions yet.</div>
        ) : (
          <div className="list-stack">
            {entries.map((entry) => (
              <article className="update-item" key={entry.id}>
                <div className="update-item__meta">
                  <Badge tone={toneBadges[entry.tone]}>{entry.timestamp}</Badge>
                  <strong>{entry.title}</strong>
                </div>
                <p className="card__description">{entry.detail}</p>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
