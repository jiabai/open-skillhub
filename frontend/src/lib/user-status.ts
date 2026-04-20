import userStatuses from "@/generated/user-statuses.json"

const catalog = userStatuses as {
  default: string
  statuses: readonly string[]
  labels: Record<string, string>
}

export const USER_STATUS_VALUES = catalog.statuses as readonly ["active", "inactive", "pending"]
export type UserStatus = (typeof USER_STATUS_VALUES)[number]

export const DEFAULT_USER_STATUS = catalog.default as UserStatus
export const USER_STATUS_LABELS = catalog.labels as Record<UserStatus, string>

export const USER_STATUS_OPTIONS = USER_STATUS_VALUES.map((value) => ({
  value,
  label: USER_STATUS_LABELS[value],
}))

export const isUserStatus = (value: string): value is UserStatus =>
  (USER_STATUS_VALUES as readonly string[]).includes(value)
