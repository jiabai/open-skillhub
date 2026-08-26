#!/usr/bin/env bash
# 更新公开技能（Public Skill）的辅助脚本。
# 两个独立子命令，各自对应不同的执行参数：
#   move <skill_name>  将当前目录下的 <skill_name> 移动到 $SKILL_STORAGE_PATH/__system__/
#   sync <skill_name>  运行 uv run python backend/scripts/sync_public_skills.py <skill_name>
#
# SKILL_STORAGE_PATH 从 backend/.env 读取（保持原样）；
# 若未配置，则回退到后端 settings 的默认值 /data/skills。
# 相对路径统一按「仓库根目录」解析，确保与从仓库根 cd 后执行 uv run 的结果一致。
set -euo pipefail

# 本脚本位于 <repo>/scripts/，据此定位仓库根
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/backend/.env"

# ---- 解析 SKILL_STORAGE_PATH ----
STORAGE_ROOT=""
if [[ -f "$ENV_FILE" ]]; then
  STORAGE_ROOT="$(grep -E '^SKILL_STORAGE_PATH[[:space:]]*=' "$ENV_FILE" | tail -n 1 \
    | sed -E 's/^SKILL_STORAGE_PATH[[:space:]]*=[[:space:]]*//' | tr -d '\r' | xargs)"
  # 去掉可能的单/双引号包裹
  STORAGE_ROOT="${STORAGE_ROOT%\"}"; STORAGE_ROOT="${STORAGE_ROOT#\"}"
  STORAGE_ROOT="${STORAGE_ROOT%\'}"; STORAGE_ROOT="${STORAGE_ROOT#\'}"
fi
if [[ -z "$STORAGE_ROOT" ]]; then
  STORAGE_ROOT="/data/skills"
fi

# 相对路径按仓库根解析，绝对路径保持原样
case "$STORAGE_ROOT" in
  /*) ;;
  *) STORAGE_ROOT="$REPO_ROOT/$STORAGE_ROOT" ;;
esac

SYSTEM_DIR="$STORAGE_ROOT/__system__"

usage() {
  cat <<EOF
用法:
  $0 move <skill_name>   将当前目录下的 <skill_name> 移动到 $STORAGE_ROOT/__system__/
  $0 sync <skill_name>   运行 uv run python backend/scripts/sync_public_skills.py <skill_name>

SKILL_STORAGE_PATH 解析自 backend/.env:
  -> $STORAGE_ROOT
EOF
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

MODE="$1"
SKILL_NAME="$2"

case "$MODE" in
  move)
    SRC="$PWD/$SKILL_NAME"
    if [[ ! -d "$SRC" ]]; then
      echo "Error: 源目录不存在: $SRC" >&2
      exit 1
    fi
    mkdir -p "$SYSTEM_DIR"
    DST="$SYSTEM_DIR/$SKILL_NAME"
    if [[ -e "$DST" ]]; then
      echo "移除已存在的旧目录 $DST ..."
      rm -rf "$DST"
    fi
    echo "移动 $SRC -> $DST"
    mv "$SRC" "$DST"
    ;;
  sync)
    cd "$REPO_ROOT"
    uv run python backend/scripts/sync_public_skills.py "$SKILL_NAME"
    ;;
  *)
    usage
    exit 1
    ;;
esac