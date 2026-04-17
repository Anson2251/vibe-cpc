#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
INPUT="$DIST_DIR/interpreter-quickjs.mjs"
OUTPUT="$DIST_DIR/caie-pseudocode"
TEMP_C="$DIST_DIR/interpreter-quickjs.c"

if ! command -v qjsc &>/dev/null; then
    echo "Error: qjsc not found. Please install QuickJS first." >&2
    echo "  macOS: brew install quickjs" >&2
    echo "  Linux: install from your package manager or build from https://github.com/quickjs-ng/quickjs" >&2
    exit 1
fi

if [ ! -f "$INPUT" ]; then
    echo "Error: $INPUT not found. Run 'pnpm build' first." >&2
    exit 1
fi

cleanup() {
    rm -f "$TEMP_C"
}
trap cleanup EXIT

echo "Step 1/2: Generating C source from $INPUT ..."
qjsc -e -fno-module-loader -o "$TEMP_C" "$INPUT" || {
    echo "Error: qjsc code generation failed" >&2
    exit 1
}

echo "Step 2/2: Compiling $TEMP_C -> $OUTPUT ..."
cc -flto \
    -I/usr/include/quickjs \
    -L/usr/lib/x86_64-linux-gnu/quickjs \
    -o "$OUTPUT" "$TEMP_C" \
    -lquickjs -lm -lpthread || {
    echo "Error: C compilation failed" >&2
    exit 1
}

chmod +x "$OUTPUT"
echo "Done: $OUTPUT"
