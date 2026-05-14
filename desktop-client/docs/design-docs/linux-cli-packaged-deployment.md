# Linux CLI Packaged Deployment Technical Design

Status: implemented package assembly; Linux target install validation pending
Scope: `desktop-client/`

## Problem Statement

The implemented Linux CLI runtime is useful, but the current deployment guide
uses a development workflow: copy the whole `desktop-client/` directory to the
Linux machine, run npm install/build there, and register the command through
`npm link`.

That is too much operational surface for a CLI deployment. Linux targets should
receive a release artifact that already contains the CLI runtime and the exact
files it needs to execute.

## Architecture Decision

Ship `skilldrive-cli` as a Linux tarball containing:

- a small command wrapper
- the built CLI entry
- the CLI runtime dependency closure
- an install script
- an uninstall script
- release metadata and checksums

The target machine still provides Node.js. The target machine does not build
TypeScript, run Vite, clone the repository, or run `npm link`.

```text
release builder
  -> npm ci
  -> npm run build:cli
  -> assemble CLI runtime dependency closure
  -> generate manifest and checksums
  -> create skilldrive-cli-<version>-linux-node20.tar.gz

Linux target
  -> verify checksum
  -> tar -xzf artifact
  -> ./install.sh --user|--system
  -> skilldrive-cli command on PATH
```

## Current Runtime Constraint

The current `dist-cli/skilldrive-cli.js` is not a fully standalone file:

- it imports `commander`
- it imports `sql.js`
- it resolves `sql.js/dist/sql-wasm.wasm`
- it uses `createRequire()` to load `extract-zip`

The release package must either include those runtime dependencies or change the
CLI Vite build so all JavaScript dependencies are bundled and only required
external runtime assets are copied. The first implementation should prefer the
least surprising operational result: include a minimal runtime dependency
closure in the tarball and add tests that fail if the closure drifts.

## Package Layout

```text
skilldrive-cli-<version>-linux-node20/
  manifest.json
  runtime-dependencies.json
  SHA256SUMS
  install.sh
  uninstall.sh
  bin/
    skilldrive-cli
  lib/
    skilldrive-cli.js
    skilldrive-cli.js.map
  node_modules/
    commander/
    extract-zip/
    sql.js/
    <extract-zip transitive dependencies>
  docs/
    README-zh.md
```

`bin/skilldrive-cli` should be a tiny shell wrapper:

```sh
#!/usr/bin/env sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$SCRIPT_DIR/../lib/skilldrive-cli.js" "$@"
```

This keeps `import.meta.url` inside the JS entry under the installed package,
so Node module resolution can find the sibling `node_modules/` directory and
`sql.js` can resolve its wasm file.

## Build Script

Add a release assembly script owned by `desktop-client/`, for example:

```json
{
  "scripts": {
    "package:linux-cli": "node scripts/package-linux-cli.mjs"
  }
}
```

`scripts/package-linux-cli.mjs` should:

1. Read package name/version and the current git commit when available.
2. Run or require a fresh `npm run build:cli`.
3. Create a clean staging directory under `dist/linux-cli/staging/`.
4. Copy `dist-cli/skilldrive-cli.js` and source map into `lib/`.
5. Generate `bin/skilldrive-cli`, `install.sh`, `uninstall.sh`, and
   `manifest.json`.
6. Copy only the CLI dependency closure from the repository lockfile and
   `node_modules` into staging.
7. Reject forbidden package contents such as `electron`, `react`,
   `typescript`, `vite`, `vitest`, `dist-electron`, and renderer `dist/`.
8. Run a staged smoke test:

```bash
node staging/lib/skilldrive-cli.js --help
staging/bin/skilldrive-cli config paths
```

9. Generate `SHA256SUMS`.
10. Create `dist/linux-cli/skilldrive-cli-<version>-linux-node20.tar.gz`.
11. Create `dist/linux-cli/skilldrive-cli-<version>-linux-node20.tar.gz.sha256`.

The script should be deterministic enough for review, but it does not need to
solve reproducible builds in v1.

## Dependency Closure Strategy

Implemented first version:

- Keep source `dependencies` unchanged.
- During package assembly, parse `package-lock.json` from the three direct CLI
  runtime dependencies: `commander`, `extract-zip`, and `sql.js`.
- Follow normal `dependencies` transitively and intentionally ignore optional
  type-only dependencies such as `@types/yauzl`.
- Copy the resolved dependency package directories from the already installed
  repository `node_modules` into release staging.
- Write `runtime-dependencies.json` with the copied package names and versions.
- Run a smoke test from staging, not from the repository root, so missing
  dependencies fail before release.

If implementation later bundles `commander` and `extract-zip` into the CLI JS,
the package contents may shrink. `sql.js/dist/sql-wasm.wasm` must still be
accounted for unless the storage layer changes away from sql.js.

## Install Locations

User install:

```text
$XDG_DATA_HOME/skilldrive-cli/releases/<version>/
$XDG_DATA_HOME/skilldrive-cli/current -> releases/<version>
~/.local/bin/skilldrive-cli -> current/bin/skilldrive-cli
```

Fallback when `$XDG_DATA_HOME` is unset:

```text
~/.local/share/skilldrive-cli/releases/<version>/
~/.local/share/skilldrive-cli/current
~/.local/bin/skilldrive-cli
```

System install:

```text
/opt/skilldrive-cli/releases/<version>/
/opt/skilldrive-cli/current -> releases/<version>
/usr/local/bin/skilldrive-cli -> /opt/skilldrive-cli/current/bin/skilldrive-cli
```

The install location is separate from CLI runtime data. The CLI continues to use
`skilldrive-cli` under XDG config, state, and cache directories.

## Installer Behavior

`install.sh` options:

```text
--user
--system
--prefix <path>
--bin-dir <path>
--dry-run
--force
```

Rules:

- Default to `--user` for non-root execution.
- Require `--system` or explicit paths for system installs.
- Validate Linux and Node.js 20+ before copying files.
- Copy the release into a temporary directory under the selected prefix.
- Move the copied release into `releases/<version>`.
- Atomically update `current` symlink.
- Create or replace only the managed `skilldrive-cli` command link.
- Refuse to overwrite a non-symlink command unless `--force` is present and the
  existing path is shown to the user.
- Run `skilldrive-cli --help` after installation.
- Print the install prefix, command path, and recommended verification commands.

## Uninstaller Behavior

`uninstall.sh` options:

```text
--user
--system
--prefix <path>
--bin-dir <path>
--purge-data
--dry-run
```

Rules:

- Remove only the managed command link and selected install prefix by default.
- Preserve CLI XDG config, state, and cache by default.
- With `--purge-data`, list and remove:

```text
$XDG_CONFIG_HOME/skilldrive-cli
$XDG_STATE_HOME/skilldrive-cli
$XDG_CACHE_HOME/skilldrive-cli
```

- Before recursive deletion, verify each resolved path is inside the expected
  XDG parent or selected install prefix.

## Upgrade And Rollback

Upgrades install a new versioned release and update `current`. Existing CLI
config and sync state remain untouched.

Manual rollback is possible by repointing `current` to a previous release and
rerunning the command link creation. The v1 installer does not need an explicit
rollback command unless package validation shows frequent upgrade risk.

## Security Notes

- Do not recommend `curl | sh`.
- Validate downloaded tarballs through sha256 files before installation.
- Do not accept API tokens in install scripts.
- Do not write Agent skill directories from install scripts.
- Keep `--system` install privilege explicit.
- Fail closed if a managed path check is ambiguous.

## Documentation Updates

The documentation phase should update:

| File | Change |
|------|--------|
| `docs/product-specs/2026-05-14-linux-cli-packaged-deployment.md` | Product behavior and acceptance criteria |
| `docs/references/linux-cli-deployment-zh.md` | Chinese operator deployment runbook |
| `docs/references/index.md` | Mark the Linux deployment reference as packaged deployment design |
| `docs/design-docs/index.md` | Add this design |
| `docs/exec-plans/active/2026-05-14-linux-cli-packaged-deployment.md` | Future implementation plan |
| `task-tracker.md` | Track active packaged deployment work |
| `docs/ARCHITECTURE.md` | Record the target packaging surface without claiming it is implemented |

## Validation Gates

Documentation phase:

```bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Implementation phase:

```bash
cd desktop-client && npm test
cd desktop-client && npm run package:linux-cli
```

Linux validation phase:

```bash
tar -xzf skilldrive-cli-<version>-linux-node20.tar.gz
cd skilldrive-cli-<version>-linux-node20
./install.sh --user
skilldrive-cli --help
skilldrive-cli config paths
skilldrive-cli detect --global --json
./uninstall.sh --user
```
