#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage: ./install.sh [--user|--system] [--prefix <path>] [--bin-dir <path>] [--dry-run] [--force]

Installs the packaged SkillDrive Linux CLI release.
EOF
}

fail() {
  echo "install.sh: $*" >&2
  exit 1
}

is_dry_run=0
force=0
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
    --dry-run)
      is_dry_run=1
      shift
      ;;
    --force)
      force=1
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
command -v node >/dev/null 2>&1 || fail "Node.js 20+ is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
[ "$node_major" -ge 20 ] || fail "Node.js 20+ is required, found $(node --version)"

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
manifest_path="$script_dir/manifest.json"
[ -f "$manifest_path" ] || fail "manifest.json is missing"
version="$(node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).version)" "$manifest_path")"

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

release_dir="$prefix/releases/$version"
current_link="$prefix/current"
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

echo "Installing skilldrive-cli $version"
echo "  prefix: $prefix"
echo "  command: $command_link"

if [ -e "$release_dir" ] && [ "$force" -ne 1 ]; then
  fail "$release_dir already exists; rerun with --force to replace this release"
fi

if [ -e "$command_link" ] && [ ! -L "$command_link" ] && [ "$force" -ne 1 ]; then
  fail "$command_link exists and is not a symlink; rerun with --force only if you want to replace it"
fi

tmp_dir="$prefix/.install-$version-$$"

if [ "$is_dry_run" -eq 0 ]; then
  rm -rf "$tmp_dir"
fi

run mkdir -p "$prefix/releases" "$bin_dir" "$tmp_dir"

if [ "$is_dry_run" -eq 0 ]; then
  (cd "$script_dir" && tar -cf - .) | (cd "$tmp_dir" && tar -xf -)
  if [ -e "$release_dir" ]; then
    rm -rf "$release_dir"
  fi
  mv "$tmp_dir" "$release_dir"
else
  echo "[dry-run] copy release files to $tmp_dir"
  echo "[dry-run] move $tmp_dir to $release_dir"
fi

if [ "$is_dry_run" -eq 0 ]; then
  ln -sfn "$release_dir" "$current_link"
  ln -sfn "$current_link/bin/skilldrive-cli" "$command_link"
  "$command_link" --help >/dev/null
else
  echo "[dry-run] ln -sfn $release_dir $current_link"
  echo "[dry-run] ln -sfn $current_link/bin/skilldrive-cli $command_link"
  echo "[dry-run] $command_link --help"
fi

cat <<EOF
Installed skilldrive-cli $version.

Verify:
  skilldrive-cli --help
  skilldrive-cli config paths
  skilldrive-cli detect --global
EOF
