"use client"

import { Copy, Link2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/i18n/use-i18n"

export function SkillTypeExplainer() {
  const { dictionary } = useI18n()
  const items = [
    {
      title: dictionary.publicSkills.referenceTitle,
      description: dictionary.publicSkills.referenceDescription,
      icon: Link2,
    },
    {
      title: dictionary.publicSkills.cloneTitle,
      description: dictionary.publicSkills.cloneDescription,
      icon: Copy,
    },
  ]

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
