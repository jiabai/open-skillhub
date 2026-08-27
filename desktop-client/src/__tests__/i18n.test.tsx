import { describe, expect, it } from "vitest"

import { enUSDictionary } from "@/i18n/messages/en-US"
import { zhCNDictionary } from "@/i18n/messages/zh-CN"

describe("Updates batch dictionary", () => {
  it("provides localized orchestration and accessibility copy", () => {
    for (const dictionary of [enUSDictionary, zhCNDictionary]) {
      const batch = dictionary.updatesView.batch

      expect(batch.controlsLabel).toBeTruthy()
      expect(batch.selectionLabel).toBeTruthy()
      expect(batch.selectAll).toBeTruthy()
      expect(batch.selectItem("Skill A")).toBeTruthy()
      expect(batch.clear).toBeTruthy()
      expect(batch.distribute).toBeTruthy()
      expect(batch.selected(1, 2)).toBeTruthy()
      expect(batch.progress(0, 2)).toBeTruthy()
      expect(batch.completed).toBeTruthy()
      expect(batch.completedWithWarnings).toBeTruthy()
      expect(batch.summary(1, 0, 1, 2)).toBeTruthy()
      expect(batch.confirmationTitle).toBeTruthy()
      expect(batch.confirmationDescription(["Skill A", "Skill B"])).toBeTruthy()
      expect(batch.unknownError).toBeTruthy()
    }
  })
})
