#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DSH_HOME_VALUE="${DSH_HOME:-$HOME/.dsh}"

PROFILE="data-analysis"
REMOVE_VENV=0
for arg in "$@"; do
  case "$arg" in
    --remove-venv)
      REMOVE_VENV=1
      ;;
    --*)
      echo "unknown option: $arg" >&2
      exit 2
      ;;
    *)
      PROFILE="$arg"
      ;;
  esac
done

PROFILE_DIR="$DSH_HOME_VALUE/profiles/$PROFILE"
PRESET_DIR="$DSH_HOME_VALUE/.agent-presets/$PROFILE"
VENV_DIR="$ROOT/.venv"

case "$PROFILE_DIR" in
  "${DSH_HOME_VALUE}/profiles/"*) ;;
  *)
    echo "unsafe profile path: $PROFILE_DIR" >&2
    exit 1
    ;;
esac

case "$PRESET_DIR" in
  "${DSH_HOME_VALUE}/.agent-presets/"*) ;;
  *)
    echo "unsafe preset path: $PRESET_DIR" >&2
    exit 1
    ;;
esac

if [ -e "$PROFILE_DIR" ]; then
  rm -rf -- "$PROFILE_DIR"
  echo "Removed $PROFILE_DIR"
else
  echo "Already absent: $PROFILE_DIR"
fi

if [ -e "$PRESET_DIR" ]; then
  rm -rf -- "$PRESET_DIR"
  echo "Removed $PRESET_DIR"
else
  echo "Already absent: $PRESET_DIR"
fi

if [ "$REMOVE_VENV" -eq 1 ]; then
  case "$VENV_DIR" in
    "${ROOT}/.venv"*) ;;
    *)
      echo "unsafe venv path: $VENV_DIR" >&2
      exit 1
      ;;
  esac
  if [ -e "$VENV_DIR" ]; then
    rm -rf -- "$VENV_DIR"
    echo "Removed $VENV_DIR"
  else
    echo "Already absent: $VENV_DIR"
  fi
else
  echo "Kept plugin-local .venv. Pass --remove-venv to remove it too."
fi

echo
echo "Uninstalled profile '$PROFILE' and its agent preset."
