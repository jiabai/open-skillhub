export type HelpSection = {
  id: string
  level: 1 | 2
  children?: HelpSection[]
}

export const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    level: 1,
    children: [
      { id: "what-is-skilldrive", level: 2 },
      { id: "register-and-login", level: 2 },
      { id: "ui-overview", level: 2 },
    ],
  },
  {
    id: "skills",
    level: 1,
    children: [
      { id: "public-skills", level: 2 },
      { id: "my-skills", level: 2 },
      { id: "upload-skill", level: 2 },
      { id: "version-management", level: 2 },
    ],
  },
  {
    id: "tokens",
    level: 1,
    children: [
      { id: "create-token", level: 2 },
      { id: "desktop-client", level: 2 },
      { id: "token-lifecycle", level: 2 },
    ],
  },
  {
    id: "account-security",
    level: 1,
    children: [
      { id: "update-profile", level: 2 },
      { id: "bind-email", level: 2 },
      { id: "delete-account", level: 2 },
    ],
  },
  {
    id: "faq",
    level: 1,
    children: [
      { id: "faq-reference-vs-clone", level: 2 },
      { id: "faq-lost-token", level: 2 },
      { id: "faq-upload-failed", level: 2 },
    ],
  },
]

export function flattenHelpSections(items: HelpSection[] = helpSections): HelpSection[] {
  return items.flatMap((item) => [item, ...flattenHelpSections(item.children ?? [])])
}
