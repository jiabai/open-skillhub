import generatedUserStatuses from "@/generated/user-statuses.json"
import {
  DEFAULT_USER_STATUS,
  USER_STATUS_LABELS,
  USER_STATUS_OPTIONS,
  USER_STATUS_VALUES,
  isUserStatus,
} from "@/lib/user-status"

describe("user status catalog", () => {
  it("derives exported constants from the generated catalog", () => {
    expect(USER_STATUS_VALUES).toEqual(generatedUserStatuses.statuses)
    expect(DEFAULT_USER_STATUS).toBe(generatedUserStatuses.default)
    expect(USER_STATUS_LABELS).toEqual(generatedUserStatuses.labels)
    expect(USER_STATUS_OPTIONS).toEqual(
      generatedUserStatuses.statuses.map((value) => ({
        value,
        label: generatedUserStatuses.labels[value],
      }))
    )
  })

  it("recognizes known user statuses", () => {
    expect(isUserStatus("active")).toBe(true)
    expect(isUserStatus("pending")).toBe(true)
    expect(isUserStatus("disabled")).toBe(false)
  })
})
