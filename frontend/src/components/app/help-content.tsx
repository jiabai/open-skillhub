import type { AppDictionary } from "@/i18n/messages/types"
import type { HelpSection } from "@/lib/help-data"
import { cn } from "@/lib/utils"

type HelpContentProps = {
  copy: AppDictionary["help"]
  items: HelpSection[]
}

export function HelpContent({ copy, items }: HelpContentProps) {
  return (
    <article className="flex min-w-0 flex-1 flex-col gap-8 scroll-smooth">
      {items.map((item) => (
        <HelpContentSection key={item.id} copy={copy} item={item} />
      ))}
    </article>
  )
}

function HelpContentSection({ copy, item }: { copy: AppDictionary["help"]; item: HelpSection }) {
  const section = copy.sections[item.id]
  if (!section) return null
  const Heading = item.level === 1 ? "h2" : "h3"

  return (
    <section
      className={cn("scroll-mt-28", item.level === 1 ? "space-y-4" : "space-y-3")}
      data-help-section
      id={item.id}
    >
      <Heading className={cn(item.level === 1 ? "text-2xl font-semibold" : "text-xl font-semibold")}>
        {section.title}
      </Heading>
      <div className="space-y-3 text-sm leading-7 text-muted-foreground 3xl:text-base">
        {section.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {item.children?.map((child) => (
        <HelpContentSection key={child.id} copy={copy} item={child} />
      ))}
    </section>
  )
}
