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
    <section aria-labelledby="settings-summary-heading" className="settings-summary">
      <div>
        <span className="settings-summary__eyebrow">
          {dictionary.settingsPanel.title}
        </span>
        <h2 id="settings-summary-heading" className="settings-summary__heading">
          {dictionary.settingsPanel.heading}
        </h2>
      </div>

      <dl style={{ display: "grid", gap: "0.75rem", margin: 0 }}>
        <div className="settings-summary__tile">
          <dt style={{ fontWeight: 700 }}>{dictionary.settingsPanel.reviewPolicyLabel}</dt>
          <dd className="card__description">
            {dictionary.settingsPanel.reviewPolicyValue}
          </dd>
        </div>
        <div className="settings-summary__tile">
          <dt style={{ fontWeight: 700 }}>{dictionary.settingsPanel.bridgeAccessLabel}</dt>
          <dd className="card__description">
            {dictionary.settingsPanel.bridgeAccessValue}
          </dd>
        </div>
        <div className="settings-summary__tile">
          <dt style={{ fontWeight: 700 }}>{dictionary.settingsPanel.storageSnapshotLabel}</dt>
          <dd className="card__description">
            {dictionary.settingsPanel.storageSnapshotValue}
          </dd>
        </div>
      </dl>

      <div className="settings-summary__info">
        <strong>{dictionary.language.title}</strong>
        <p className="card__description">
          {dictionary.language.description}
        </p>
        <p className="card__description">
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
