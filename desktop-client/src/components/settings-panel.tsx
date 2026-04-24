import type { AppLocale } from "@/types"
import { Button } from "@/components/ui-primitives"
import { useI18n } from "@/i18n/use-i18n"

type SettingsPanelProps = {
  currentLocale: AppLocale
  isSavingLocale: boolean
  onChangeLocale: (locale: AppLocale) => void
}

export function SettingsPanel({
  currentLocale,
  isSavingLocale,
  onChangeLocale
}: SettingsPanelProps) {
  const { dictionary } = useI18n()
  const currentLanguageLabel =
    currentLocale === "zh-CN" ? dictionary.language.zhCNLabel : dictionary.language.enUSLabel

  return (
    <section
      aria-labelledby="settings-summary-heading"
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1.15rem",
        borderRadius: "1rem",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(255, 255, 255, 0.04)"
      }}
    >
      <div>
        <span
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#94a3b8",
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
          }}
        >
          {dictionary.settingsPanel.title}
        </span>
        <h2 id="settings-summary-heading" style={{ margin: "0.3rem 0 0", fontSize: "1.35rem" }}>
          {dictionary.settingsPanel.heading}
        </h2>
      </div>

      <dl style={{ display: "grid", gap: "0.75rem", margin: 0 }}>
        <div
          style={{
            display: "grid",
            gap: "0.25rem",
            padding: "0.85rem",
            borderRadius: "0.85rem",
            background: "rgba(12, 16, 22, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.06)"
          }}
        >
          <dt style={{ fontWeight: 700 }}>{dictionary.settingsPanel.reviewPolicyLabel}</dt>
          <dd style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
            {dictionary.settingsPanel.reviewPolicyValue}
          </dd>
        </div>
        <div
          style={{
            display: "grid",
            gap: "0.25rem",
            padding: "0.85rem",
            borderRadius: "0.85rem",
            background: "rgba(12, 16, 22, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.06)"
          }}
        >
          <dt style={{ fontWeight: 700 }}>{dictionary.settingsPanel.bridgeAccessLabel}</dt>
          <dd style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
            {dictionary.settingsPanel.bridgeAccessValue}
          </dd>
        </div>
        <div
          style={{
            display: "grid",
            gap: "0.25rem",
            padding: "0.85rem",
            borderRadius: "0.85rem",
            background: "rgba(12, 16, 22, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.06)"
          }}
        >
          <dt style={{ fontWeight: 700 }}>{dictionary.settingsPanel.storageSnapshotLabel}</dt>
          <dd style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
            {dictionary.settingsPanel.storageSnapshotValue}
          </dd>
        </div>
      </dl>

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          padding: "0.85rem",
          borderRadius: "0.85rem",
          background: "rgba(96, 165, 250, 0.08)",
          border: "1px solid rgba(96, 165, 250, 0.16)"
        }}
      >
        <strong>{dictionary.language.title}</strong>
        <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.5 }}>
          {dictionary.language.description}
        </p>
        <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
          {dictionary.language.currentPrefix} {currentLanguageLabel}
        </p>
        <div className="page-intro__actions" style={{ justifyContent: "flex-start" }}>
          <Button
            variant={currentLocale === "zh-CN" ? "primary" : "outline"}
            size="sm"
            disabled={isSavingLocale}
            aria-label={dictionary.language.switchToChinese}
            title={dictionary.language.switchToChinese}
            onClick={() => onChangeLocale("zh-CN")}
          >
            {dictionary.language.zhCNLabel}
          </Button>
          <Button
            variant={currentLocale === "en-US" ? "primary" : "outline"}
            size="sm"
            disabled={isSavingLocale}
            aria-label={dictionary.language.switchToEnglish}
            title={dictionary.language.switchToEnglish}
            onClick={() => onChangeLocale("en-US")}
          >
            {dictionary.language.enUSLabel}
          </Button>
        </div>
      </div>
    </section>
  )
}
