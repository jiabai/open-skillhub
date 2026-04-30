# Desktop Client Security Rules

## Current Secret Handling

- The runtime API token bootstrap reads from `src/core/storage/secret-store.ts`, backed by `keytar`.
- The `keytar` service is `OpenSkillHub` and the account is `api-token`.
- `OPEN_SKILLHUB_API_TOKEN` is a supported first-run bootstrap path: when the
  secret store is empty, the runtime stores the trimmed token through `keytar`
  and uses it for the current session.
- If secret storage is unavailable, `OPEN_SKILLHUB_API_TOKEN` may be used for the
  current session only; it is not persisted in that fallback path.
- The token must never be written to plaintext JSON config, renderer state snapshots, or logs.
- `getConfiguration` IPC returns only desensitized token state: presence, source, persistence status, secret-store availability, and warning.
- Saving or testing configuration may send the user-entered token from renderer to main, but the main process must not return the raw token.
- API Base URL is non-secret and may be stored in `config/config.json`; Token remains in `keytar` only.

## Privilege Boundaries

- The renderer remains unprivileged and only uses the preload bridge.
- Node integration, direct filesystem access, and raw secret access stay in the Electron main process.
- IPC handlers must validate inputs before they touch package or filesystem operations.

## Package Validation

- Validate package checksum and expiration before extracting or installing.
- Reject unsafe package layouts, including missing `SKILL.md`, unsafe file names, or unexpected path traversal.
- Back up an existing installed skill before promoting a new version into the live target directory.

## Path Safety

- Skill directory names used in filesystem paths, including SKILL names, must reject empty values, path separators, `.` and `..`.
- Agent skills directories must be explicit, validated, and writable before distribution begins.
- Adapter-specific path assumptions belong in agent adapters, not shared core services.
- Agent detection may use environment variables as explicit user-configured targets, but those paths are still normalized and validated by the adapter/distribution path before writes.
- Compatible read paths are explanatory metadata only. They must not become write targets unless the agent catalog also declares them as owned targets.
- Shared physical target dedupe must happen on normalized paths before distribution so one user-controlled directory is written at most once per approved skill.

## Network and API Contracts

- The desktop client should call the client-oriented API surface only.
- Do not reuse browser-session JWT routes for the desktop runtime.
- API configuration connection tests must use an authenticated client route, currently `GET /api/v1/client/skills?limit=1`, rather than unauthenticated health checks.
- Treat auth, network, path, package, and verification failures as separate error classes so operators can act on them.

## Logging

- Logs may record request outcomes, target agent IDs, and normalized error classes.
- Logs must not record the raw API token or decrypted package contents.

## Current V1 Contract Gap

- The current implementation expects client downloads to be distributable as plain ZIP content after the server response is normalized.
- If encrypted downloads remain enabled at the backend boundary, the desktop client must fail closed with a clear error until a supported decryptor boundary exists.
- README, product specs, references, and future backend contract changes must keep this rule consistent.

## Current Persistence Gap

- The earlier design language assumed recoverable distribution history and backups.
- The current implementation persists sync snapshot state but does not yet persist full distribution run history or backup metadata.
- Product and architecture docs must describe that gap explicitly until the storage model grows.
