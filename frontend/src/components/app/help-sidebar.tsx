import { SheetClose } from "@/components/ui/sheet"
import type { AppDictionary } from "@/i18n/messages/types"
import type { HelpSection } from "@/lib/help-data"
import { cn } from "@/lib/utils"

type HelpSidebarProps = {
  activeId: string
  copy: AppDictionary["help"]
  items: HelpSection[]
  closeOnSelect?: boolean
  onSelect: (id: string) => void
}

export function HelpSidebar({ activeId, copy, items, closeOnSelect = false, onSelect }: HelpSidebarProps) {
  return (
    <nav aria-label={copy.tableOfContents} className="flex flex-col gap-1">
      {items.map((item) => (
        <HelpSidebarItem
          key={item.id}
          activeId={activeId}
          closeOnSelect={closeOnSelect}
          copy={copy}
          item={item}
          onSelect={onSelect}
        />
      ))}
    </nav>
  )
}

type HelpSidebarItemProps = {
  activeId: string
  closeOnSelect: boolean
  copy: AppDictionary["help"]
  item: HelpSection
  onSelect: (id: string) => void
}

function HelpSidebarItem({ activeId, closeOnSelect, copy, item, onSelect }: HelpSidebarItemProps) {
  const isActive = activeId === item.id
  const title = copy.sections[item.id]?.title ?? item.id
  const link = (
    <a
      aria-current={isActive ? "location" : undefined}
      className={cn(
        "flex min-h-[40px] items-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        item.level === 2 && "ml-3 border-l border-border pl-4 text-[0.82rem]",
        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      href={`#${item.id}`}
      onClick={() => onSelect(item.id)}
    >
      {title}
    </a>
  )

  return (
    <div className="flex flex-col gap-1">
      {closeOnSelect ? <SheetClose asChild>{link}</SheetClose> : link}
      {item.children?.map((child) => (
        <HelpSidebarItem
          key={child.id}
          activeId={activeId}
          closeOnSelect={closeOnSelect}
          copy={copy}
          item={child}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
