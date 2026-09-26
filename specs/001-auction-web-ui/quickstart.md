# Quickstart — English Auction Web App

**Feature**: 001-auction-web-ui | **Date**: 2026-09-26
Validation guide: proves the feature works end-to-end (spec SC-001…SC-008).
No implementation code — task-level detail lives in `tasks.md` (Phase 2).

## Prerequisites

- **Foundry** (`forge`, `anvil`, `cast`) — canonical Solidity toolchain
- **Node.js ≥ 20** + npm
- A browser wallet extension (MetaMask or compatible)
- (Production host) any Linux box/VM with ports 80/443 open

## Setup (first run)

```bash
cd english-auction
npm install                      # workspaces: frontend + backend
./scripts/start-chain.sh         # anvil (chainId 2026) with state persistence — terminal 1
./scripts/deploy.sh              # forge deploy both contracts → writes backend/.env — one-shot
npm run dev                      # backend (:3000) + frontend Vite (:5173, /api + /rpc proxied)
```

Build & quality gate (what CI runs):

```bash
./scripts/check.sh               # fmt + lint + build + unit/fuzz/invariant tests + coverage (all packages)
```

Production-style run (SPA served by Express):

```bash
npm run build                    # sync-abi → vite build → backend serves frontend/dist
npm start                        # single origin: SPA + /api + /rpc on :3000
```

## Production Deployment (remote host — FR-013)

Validated by task T069 (re-verify V1, V4, V8 against the public origin).

1. Provision a Linux host with Foundry + Node ≥ 20; clone the repo.
2. Chain service: run `./scripts/start-chain.sh` under systemd/PM2 so the Anvil state
   file survives restarts (dump on stop, load on boot).
3. Deploy: `./scripts/deploy.sh` → writes `backend/.env` (addresses + chain id 2026).
4. App: `npm run build && npm start` (or PM2), behind an HTTPS reverse proxy
   (Caddy/nginx) that forwards `/`, `/api`, and `/rpc` to `:3000` — HTTPS is required
   for `wallet_addEthereumChain` in most wallets.
5. Verify remotely: open `https://<host>` in a clean browser profile → guided
   add-network must point at `https://<host>/rpc` (V1); bid flow (V4); stop the chain
   service and confirm the connection-error state appears (V8).

**Notes**: the node itself is never exposed (bound to localhost; reached only via the
`/rpc` proxy). Redeploying the frontend never changes addresses (served by
`/api/config`); a wiped chain state file requires re-running step 3
(demo-ledger limitation — research R3).

## Validation scenarios

Each scenario maps to spec acceptance scenarios; run in order for a full lifecycle demo
(SC-003). Use two wallet accounts (A = seller, B = bidder).

### V1 — Cold load & wallet connect (FR-001, SC-001, SC-006)

1. Open the site in a fresh browser profile.
   - **Expect**: Caliper monochrome UI renders (dark ramp, hairline grid, mono labels),
     auction state visible **without** connecting, usable in < 3 s.
2. Connect wallet A.
   - **Expect**: guided **Add/Switch network** prompt (chainId 2026) appears once;
     address + network badge show connected.

### V2 — Mint (US5)

3. As A, submit any JSON URI in `<MintPanel>` (pre-start).
   - **Expect**: wallet prompt → success toast → new `tokenId` displayed.

### V3 — Start (FR-006, US2)

4. As A (seller), start the auction.
   - **Expect**: NFT escrowed (UI shows auction LIVE), countdown runs, `Start` entry
     appears in activity log. Reload → state identical (SC-008).
5. Attempt start again (or as B).
   - **Expect**: blocked pre-wallet with "Auction already started" / "Only the seller…".

### V4 — Bidding (FR-003/004, US1, SC-002)

6. As B, bid **≤** current highest.
   - **Expect**: inline error "Bid must exceed current highest" — **no wallet prompt**.
7. As B, bid **>** highest (e.g., 0.002 ETH).
   - **Expect**: awaiting→pending→success toast; highest-bid readout + signal bar update
     within 15 s of confirmation; `Bid` log entry; A's refundable becomes nonzero.
8. As A, rebid higher than B.
   - **Expect**: B's refundable readout > 0 (previous bid credited to B).

### V5 — Withdraw (FR-005, US3)

9. As B, click withdraw.
   - **Expect**: balance increases by full claimable; readout resets to 0; `Withdraw`
     log entry. With 0 claimable the button is hidden/disabled ("nothing to withdraw").

### V6 — Settle (FR-007, US4)

10. Before `endAt`: attempt settle.
    - **Expect**: blocked — "Auction is still in progress".
11. Wait for countdown → 0 → settle (either account; settle is permissionless).
    - **Expect**: winner owns NFT, seller received highest bid, `ResultPanel` shows
      winner + amount, `End` log entry. Second settle attempt rejected.

### V7 — Zero-bid path

12. Deploy a fresh auction (demo duration), let it expire with no bids, settle.
    - **Expect**: NFT returns to seller; result shows "NO BIDS".

### V8 — Failure & resilience (edge cases)

13. Reject a transaction in the wallet.
    - **Expect**: neutral "transaction rejected" notice; on-chain & UI state unchanged.
14. Stop the Anvil process and interact.
    - **Expect**: connection-error state ("chain unreachable"), no blank/broken panels;
      restart chain → UI recovers on refresh.

### V9 — Design & responsive gate (SC-004, SC-007, FR-011/012)

15. Run `./scripts/check.sh`'s palette grep → zero color literals outside
    `caliper.css`; visually confirm only ramp colors (`#0A0D09…#FFFFFF`) render.
16. At 360px width and on a mobile viewport: every primary action reachable, no
    horizontal scrolling; latest Chrome/Firefox/Safari smoke pass.

## Expected end state

Full pass ⇒ all spec acceptance scenarios satisfied, `check.sh` green
(fmt + lint + build + tests + coverage ≥95/90), and the app demonstrable to a stranger
using only a URL + wallet (SC-001, SC-003).

## Troubleshooting

- **`GET /api/config` → 503**: run `./scripts/deploy.sh` (addresses not written yet).
- **Wallet stuck on wrong chain**: Settings → Networks → remove "English Auction
  Chain", reconnect to re-trigger the guided add.
- **State wiped after server reboot**: chain state file not dumped — redeploy via
  `./scripts/deploy.sh` (demo-ledger limitation, documented in research R3).
