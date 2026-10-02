#!/usr/bin/env bash
# Regenerates public/og.png and public/apple-touch-icon.png from the HTML sources
# in this folder using a locally installed Chrome. Not part of the build.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
render() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size="$2" --screenshot="$3" "file://$PWD/$1" >/dev/null 2>&1; }
render og.html 1200,630 ../../public/og.png
render icon.html 180,180 ../../public/apple-touch-icon.png
echo "Wrote public/og.png and public/apple-touch-icon.png"
