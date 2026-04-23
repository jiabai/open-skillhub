import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui-primitives"

const agents = [
  {
    name: "Claude Code",
    detail: "Adapter layer ready for code-focused agents."
  },
  {
    name: "Codex",
    detail: "Distributed updates can target this workspace-aware agent."
  },
  {
    name: "Gemini CLI",
    detail: "Kept visible as an approved distribution target."
  }
]

export function AgentsPanel() {
  return (
    <Card aria-labelledby="agents-heading" flat>
      <CardHeader>
        <span className="section-heading__eyebrow">Agents</span>
        <CardTitle id="agents-heading">Distribution targets</CardTitle>
        <CardDescription>Approved local agent targets for reviewed updates.</CardDescription>
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
