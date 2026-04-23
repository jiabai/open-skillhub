export async function copyTextToClipboard(text: string): Promise<void> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text)
      return
    } catch {
      // Fall through to the legacy DOM copy path.
    }
  }

  if (typeof document === "undefined" || !document.body) {
    throw new Error("Clipboard access is unavailable.")
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.top = "0"
  textarea.style.left = "-9999px"
  textarea.style.opacity = "0"
  textarea.style.pointerEvents = "none"
  document.body.appendChild(textarea)

  try {
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)

    if (typeof document.execCommand !== "function" || !document.execCommand("copy")) {
      throw new Error("Clipboard fallback failed.")
    }
  } finally {
    document.body.removeChild(textarea)
  }
}
