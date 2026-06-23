#!/usr/bin/env bash
# Build the foundation-models-c Swift package into a dynamic library.
set -euo pipefail

echo "Building Apple Foundation Models C bindings …"

# macOS only
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "Error: This library can only be built on macOS" >&2
  exit 1
fi

# Require macOS 26+
MACOS_MAJOR=$(sw_vers -productVersion | cut -d. -f1)
if (( MACOS_MAJOR < 26 )); then
  echo "Error: Need macOS 26.0+ (FoundationModels). Current: $(sw_vers -productVersion)" >&2
  exit 1
fi

FM_C_DIR="reference/python-apple-fm-sdk/foundation-models-c"

if [[ ! -d "$FM_C_DIR" ]]; then
  echo "Error: foundation-models-c not found at $FM_C_DIR" >&2
  exit 1
fi

mkdir -p build

echo "Building Swift package (release) …"
pushd "$FM_C_DIR" > /dev/null
swift build -c release 2>&1
popd > /dev/null

# Copy the built dylib to build/
DYLIB_SRC="$FM_C_DIR/.build/release/libFoundationModels.dylib"
if [[ -f "$DYLIB_SRC" ]]; then
  cp "$DYLIB_SRC" build/libFoundationModels.dylib
  echo "Copied to build/libFoundationModels.dylib"
else
  echo "Error: dylib not found at $DYLIB_SRC" >&2
  echo "Checking available build artifacts …"
  find "$FM_C_DIR/.build/release" -name "*.dylib" -o -name "*.a" 2>/dev/null || true
  exit 1
fi

echo "Build complete."
