#!/bin/sh
# Rebuild assets/js/vendor/three.min.js: three.js, minified, with only the
# parts of it the site uses. Run it from anywhere after using a part of
# three.js that the site did not use before (a new THREE.Something), or to
# move to another version of three.js. It needs Node.js (npx).
#
#   sh tools/three.sh            # three.js 0.187.0
#   sh tools/three.sh 0.188.0    # another version
set -eu
VERSION="${1:-0.187.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Every THREE.Something named in the site's scripts.
NAMES="$(grep -ohE 'THREE\.[A-Za-z0-9_]+' -r "$ROOT/assets/js" --include='*.js' --exclude-dir=vendor \
  | sed 's/^THREE\.//' | sort -u | paste -sd, -)"
echo "export { $NAMES } from \"three\";" > "$WORK/entry.js"

cd "$WORK"
npm init -y > /dev/null
npm install --silent --no-audit --no-fund "three@$VERSION" esbuild@0.25 > /dev/null
npx esbuild entry.js --bundle --format=esm --minify --target=es2022 --legal-comments=none \
  --banner:js="/* three.js $VERSION (https://threejs.org), only the parts this site uses. Copyright 2010-2026 Three.js Authors. MIT License. Built by tools/three.sh. */" \
  --outfile="$ROOT/assets/js/vendor/three.min.js"
echo "Wrote assets/js/vendor/three.min.js ($(wc -c < "$ROOT/assets/js/vendor/three.min.js" | tr -d ' ') bytes)"
