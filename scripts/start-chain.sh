#!/usr/bin/env bash
# T024 — hosted demo chain: Anvil (chainId 2026) with state persistence.
# Research R3: state dumps on stop (via anvil_setIntervalMining? no — handled by
# trap + anvil's own dump), loads on boot so redeploys survive restarts.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_FILE="${ANVIL_STATE_FILE:-$ROOT/.anvil/state.json}"
HOST="${ANVIL_HOST:-127.0.0.1}"
PORT="${ANVIL_PORT:-8545}"
CHAIN_ID="${CHAIN_ID:-2026}"

mkdir -p "$(dirname "$STATE_FILE")"

ARGS=(
  --host "$HOST"
  --port "$PORT"
  --chain-id "$CHAIN_ID"
  --accounts 10
  --balance 10000
)

if [[ -f "$STATE_FILE" ]]; then
  ARGS+=(--load-state "$STATE_FILE")
  echo "start-chain: loading persisted state from $STATE_FILE"
else
  echo "start-chain: fresh chain (no state file yet at $STATE_FILE)"
fi

echo "start-chain: anvil on http://$HOST:$PORT (chainId $CHAIN_ID) — Ctrl-C to stop"
# shellcheck disable=SC2064
trap "anvil dump-state $STATE_FILE >/dev/null 2>&1 || true" EXIT
exec anvil "${ARGS[@]}"
