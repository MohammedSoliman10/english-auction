# Known technical debt

Recorded per constitution V (Documentation / Tech Debt). Each entry: what is
deferred, why it is acceptable now, and the upgrade path.

## 1. Playwright e2e suite deferred (research R6)

**What**: there is no committed end-to-end browser test suite in CI. Primary
flows are instead validated by:

- component/hook tests (217 frontend tests — phase matrix, validation guards,
  tx lifecycle, error catalogue) with a mocked wagmi wallet, and
- the scripted `quickstart.md` V1–V9 walkthroughs executed headlessly against
  the real build + real chain (lifecycle, refunds, settle, zero-bid, failure
  injection, 360 px responsive audit).

**Why acceptable**: full wallet-orchestrated e2e is brittle and heavy (R6 —
alternatives considered and consciously deferred); the constitution's coverage
gates are met per package, and the quickstart runners exercise the production
bundle end-to-end when a change needs it.

**Upgrade path**: port the quickstart runner flows (wallet-shim + assertions)
into a committed Playwright suite run by CI.

**Cross-browser note (V9)**: the quickstart's “latest Chrome/Firefox/Safari
smoke pass” was executed against **Chromium only** — the validation
environment provides headless Chromium and no Firefox/Safari binaries.
Responsive behavior is browser-standard CSS (no vendor-specific code), so
the risk is low, but the two extra engines remain unverified until CI gains
them.

## 2. Backend bootstrap block not unit-covered

**What**: `backend/src/server.ts`'s `require.main === module` block (load
`.env`, `listen`) is outside unit coverage — it can only run in a separate
process, which v8 coverage does not attribute. Backend sits at ~96.0 % lines /
97.4 % branches (thresholds enforced), above the constitution floor.

**Why acceptable**: the block is trivial glue that is exercised by every
`npm run dev` / `npm start` and by the live quickstart runs.

**Upgrade path**: spawn-based smoke test asserting the `backend listening`
stdout line (behavioral, still not coverage-attributed) — or fold the block
into an exported `startServer()` and call it from a test with a stubbed
listener.

## 3. Vercel deployment (live — T069 verified)

**What**: the serverless adaptation shipped and passed remote validation
(2026-09-27). Live app: <https://english-auction-nine.vercel.app> (Sepolia,
chainId 11155111). Contracts: auction `0x8251a9C764236E2D53bdce65C49000CCaDccFc74`,
NFT `0xd02f9fc480be6351cee993f49abaee68c0b9ee24`. Project env (production):
`ANVIL_URL`, `CHAIN_ID`, `CHAIN_NAME`, `AUCTION_ADDRESS`, `NFT_ADDRESS`,
`DEPLOYED_AT`, `DEPLOY_BLOCK`.

**Task status — T069 PASSED (25/25 checks)**: V1 (cold load 1.3 s, guided
add/switch — `wallet_addEthereumChain` carries the absolute
`https://<host>/rpc`), V4 (real Sepolia bids through the `/rpc` proxy:
CONFIRMED toast → readout → activity row, FR-010 rejection), V8 (`/rpc`
requests aborted → `chain_unreachable` → recovery), SPA deep-link fallback
(`vercel.json` catch-all rewrite). Evidence: `/tmp/opencode/quickstart/t069-*.png`.

**Two production defects found & fixed during T069** (test-first; both were
invisible on the local chain):

1. **Add-network URL**: wagmi's injected connector raises
   `wallet_addEthereumChain` itself from `chain.rpcUrls` on 4902 — the
   relative `/rpc` is rejected by real wallets. `Header.tsx` now passes an
   absolute same-origin `addEthereumChainParameter.rpcUrls`.
2. **Activity-log range**: `eth_getLogs` from genesis fails on every free
   provider (Alchemy Free caps ranges at 10 blocks) — the log rendered
   silently empty. `useActivityLog` now pages 5,000-block windows from
   `/api/config`'s `deployBlock` (optional `DEPLOY_BLOCK` env; `0` keeps the
   local demo-chain behavior).

**Residual requirements**: `ANVIL_URL` must accept ≥5,000-block
`eth_getLogs` ranges (publicnode: 50 000 ✓, drpc: 10 000 ✓, Alchemy Free: 10 ✗
— the demo uses `https://ethereum-sepolia-rpc.publicnode.com`). Contract deploys
on this account must be issued as individual `cast send --create`/`cast call`
transactions — forge's multi-tx broadcast trips the provider's
delegated-account in-flight limit.

## 4. Quickstart runners are environment-local

**What**: the V1–V9 runner scripts used for live validation live outside the
repository (they hard-code local tooling paths such as the headless Chromium
install).

**Why acceptable**: they are validation instruments, not product code; results
are recorded in commit messages per T068, and the human-readable procedure is
`specs/001-auction-web-ui/quickstart.md`.

**Upgrade path**: same as item 1 — a committed e2e suite absorbs them.
