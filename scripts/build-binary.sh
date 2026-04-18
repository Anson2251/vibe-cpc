#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
BUILD_DIR="$PROJECT_DIR/build/quickjs"
INPUT="$DIST_DIR/vibe-cpc-quickjs.mjs"
OUTPUT="$DIST_DIR/vibe-cpc"
TEMP_C="$DIST_DIR/vibe-cpc-quickjs.c"

QJS_VERSION="0.14.0"
RELEASE_BASE="https://github.com/quickjs-ng/quickjs/releases/download/v${QJS_VERSION}"
AMALGAM_URL="${RELEASE_BASE}/quickjs-amalgam.zip"

IS_WINDOWS=false
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    IS_WINDOWS=true
    OUTPUT="$DIST_DIR/vibe-cpc.exe"
fi

if [ ! -f "$INPUT" ]; then
    echo "Error: $INPUT not found. Run 'pnpm build' first." >&2
    exit 1
fi

if ! command -v cc &>/dev/null; then
    echo "Error: cc (C compiler) not found." >&2
    exit 1
fi

mkdir -p "$BUILD_DIR"

# --- Download amalgam if not present ---
AMALGAM_DIR="$BUILD_DIR/amalgam"
if [ ! -f "$AMALGAM_DIR/quickjs-amalgam.c" ]; then
    echo "Downloading QuickJS amalgam v${QJS_VERSION} ..."
    ZIP_PATH="$BUILD_DIR/quickjs-amalgam.zip"
    if command -v curl &>/dev/null; then
        curl -L "$AMALGAM_URL" -o "$ZIP_PATH"
    elif command -v wget &>/dev/null; then
        wget -O "$ZIP_PATH" "$AMALGAM_URL"
    else
        echo "Error: curl or wget required" >&2
        exit 1
    fi

    echo "Extracting amalgam ..."
    mkdir -p "$AMALGAM_DIR"
    unzip -q -o "$ZIP_PATH" -d "$AMALGAM_DIR"
    rm -f "$ZIP_PATH"
fi

# --- Download qjsc if not present ---
QJSC="$BUILD_DIR/qjsc"
if [ "$IS_WINDOWS" = true ]; then
    QJSC="$BUILD_DIR/qjsc.exe"
fi

if [ ! -f "$QJSC" ]; then
    echo "Downloading qjsc for your platform ..."
    OS_NAME="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS_NAME" in
        Darwin)
            QJSC_ASSET="qjsc-darwin"
            ;;
        Linux)
            if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
                QJSC_ASSET="qjsc-linux-aarch64"
            elif [ "$ARCH" = "armv7l" ]; then
                QJSC_ASSET="qjsc-linux-armv7"
            else
                QJSC_ASSET="qjsc-linux-x86_64"
            fi
            ;;
        MINGW*|MSYS*|CYGWIN*)
            if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
                QJSC_ASSET="qjsc-windows-x86_64.exe"
            else
                QJSC_ASSET="qjsc-windows-x86.exe"
            fi
            ;;
        *)
            echo "Error: Unsupported OS: $OS_NAME" >&2
            exit 1
            ;;
    esac

    QJSC_URL="${RELEASE_BASE}/${QJSC_ASSET}"
    if command -v curl &>/dev/null; then
        curl -L "$QJSC_URL" -o "$QJSC"
    elif command -v wget &>/dev/null; then
        wget -O "$QJSC" "$QJSC_URL"
    fi
    chmod +x "$QJSC"
fi

cleanup() {
    rm -f "$TEMP_C"
}
trap cleanup EXIT

# --- Step 1: Generate C source with qjsc ---
echo "Step 1/2: Generating C source from $INPUT ..."
"$QJSC" -e -s -s -o "$TEMP_C" "$INPUT" || {
    echo "Error: qjsc code generation failed" >&2
    exit 1
}

# --- Step 2: Compile to standalone binary ---
echo "Step 2/2: Compiling $TEMP_C -> $OUTPUT ..."
if [ "$IS_WINDOWS" = true ]; then
    cc -O3 -static -static-libgcc \
        -I"$AMALGAM_DIR" \
        -DQJS_BUILD_LIBC \
        -o "$OUTPUT" "$AMALGAM_DIR/quickjs-amalgam.c" "$TEMP_C" \
        -Wl,--stack,8388608 || {
        echo "Error: C compilation failed" >&2
        exit 1
    }
else
    cc -O3 \
        -I"$AMALGAM_DIR" \
        -DQJS_BUILD_LIBC \
        -o "$OUTPUT" "$AMALGAM_DIR/quickjs-amalgam.c" "$TEMP_C" \
        -lm -lpthread || {
        echo "Error: C compilation failed" >&2
        exit 1
    }
    if [[ "$OSTYPE" == "darwin"* ]]; then
        strip "$OUTPUT"
    else
        strip -s "$OUTPUT"
    fi
fi

chmod +x "$OUTPUT"
echo "Done: $OUTPUT"
