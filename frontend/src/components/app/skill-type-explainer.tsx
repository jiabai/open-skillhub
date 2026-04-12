import { Copy, Link2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const items = [
  {
    title: "Reference",
    description: "Best when you want to start using a public Skill quickly without taking over its files.",
    icon: Link2,
  },
  {
    title: "Clone",
    description: "Best when you expect to edit code, manage versions yourself, or maintain a private fork.",
    icon: Copy,
  },
]

export function SkillTypeExplainer() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon

        return (
          <Card key={item.title} className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4 text-primary" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{item.description}</CardDescription>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
