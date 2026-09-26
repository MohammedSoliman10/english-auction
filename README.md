# English Auction

Single-page web app for on-chain English auctions — a strictly monochrome ("Caliper")
instrument UI over two Solidity contracts, with a hosted shared chain (no Sepolia, no
visitor-side tooling).

| Layer | Tech |
|-------|------|
| Contracts | Foundry · solc **0.8.31** (pinned) · OpenZeppelin **v5.7.0** |
| Frontend | React 19 · Vite · wagmi v3 / viem 2 · Tailwind CSS v4 |
| Backend | Node ≥ 20 · Express 5 — serves SPA, `/api/*`, proxies `/rpc` |
| Chain | Anvil (chainId **2026**), hosted server-side with state persistence |

## Run — development

```bash
npm install
./scripts/start-chain.sh        # terminal 1 — anvil :8545 (state persists across restarts)
./scripts/deploy.sh             # one-shot: deploy contracts → backend/.env
npm run dev                     # backend :3000 + frontend :5173 (Vite proxies to backend)
```

`scripts/deploy.sh` reads:

| Env | Default | Purpose |
|-----|---------|---------|
| `DURATION_SECONDS` | `604800` (7 d) | auction length (Q3=C) — use `DURATION_SECONDS=60` for a 60 s demo |
| `STARTING_BID_WEI` | `10^15` (0.001 ETH) | minimum first bid |

Chain state lives in `.anvil/state.json` — `start-chain.sh` loads it on boot and
anvil re-dumps it on stop (`--dump-state`), so the deployed contracts survive
restarts. Reset with `rm -f .anvil/state.json` + redeploy.

## Run — production (single host)

```bash
./scripts/start-chain.sh        # chain with persistence
./scripts/deploy.sh             # writes backend/.env (addresses, chainId, rpcUrl)
npm run build -w frontend       # SPA → frontend/dist (served by the backend)
npm start                       # backend :3000 — SPA + /api/* + /rpc proxy
```

The browser only ever talks to same-origin `/rpc` (proxied to the localhost-bound
node) and `/api/config` (runtime addresses — never baked into the bundle, R4).

**Deployment target — Vercel**: the serverless adaptation lives in
[`api/`](api/) — three path-agnostic functions reusing the shared Express
app (`backend/src/vercel.ts` rebase-paths each request to its owned route,
so `/rpc` works through the `vercel.json` rewrite under any URL semantics),
plus [`vercel.json`](vercel.json) (Vite build → `frontend/dist`, `/rpc`
rewrite). Remaining deploy-time steps (T069, blocked on provisioning):

1. `npm i -g vercel` → `vercel link` → set project env vars:
   `ANVIL_URL` (remote RPC), `CHAIN_ID`, `CHAIN_NAME`, `AUCTION_ADDRESS`,
   `NFT_ADDRESS` (and optionally `NATIVE_CURRENCY_NAME/SYMBOL/DECIMALS`).
2. Deploy the contracts to that chain
   (`forge script --rpc-url $ANVIL_URL --private-key <deployer key>`),
   then put the resulting addresses into the env vars.
3. `vercel deploy --prod` and re-verify quickstart V1, V4, V8 against the
   public origin — the wallet add-network flow uses
   `https://<host>/rpc` (same-origin, built by the frontend at runtime).

## Validation

```bash
./scripts/check.sh   # 9 gates — ALL must be green
```

| # | Gate | Constitution |
|---|------|--------------|
| 1–3 | `forge fmt --check`, `forge lint`, exact-pinned solc build, zero warnings | I |
| 4 | `forge test` — unit + fuzz (500 runs) + invariant (64×32) | II/III |
| 5 | `forge coverage` ≥95 % lines / ≥90 % branches over `contracts/src` | III |
| 6 | ESLint frontend + backend, zero warnings | I |
| 7 | frontend build + ≤300 KB gzip bundle budget (SC-006) | — |
| 8 | SC-004 palette: no color literal outside `src/styles/caliper.css` | — |
| 9 | Vitest coverage ≥95/90 for frontend **and** backend (thresholds enforced in config) | III |

Measured: contracts **100 % lines / 96 % branches** (49 tests), frontend
**98.9 % / 92.5 %** (217 tests), backend **95.6 % / 96.7 %** (25 tests).

End-to-end walkthrough (scenarios V1–V9: lifecycle, refunds, settle, zero-bid,
failures, design/responsive): [`specs/001-auction-web-ui/quickstart.md`](specs/001-auction-web-ui/quickstart.md).

Known debt is tracked in [`docs/tech-debt.md`](docs/tech-debt.md).

## Spec-driven workflow (Spec Kit)

Spec → plan → tasks live in [`specs/001-auction-web-ui/`](specs/001-auction-web-ui/);
project principles in [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
