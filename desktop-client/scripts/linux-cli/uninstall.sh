#!/usr/bin/env sh
# Keep this file LF-only; Linux shebang parsing treats CR as part of the interpreter.
set -eu

usage() {
  cat <<'EOF'
Usage: ./uninstall.sh [--user|--system] [--prefix <path>] [--bin-dir <path>] [--purge-data] [--dry-run]

Removes the packaged SkillDrive Linux CLI program files. CLI data is preserved
unless --purge-data is supplied.
EOF
}

fail() {
  echo "uninstall.sh: $*" >&2
  exit 1
}

is_dry_run=0
purge_data=0
mode="user"
prefix=""
bin_dir=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --user)
      mode="user"
      shift
      ;;
    --system)
      mode="system"
      shift
      ;;
    --prefix)
      [ "$#" -ge 2 ] || fail "--prefix requires a path"
      prefix="$2"
      shift 2
      ;;
    --bin-dir)
      [ "$#" -ge 2 ] || fail "--bin-dir requires a path"
      bin_dir="$2"
      shift 2
      ;;
    --purge-data)
      purge_data=1
      shift
      ;;
    --dry-run)
      is_dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

[ "$(uname -s)" = "Linux" ] || fail "Linux is required"

if [ -z "$prefix" ]; then
  if [ "$mode" = "system" ]; then
    prefix="/opt/skilldrive-cli"
  else
    data_home="${XDG_DATA_HOME:-"$HOME/.local/share"}"
    prefix="$data_home/skilldrive-cli"
  fi
fi

if [ -z "$bin_dir" ]; then
  if [ "$mode" = "system" ]; then
    bin_dir="/usr/local/bin"
  else
    bin_dir="$HOME/.local/bin"
  fi
fi

command_link="$bin_dir/skilldrive-cli"

case "$prefix" in
  ""|"/"|"$HOME"|"$HOME/"|"/opt"|"/usr"|"/usr/local")
    fail "refusing unsafe install prefix: $prefix"
    ;;
esac

run() {
  if [ "$is_dry_run" -eq 1 ]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

echo "Uninstalling skilldrive-cli"
echo "  prefix: $prefix"
echo "  command: $command_link"

if [ -e "$command_link" ] && [ ! -L "$command_link" ]; then
  fail "$command_link exists and is not a symlink; refusing to remove it"
fi

if [ -L "$command_link" ]; then
  run rm -f "$command_link"
fi

if [ -e "$prefix" ]; then
  run rm -rf "$prefix"
fi

if [ "$purge_data" -eq 1 ]; then
  config_home="${XDG_CONFIG_HOME:-"$HOME/.config"}"
  state_home="${XDG_STATE_HOME:-"$HOME/.local/state"}"
  cache_home="${XDG_CACHE_HOME:-"$HOME/.cache"}"

  for path in \
    "$config_home/skilldrive-cli" \
    "$state_home/skilldrive-cli" \
    "$cache_home/skilldrive-cli"
  do
    case "$path" in
      "$config_home"/skilldrive-cli|"$state_home"/skilldrive-cli|"$cache_home"/skilldrive-cli)
        echo "Purging data: $path"
        if [ -e "$path" ]; then
          run rm -rf "$path"
        fi
        ;;
      *)
        fail "refusing unsafe purge path: $path"
        ;;
    esac
  done
else
  cat <<'EOF'
CLI data was preserved. To remove config, state, and cache on a disposable
machine, rerun with --purge-data.
EOF
fi
