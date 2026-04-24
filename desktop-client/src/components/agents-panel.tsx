import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"

export function AgentsPanel() {
  const { dictionary } = useI18n()

  const agents = [
    {
      name: "Claude Code",
      detail: dictionary.agentsPanel.claudeCodeDetail
    },
    {
      name: "Codex",
      detail: dictionary.agentsPanel.codexDetail
    },
    {
      name: "Gemini CLI",
      detail: dictionary.agentsPanel.geminiCliDetail
    }
  ]

  return (
    <Card aria-labelledby="agents-heading" flat>
      <CardHeader>
        <span className="section-heading__eyebrow">{dictionary.agentsPanel.eyebrow}</span>
        <CardTitle id="agents-heading">{dictionary.agentsPanel.title}</CardTitle>
        <CardDescription>{dictionary.agentsPanel.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="list-stack">
          {agents.map((agent) => (
            <article className="update-item" key={agent.name}>
              <strong>{agent.name}</strong>
              <p className="card__description">{agent.detail}</p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
