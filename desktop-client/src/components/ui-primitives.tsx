import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react"

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "nav-active"
type ButtonSize = "default" | "sm"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

function joinClassNames(...classNames: Array<string | undefined | false>): string {
  return classNames.filter(Boolean).join(" ")
}

export function Button({
  className,
  variant = "primary",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClassNames("btn", `btn--${variant}`, size === "sm" && "btn--sm", className)}
      {...props}
    />
  )
}

type CardProps = HTMLAttributes<HTMLElement> & {
  flat?: boolean
  as?: "section" | "article" | "div"
}

export function Card({ as: Component = "section", className, flat, ...props }: CardProps) {
  return <Component className={joinClassNames("card", flat && "card--flat", className)} {...props} />
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClassNames("card__header", className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClassNames("card__content", className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={joinClassNames("card__title", className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={joinClassNames("card__description", className)} {...props} />
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "primary" | "accent" | "success" | "warning" | "destructive"
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={joinClassNames("badge", tone !== "neutral" && `badge--${tone}`, className)}
      {...props}
    />
  )
}

type PageIntroProps = {
  eyebrow?: string
  title: string
  summary: string
  actions?: ReactNode
}

export function PageIntro({ eyebrow, title, summary, actions }: PageIntroProps) {
  return (
    <div className="page-intro">
      <div className="page-intro__content">
        {eyebrow ? <span className="page-intro__eyebrow">{eyebrow}</span> : null}
        <h1 className="page-intro__title">{title}</h1>
        <p className="page-intro__summary">{summary}</p>
      </div>
      {actions ? <div className="page-intro__actions">{actions}</div> : null}
    </div>
  )
}

type DrawerProps = {
  open: boolean
  title: string
  description: string
  onClose: () => void
  children: ReactNode
}

export function Drawer({ open, title, description, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        aria-modal="true"
        aria-labelledby="settings-drawer-title"
        className="drawer-panel"
        role="dialog"
      >
        <div className="drawer-panel__header">
          <div className="section-heading">
            <span className="section-heading__eyebrow">Settings</span>
            <h2 id="settings-drawer-title" className="section-heading__title">
              {title}
            </h2>
            <p className="card__description">{description}</p>
          </div>
          <Button aria-label="Close settings" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="drawer-panel__body">{children}</div>
      </aside>
    </>
  )
}
