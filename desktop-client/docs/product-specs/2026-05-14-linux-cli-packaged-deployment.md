# Linux CLI Packaged Deployment

Status: implemented package assembly; Linux target install validation pending
Scope: `desktop-client/`

## Purpose

Replace the Linux `skilldrive-cli` CLI deployment guidance based on copying
`desktop-client/`, installing npm dependencies, rebuilding on the target
machine, and `npm link` with a reviewed package-and-install-script deployment
path.

This spec only changes CLI delivery and installation. It does not change CLI
command semantics, XDG config/state/cache isolation, secure write rules, or
server sync contracts.

## Background

The current Chinese deployment reference requires the target machine to have a
full repository directory, npm dependency installation, and CLI build
capability. This creates several problems:

- Target machines bear build responsibilities, making the install chain too long.
- `npm link` is a local development command, not suitable for stable deployment
  and upgrades.
- Target machines must understand the `desktop-client/` repository structure.
- Deployment, upgrades, and uninstallation lack a clear file boundary.

Additionally, the current `dist-cli/skilldrive-cli.js` is not a fully
standalone file. The build output still resolves Node dependencies and
`sql.js/dist/sql-wasm.wasm`, so the release package must explicitly include
the CLI runtime dependency closure or adjust the build configuration during
implementation and prove with tests that dependencies are correctly bundled.

## Goals

- Release a Linux CLI tarball instead of requiring target machines to clone the
  repository.
- The tarball contains the CLI runtime, necessary dependencies, install script,
  uninstall script, manifest, and checksums.
- Target machines only need Linux, Node.js, and basic shell tools; no git, npm,
  TypeScript, or Vite.
- After installation, provide a stable `skilldrive-cli` command.
- Support user-level and system-level installation.
- Upgrades preserve existing CLI XDG config, state, cache, and API Base URL.
- Uninstall removes only program files and command links by default; data cleanup
  requires an explicit choice.
- Continue to prohibit persisting API tokens.
- Continue to keep all Agent-directory-writing CLI commands dry-run by default,
  requiring explicit `--yes` to execute.

## Non-Goals

- No single-file native binary in this spec.
- No `.deb`, `.rpm`, Homebrew, AUR, or snap packages in this spec.
- Install scripts do not install Node.js.
- No background daemon, systemd service, or auto-updater.
- No change to `install`, `sync`, `detect`, `config` command semantics.
- No expansion of Linux CLI v1 encrypted server download support.
- No desktop Electron runtime in the CLI release package.

## User Experience

The publisher generates the artifact on the build machine:

```bash
cd desktop-client
npm ci
npm run package:linux-cli
```

Generated target artifacts:

```text
dist/linux-cli/
  skilldrive-cli-<version>-linux-node20.tar.gz
  skilldrive-cli-<version>-linux-node20.tar.gz.sha256
```

The operator installs on the Linux target machine:

```bash
tar -xzf skilldrive-cli-<version>-linux-node20.tar.gz
cd skilldrive-cli-<version>-linux-node20
./install.sh --user
```

System-level installation:

```bash
sudo ./install.sh --system
```

Post-install verification:

```bash
skilldrive-cli --help
skilldrive-cli config paths
skilldrive-cli detect --global
```

Upgrades re-run `install.sh` from the new version tarball. User-level XDG
config, state, and cache are not deleted during program upgrades.

## Target Runtime

- Linux x86_64 or arm64.
- Node.js 20 LTS or newer.
- POSIX shell, `tar`, `mkdir`, `ln`, `cp`, `rm`, `chmod`.

Node.js 20 is the default floor for the target deployment spec because the
current `vite.cli.config.ts` CLI build target is `node20`. If Node.js 18
support is desired later, the build target must be lowered and Node.js 18
validation added during implementation.

## Package Contents

The unpacked release directory should contain:

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
    ...
  docs/
    README-zh.md
```

Requirements:

- `bin/skilldrive-cli` is a lightweight wrapper that only invokes the
  in-package `lib/skilldrive-cli.js`.
- `node_modules/` only contains the CLI runtime dependency closure, not
  Electron, React, renderer, test frameworks, or build tools.
- `manifest.json` records at least the version, build time, git commit, Node
  floor, entry file, and dependency strategy.
- `runtime-dependencies.json` records the runtime dependency closure and
  versions resolved from `package-lock.json`.
- `SHA256SUMS` covers executable scripts, CLI JS entry, runtime dependency
  manifests, and document digests within the package.

## Install Boundaries

User-level installation:

```text
$XDG_DATA_HOME/skilldrive-cli/releases/<version>/
$XDG_DATA_HOME/skilldrive-cli/current -> releases/<version>
~/.local/bin/skilldrive-cli -> current/bin/skilldrive-cli
```

When `$XDG_DATA_HOME` is unset, fall back to `~/.local/share`.

System-level installation:

```text
/opt/skilldrive-cli/releases/<version>/
/opt/skilldrive-cli/current -> releases/<version>
/usr/local/bin/skilldrive-cli -> /opt/skilldrive-cli/current/bin/skilldrive-cli
```

The install script must only write to the above program directories and command
links. CLI config, state, and cache are still written by runtime commands to
existing XDG paths:

```text
$XDG_CONFIG_HOME/skilldrive-cli/
$XDG_STATE_HOME/skilldrive-cli/
$XDG_CACHE_HOME/skilldrive-cli/
```

## Install Script Requirements

`install.sh` must support:

- `--user`
- `--system`
- `--prefix <path>`
- `--bin-dir <path>`
- `--dry-run`
- `--force`

Behavior requirements:

- Validate the current system is Linux.
- Validate Node.js version meets the floor.
- Refuse to overwrite non-SkillDrive-managed target paths without confirmation.
- Copy to a temporary directory, then switch the `current` symlink.
- Run `skilldrive-cli --help` after installation as a smoke test.
- Print follow-up `skilldrive-cli config paths` and `detect --global`
  verification commands.

`uninstall.sh` must support:

- `--user`
- `--system`
- `--prefix <path>`
- `--bin-dir <path>`
- `--purge-data`
- `--dry-run`

Default uninstall removes only program directories and command links.
`--purge-data` is required to delete CLI XDG config, state, and cache, and
must explicitly list the paths to be removed in script output.

## Security Requirements

- The release package must provide a sha256 checksum file.
- Install scripts must not accept, print, write, or persist API tokens.
- Install scripts must not modify Agent skill directories; Agent directory
  writes must still only be triggered by `skilldrive-cli install|sync --yes`.
- System-level installation requires the operator to explicitly use `sudo` or a
  root shell.
- Before deleting paths, scripts must confirm the target is inside the managed
  install prefix or CLI XDG data paths.
- Documentation recommends "download, verify, extract, run local script" flow,
  not `curl | sh`.

## Acceptance Criteria

- On a clean Linux machine without git, npm, TypeScript, or Vite, the CLI can
  be installed using only Node.js 20+ and the release tarball.
- `skilldrive-cli --help` runs after both user-level and system-level
  installation.
- `skilldrive-cli config paths` still shows `skilldrive-cli` XDG paths, not
  the program install directory.
- Upgrade installation does not delete `config.json`, `agent-paths.json`,
  `state.sqlite3`, or cache.
- Default uninstall does not delete CLI user data.
- `--purge-data` uninstall lists and deletes CLI XDG data paths.
- The release package does not contain Electron, React, renderer build
  artifacts, test frameworks, or TypeScript build tools.
- Documentation updates pass:

```bash
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

Implementation must also pass:

```bash
cd desktop-client && npm test
cd desktop-client && npm run package:linux-cli
```

## References

- CLI runtime spec: `2026-05-13-linux-cli-distribution.md`
- CLI technical design: `../design-docs/linux-cli-distribution.md`
- Packaged deployment technical design: `../design-docs/linux-cli-packaged-deployment.md`
- Chinese deployment guide: `../references/linux-cli-deployment-zh.md`
