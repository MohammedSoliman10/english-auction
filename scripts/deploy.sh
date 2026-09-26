#!/usr/bin/env bash
# T024 — deploy both contracts to the hosted chain and write backend/.env.
# Contract (chain-interface §3): SolimanWeb3 → mintNFT(0, deployer) →
# EnglishAuction(nft, 0, STARTING_BID_WEI, DURATION_SECONDS).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="${CHAIN_ID:-2026}"
export STARTING_BID_WEI="${STARTING_BID_WEI:-1000000000000000}"   # 0.001 ETH
export DURATION_SECONDS="${DURATION_SECONDS:-604800}"             # 7 days (demo: 60)

# Anvil dev key #0 (publicly known test key) — deployer = demo seller.
DEPLOYER_KEY="${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

echo "deploy: building contracts (solc 0.8.31)…"
(cd contracts && forge build --quiet)

mkdir -p "$ROOT/.anvil"
echo "deploy: broadcasting ONCE to $RPC_URL (chainId $CHAIN_ID)…"
(cd contracts && forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast \
  --json) | tee "$ROOT/.anvil/last-deploy.json" >/dev/null

# Parse the broadcast run-latest.json: CREATE receipts in deployment order
# (SolimanWeb3 first, EnglishAuction second).
BROADCAST_FILE="$(ls -1t "$ROOT"/contracts/broadcast/Deploy.s.sol/*/run-latest.json 2>/dev/null | head -1 || true)"
if [[ -z "$BROADCAST_FILE" ]]; then
  echo "deploy: ERROR — no broadcast output (is the chain running at $RPC_URL?)" >&2
  exit 1
fi

read -r NFT_ADDRESS AUCTION_ADDRESS < <(node -e '
  const fs = require("fs");
  const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const creates = (j.transactions ?? [])
    .filter((t) => t.transactionType === "CREATE")
    .map((t) => t.contractAddress)
    .filter(Boolean);
  console.log((creates[0] ?? "") + " " + (creates[1] ?? ""));
' "$BROADCAST_FILE")

if [[ -z "${NFT_ADDRESS:-}" || -z "${AUCTION_ADDRESS:-}" ]]; then
  echo "deploy: ERROR — broadcast file missing CREATE receipts: $BROADCAST_FILE" >&2
  exit 1
fi

ENV_FILE="$ROOT/backend/.env"
cat > "$ENV_FILE" <<EOF
# Written by scripts/deploy.sh — $(date -u +%FT%TZ)
PORT=3000
ANVIL_URL=$RPC_URL
CHAIN_ID=$CHAIN_ID
CHAIN_NAME=English Auction Chain
NFT_ADDRESS=$NFT_ADDRESS
AUCTION_ADDRESS=$AUCTION_ADDRESS
STARTING_BID_WEI=$STARTING_BID_WEI
DURATION_SECONDS=$DURATION_SECONDS
DEPLOYED_AT=$(date -u +%FT%TZ)
EOF

echo "deploy: NFT         = $NFT_ADDRESS"
echo "deploy: AUCTION     = $AUCTION_ADDRESS"
echo "deploy: wrote $ENV_FILE"
