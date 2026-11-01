#!/usr/bin/env bash
# Gera vendor/anthropic-sdk.js: o SDK oficial da Anthropic (TypeScript/JS) empacotado
# para o navegador, exposto como window.Anthropic. Sem CDN: vai embutido no horacio.html.
set -euo pipefail
VERSION="${1:-0.135.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
cd "$TMP"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund "@anthropic-ai/sdk@${VERSION}" esbuild@0.24.2
printf 'import Anthropic from "@anthropic-ai/sdk";\nwindow.Anthropic = Anthropic;\n' > entry.mjs
npx esbuild entry.mjs --bundle --format=iife --platform=browser --minify --target=es2020 \
  --legal-comments=none --outfile="$ROOT/vendor/anthropic-sdk.js"
echo "vendor/anthropic-sdk.js gerado (@anthropic-ai/sdk ${VERSION})"
