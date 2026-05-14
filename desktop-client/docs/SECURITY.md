# Desktop Client Security Rules

## Current Secret Handling

- The runtime API token bootstrap reads from `src/core/storage/secret-store.ts`, backed by `keytar`.
- The `keytar` service is `SkillDrive` and the account is `api-token`.
- `SKILLDRIVE_API_TOKEN` is a supported first-run bootstrap path: when the
  secret store is empty, the runtime stores the trimmed token through `keytar`
  and uses it for the current session.
- If secret storage is unavailable, `SKILLDRIVE_API_TOKEN` may be used for the
  current session only; it is not persisted in that fallback path.
- `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET` is an optional current-session
  secret used only by the Electron main process to decrypt backend-encrypted
  skill downloads. It must match the backend `SECRET_KEY` when
  `ENABLE_SKILL_DOWNLOAD_ENCRYPTION=true`, and it is never persisted by the
  desktop client.
- The token must never be written to plaintext JSON config, renderer state snapshots, or logs.
- The download decryption secret must never be written to plaintext JSON config,
  renderer state snapshots, IPC responses, or logs.
- `getConfiguration` IPC returns only desensitized token state: presence, source, persistence status, secret-store availability, and warning.
- Saving or testing configuration may send the user-entered token from renderer to main, but the main process must not return the raw token.
- API Base URL is non-secret and may be stored in `config/config.json`; Token remains in `keytar` only.
- The Linux CLI accepts API tokens only through `--api-token` or
  `SKILLDRIVE_API_TOKEN`. It never persists tokens to `config.json`,
  `agent-paths.json`, SQLite state, cache, or logs.
- The Linux CLI may persist only non-secret `apiBaseUrl` in its separate XDG
  `skilldrive-cli/config.json`.

## Privilege Boundaries

- The renderer remains unprivileged and only uses the preload bridge.
- Node integration, direct filesystem access, and raw secret access stay in the Electron main process.
- IPC handlers must validate inputs before they touch package or filesystem operations.
- Local skill upload IPC accepts only a row key. The main process must resolve
  that row from a fresh local inventory snapshot instead of trusting a renderer
  path.
- Project skill IPC keeps native folder selection, project record writes, skill
  scan, skill validation, folder copy, overwrite, and folder reveal in the main
  process. The renderer sends project IDs, source paths selected by explicit
  user action, target agent IDs, and overwrite flags; it never sends destination
  paths or file contents.

## Package Validation

- Validate package checksum and expiration before extracting or installing.
- Reject unsafe package layouts, including missing `SKILL.md`, unsafe file names, or unexpected path traversal.
- Back up an existing installed skill before promoting a new version into the live target directory.
- Shared package tree safety lives in `src/core/skills/skill-package-tree.ts`.
  CLI local install, Local Skills upload packaging, and Project Skill import
  reuse this module for root `SKILL.md` checks, symlink rejection, realpath
  containment, file count limits, and total byte limits.
- Local skill upload packaging must revalidate the selected package root in the
  main process, require a root `SKILL.md`, reject path traversal and symlink
  escape, and clean temporary ZIP artifacts after success or failure.
- Project skill import revalidates the source folder in the main process,
  requires root `SKILL.md`, resolves safe identity from `slug` before `name`,
  rejects symlinks, non-regular entries, path escapes, excessive file count, and
  excessive total bytes, and copies only into the selected project target.
- CLI local install source validation requires root `SKILL.md`, rejects
  symlinks, path traversal, escaped real paths, more than 1000 files, and more
  than 50 MB. CLI zip extraction rejects unsafe entry paths before distribution
  and cleans temporary extraction/cache roots after use.

## Path Safety

- Skill directory names used in filesystem paths, including SKILL names, must reject empty values, path separators, `.` and `..`.
- Agent skills directories must be explicit, validated, and writable before distribution begins.
- Adapter-specific path assumptions belong in agent adapters, not shared core services.
- Agent detection may use `config/agent-paths.json` as explicit
  user-configured targets. Unknown agent IDs, non-object entries, empty paths,
  relative paths, and raw or normalized `..` path segments are ignored before
  detection or distribution can use them.
- Compatible read paths are explanatory metadata only. They must not become write targets unless the agent catalog also declares them as owned targets.
- Shared physical target dedupe must happen on normalized paths before distribution so one user-controlled directory is written at most once per approved skill.
- Categorized skill targets must validate category path segments before joins.
  Category names reject empty values, path separators, `.`, `..`, leading dot
  names, and traversal fragments. Metadata reads fail closed when the same skill
  name exists in multiple categories under one target.
- Project records require normalized absolute directories and reject duplicate
  names and duplicate normalized paths before persistence.
- Project target definitions must be project-relative catalog metadata.
  Absolute project target definitions and `..` escapes fail closed.
- Project import destinations are resolved from the persisted project record and
  catalog target metadata. Existing target skill directories are rejected unless
  the IPC payload has explicit `overwrite: true`, and overwrite removes only the
  resolved target skill directory after containment checks.
- CLI overwrite flags remove only the resolved destination skill directory
  after containment checks confirm it is inside the selected target root.
  `install` requires `--overwrite` for existing destinations; `sync` requires
  tracked CLI sync state or `--overwrite-untracked` for same-name untracked
  local skills.
- Removing a project from the Projects view deletes only the
  `config/projects.json` record. It must not delete project files or skill
  directories.

## Network and API Contracts

- The desktop client should call the client-oriented API surface only.
- Client skill list/download response normalization, bearer auth headers,
  checksum validation, expiration validation, encrypted-download policy, and
  cache staging live in `src/core/client-skills/client-skill-api.ts` so the
  Electron runtime and Linux CLI do not drift on the Client API contract.
- Do not reuse browser-session JWT routes for the desktop runtime.
- API configuration connection tests must use an authenticated client route, currently `GET /api/v1/client/skills?limit=1`, rather than unauthenticated health checks.
- Local skill uploads must use `POST /api/v1/client/skills/upload` with API
  Token bearer authentication; the renderer must not receive the token, package
  bytes, or temporary upload paths.
- Treat auth, network, path, package, and verification failures as separate error classes so operators can act on them.
- Linux CLI encrypted server downloads are unsupported in v1. If the server
  reports an encrypted package, the CLI exits with code `5` before extraction or
  agent-directory writes.

## Logging

- Logs may record request outcomes, target agent IDs, and normalized error classes.
- Logs must not record the raw API token or decrypted package contents.

## Release Signing Secrets

- The initial macOS `build.mac` configuration does not require Apple signing or
  notarization secrets because Developer ID release signing is deferred.
- Apple Developer ID certificates, `.p12` exports, `.p8` API keys,
  app-specific passwords, keychain profiles, and notarization logs containing
  team metadata must not be committed.
- macOS release signing credentials belong in the operator's macOS keychain,
  shell environment, or CI secret store only.
- `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`,
  `APPLE_API_ISSUER`, `APPLE_ID`, `APPLE_TEAM_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_KEYCHAIN`, and
  `APPLE_KEYCHAIN_PROFILE` are release-time secret inputs, not runtime config.
- Release docs may name required environment variables but must never include
  real values.

## Current V1 Contract Gap

- The current implementation supports backend-encrypted downloads only when the
  Electron main process receives `SKILLDRIVE_DOWNLOAD_DECRYPTION_SECRET`.
- If encrypted downloads remain enabled but the secret is missing or does not
  match the backend `SECRET_KEY`, distribution fails closed before extraction or
  agent-directory writes.
- README, product specs, references, and future backend contract changes must keep this rule consistent.

## Current Persistence Gap

- The earlier design language assumed recoverable distribution history and backups.
- The current implementation persists sync snapshot state but does not yet persist full distribution run history or backup metadata.
- Product and architecture docs must describe that gap explicitly until the storage model grows.
