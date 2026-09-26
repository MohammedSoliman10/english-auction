#!/usr/bin/env bash
# Quality gate — constitution Tooling & Workflow gates.
# Usage: scripts/check.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { echo; echo "==> $1"; }

step "[1/9] forge fmt --check (Solidity formatting)"
(cd contracts && forge fmt --check)

step "[2/9] forge lint (Solidity linting)"
(cd contracts && forge lint)

step "[3/9] forge build (solc 0.8.31, zero warnings)"
(cd contracts && forge build)

step "[4/9] forge test (unit + fuzz + invariant)"
(cd contracts && forge test)

step "[5/9] forge coverage gate (>=95% lines, >=90% branches)"
(cd contracts && forge coverage --report lcov > /dev/null) || true
node scripts/coverage-check.mjs contracts/lcov.info 95 90

step "[6/9] ESLint (frontend + backend, zero warnings)"
npm run lint --silent -w frontend
npm run lint --silent -w backend

step "[7/9] Frontend build + SC-006 bundle budget (<=300KB gzip)"
npm run build --silent -w frontend
node scripts/bundle-budget.mjs frontend/dist 300

step "[8/9] SC-004 palette gate (no color literals outside caliper.css)"
if grep -rEn '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(' frontend/src \
    --include='*.ts' --include='*.tsx' --include='*.jsx' | grep -v 'src/styles/'; then
  echo "FAIL: color literal found outside frontend/src/styles/caliper.css"
  exit 1
fi
echo "palette gate: OK (0 stray color literals)"

step "[9/9] Vitest coverage (frontend + backend, >=95/90 thresholds)"
npm run coverage --silent -w backend
npm run coverage --silent -w frontend

echo
echo "ALL GATES GREEN"
