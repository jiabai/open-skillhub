export function formatMessage(
  template: string,
  values: Record<string, string | number | null | undefined>
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value == null ? `{${key}}` : String(value)
  })
}
