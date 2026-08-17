#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
VENV="$ROOT/.venv"
REQUIREMENTS="$ROOT/requirements-data-analysis.txt"

if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
fi

if [ -x "$VENV/Scripts/python.exe" ]; then
  PYTHON="$VENV/Scripts/python.exe"
else
  PYTHON="$VENV/bin/python"
fi

"$PYTHON" -m pip install --upgrade pip
"$PYTHON" -m pip install -r "$REQUIREMENTS"

echo
echo "Python environment ready: $PYTHON"
echo "Export DSH_PYTHON so dsh uses it:"
echo "  export DSH_PYTHON=\"$PYTHON\""
