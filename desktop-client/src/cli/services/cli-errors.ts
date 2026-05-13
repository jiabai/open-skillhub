export type CliErrorKind =
  | "validation"
  | "partial-failure"
  | "no-targets"
  | "remote"
  | "unsupported-encrypted-download"

export class CliError extends Error {
  readonly kind: CliErrorKind

  constructor(kind: CliErrorKind, message: string) {
    super(message)
    this.name = "CliError"
    this.kind = kind
  }
}
