#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
BUILD_DIR="$PROJECT_DIR/build/quickjs"
INPUT="$DIST_DIR/interpreter-quickjs.mjs"
OUTPUT="$DIST_DIR/caie-pseudocode"
TEMP_C="$DIST_DIR/interpreter-quickjs.c"

QJS_URL="https://github.com/bellard/quickjs/archive/refs/heads/master.zip"
QJS_SRC="$BUILD_DIR/quickjs-master"

if [ ! -f "$INPUT" ]; then
    echo "Error: $INPUT not found. Run 'pnpm build' first." >&2
    exit 1
fi

if ! command -v cc &>/dev/null; then
    echo "Error: cc (C compiler) not found." >&2
    exit 1
fi

if ! command -v make &>/dev/null; then
    echo "Error: make not found." >&2
    exit 1
fi

# --- Build QuickJS if not already built ---
if [ ! -f "$QJS_SRC/qjsc" ]; then
    echo "QuickJS not found locally, downloading and building ..."

    mkdir -p "$BUILD_DIR"

    if [ ! -d "$QJS_SRC" ]; then
        if command -v curl &>/dev/null; then
            curl -L "$QJS_URL" -o "$BUILD_DIR/quickjs-master.zip"
        elif command -v wget &>/dev/null; then
            wget -O "$BUILD_DIR/quickjs-master.zip" "$QJS_URL"
        else
            echo "Error: curl or wget required to download QuickJS" >&2
            exit 1
        fi

        echo "Extracting ..."
        unzip -q "$BUILD_DIR/quickjs-master.zip" -d "$BUILD_DIR"
        rm -f "$BUILD_DIR/quickjs-master.zip"
    fi

    echo "Building QuickJS (this may take a moment) ..."
    make -C "$QJS_SRC" qjsc libquickjs.a -j"$(nproc 2>/dev/null || echo 1)"
    echo "QuickJS built successfully."
fi

QJSC="$QJS_SRC/qjsc"
QJS_INCLUDE="$QJS_SRC"
QJS_LIB="$QJS_SRC"

cleanup() {
    rm -f "$TEMP_C"
}
trap cleanup EXIT

# --- Step 1: Generate C source with qjsc ---
echo "Step 1/2: Generating C source from $INPUT ..."
"$QJSC" -e -fno-module-loader -o "$TEMP_C" "$INPUT" || {
    echo "Error: qjsc code generation failed" >&2
    exit 1
}

# --- Step 2: Compile to standalone binary ---
echo "Step 2/2: Compiling $TEMP_C -> $OUTPUT ..."
cc -flto \
    -I"$QJS_INCLUDE" \
    -L"$QJS_LIB" \
    -o "$OUTPUT" "$TEMP_C" \
    -lquickjs -lm -lpthread || {
    echo "Error: C compilation failed" >&2
    exit 1
}

chmod +x "$OUTPUT"
echo "Done: $OUTPUT"
