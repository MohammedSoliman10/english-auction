#!/usr/bin/env bash
# T024 — hosted demo chain: Anvil (chainId 2026) with state persistence.
# Research R3: anvil dumps on exit via its own --dump-state flag (a shell
# EXIT trap cannot be used here — `exec` replaces the shell and would destroy
# it, T067 review), and loads on boot so redeploys survive restarts.
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
  --dump-state "$STATE_FILE"
)

if [[ -f "$STATE_FILE" ]]; then
  ARGS+=(--load-state "$STATE_FILE")
  echo "start-chain: loading persisted state from $STATE_FILE"
else
  echo "start-chain: fresh chain (no state file yet at $STATE_FILE)"
fi

echo "start-chain: anvil on http://$HOST:$PORT (chainId $CHAIN_ID) — Ctrl-C to stop"
exec anvil "${ARGS[@]}"
