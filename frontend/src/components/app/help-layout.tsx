"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ListTree } from "lucide-react"

import { HelpContent } from "@/components/app/help-content"
import { HelpSidebar } from "@/components/app/help-sidebar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useI18n } from "@/i18n/use-i18n"
import { flattenHelpSections, helpSections } from "@/lib/help-data"

export function HelpLayout() {
  const router = useRouter()
  const { dictionary } = useI18n()
  const copy = dictionary.help
  const flatSections = useMemo(() => flattenHelpSections(helpSections), [])
  const [activeId, setActiveId] = useState(flatSections[0]?.id ?? "getting-started")

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        const nextId = visible[0]?.target.id
        if (nextId) {
          setActiveId(nextId)
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0.1, 0.3, 0.6],
      }
    )

    flatSections.forEach((section) => {
      const element = document.getElementById(section.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [flatSections])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--secondary)),_transparent_58%),_linear-gradient(to_bottom,_hsl(var(--muted)_/_0.65),_transparent_42%)]">
      <main className="container mx-auto flex max-w-screen-xl flex-col gap-6 px-6 py-8 3xl:max-w-screen-2xl 4k:max-w-screen-3xl">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div className="flex max-w-3xl flex-col gap-4">
            <Button className="w-fit" variant="outline" type="button" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {copy.backToPrevious}
            </Button>
            <div className="space-y-2">
              <h1 className="font-display text-3xl 3xl:text-4xl 4k:text-5xl">{copy.title}</h1>
              <p className="text-sm leading-6 text-muted-foreground 3xl:text-base">
                {copy.description}
              </p>
            </div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button className="md:hidden" variant="outline" type="button">
                <ListTree className="h-4 w-4" aria-hidden="true" />
                {copy.openDirectory}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{copy.tableOfContents}</SheetTitle>
                <SheetDescription>{copy.description}</SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <HelpSidebar
                  activeId={activeId}
                  closeOnSelect
                  copy={copy}
                  items={helpSections}
                  onSelect={setActiveId}
                />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <div className="grid gap-8 md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden md:block">
            <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
              <HelpSidebar activeId={activeId} copy={copy} items={helpSections} onSelect={setActiveId} />
            </div>
          </aside>
          <HelpContent copy={copy} items={helpSections} />
        </div>
      </main>
    </div>
  )
}
