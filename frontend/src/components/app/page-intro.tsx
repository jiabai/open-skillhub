import type { ReactNode } from "react"

type PageIntroProps = {
  title: string
  summary: string
  note?: ReactNode
  actions?: ReactNode
}

export function PageIntro({ title, summary, note, actions }: PageIntroProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">{title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground 3xl:text-base">{summary}</p>
        {note ? <div className="text-sm text-muted-foreground">{note}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
