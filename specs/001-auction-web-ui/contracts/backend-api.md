# Contract: Backend API (Express — `backend/src/`)

**Feature**: 001-auction-web-ui | **Date**: 2026-09-26 | **Spec**: FR-013, FR-014, FR-015
Base URL: same origin as the SPA. All responses JSON, UTF-8. Nothing here signs
transactions or holds keys (FR-014).

---

## 1. `GET /api/health`

Liveness + chain reachability.

**200 Response**
```json
{ "status": "ok", "chain": "up", "uptimeSec": 1234 }
```
**200 Response (node down — degrade, do NOT 500)**
```json
{ "status": "degraded", "chain": "down", "uptimeSec": 1234 }
```

---

## 2. `GET /api/config`

Runtime config consumed by the SPA boot (R4) — never baked into the bundle.

**200 Response**
```json
{
  "chainId": 2026,
  "chainName": "English Auction Chain",
  "rpcUrl": "/rpc",
  "nativeCurrency": { "name": "Ether", "symbol": "ETH", "decimals": 18 },
  "auctionAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "nftAddress": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "deployedAt": "2026-09-26T12:00:00Z"
}
```
**503** if env not provisioned (missing `AUCTION_ADDRESS`):
```json
{ "error": "not_deployed", "message": "Run scripts/deploy.sh first" }
```

---

## 3. `POST /rpc` (and `GET /rpc` with `?data=<urlencoded json>`)

JSON-RPC pass-through to the server-hosted Anvil (`ANVIL_URL`, default
`http://127.0.0.1:8545`). Purpose: keep the node on localhost, single-origin CORS for
browser *and* wallet-extension origins, and normalize failures.

**Request**: standard EIP-1474 body (single or batch):
```json
{ "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": [] }
```

**Behavior**:
- Forwards body unchanged; returns node's JSON-RPC response verbatim (200).
- Batch arrays forwarded as-is.
- **CORS**: `Access-Control-Allow-Origin` for the app origin + wallet-extension origins;
  handle `OPTIONS` preflight (`POST` content-type `application/json`).
- **Limits**: body ≤ 256 KB; upstream timeout 5 s; method passthrough (no method
  filtering needed — node is chain-only, no admin surface exposed; anvil is started
  without `--unlock` accounts beyond defaults).
- Unknown routes → SPA `index.html` fallback (200, history API), except `/api/*`,
  `/rpc` (404 JSON for unmatched API paths).

**Error mappings**:

| Condition | Status | Body |
|-----------|--------|------|
| Malformed JSON | 400 | `{ "error": "invalid_json" }` |
| Node unreachable / timeout | 502 | `{ "error": "chain_unreachable", "message": "…" }` |

*(The SPA renders `chain_unreachable` as the spec's connection-error state.)*

---

## 4. Static hosting

`backend` serves `frontend/dist/` in production (`express.static` + fallback). In dev,
Vite serves the SPA and proxies `/api` + `/rpc` to Express (Vite `server.proxy`).

---

## Non-goals

No database, no sessions/auth, no REST resources beyond the two endpoints above, no
server-side signing — the chain is the source of truth (YAGNI; FR-014).
