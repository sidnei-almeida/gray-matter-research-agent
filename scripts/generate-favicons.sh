#!/usr/bin/env bash
# Regenerate PNG favicons from public/favicon.svg (requires ImageMagick 7+)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVG="$ROOT/public/favicon.svg"
OUT="$ROOT/public"

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) is required. Install: pacman -S imagemagick / apt install imagemagick"
  exit 1
fi

magick "$SVG" -resize 16x16 "$OUT/favicon-16x16.png"
magick "$SVG" -resize 32x32 "$OUT/favicon-32x32.png"
magick "$SVG" -resize 180x180 "$OUT/apple-touch-icon.png"
magick "$SVG" -resize 192x192 "$OUT/android-chrome-192x192.png"
magick "$SVG" -resize 512x512 "$OUT/android-chrome-512x512.png"
magick "$OUT/favicon-16x16.png" "$OUT/favicon-32x32.png" "$OUT/favicon.ico"

magick -size 1200x630 "xc:#050805" \
  \( "$SVG" -resize 220x220 \) -gravity center -composite \
  "$OUT/og-image.png"

echo "Favicons written to $OUT"
