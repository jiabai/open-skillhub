import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-primitives"
import { formatDateTime } from "@/i18n/format-date"
import { useI18n } from "@/i18n/use-i18n"

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
  const { locale, dictionary } = useI18n()

  return (
    <Card aria-labelledby="activity-heading" flat>
      <CardHeader>
        <span className="section-heading__eyebrow">{dictionary.activityPanel.eyebrow}</span>
        <CardTitle id="activity-heading">{dictionary.activityPanel.title}</CardTitle>
        <CardDescription>{dictionary.activityPanel.description}</CardDescription>
      </CardHeader>

      <CardContent>
        {entries.length === 0 ? (
          <div className="callout">{dictionary.activityPanel.empty}</div>
        ) : (
          <div className="list-stack">
            {entries.map((entry) => (
              <article className="update-item" key={entry.id}>
                <div className="update-item__meta">
                  <Badge tone={toneBadges[entry.tone]}>
                    {formatDateTime(locale, entry.timestamp, {
                      hour: "2-digit",
                      minute: "2-digit"
                    }, dictionary.common.notRefreshedYet)}
                  </Badge>
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
