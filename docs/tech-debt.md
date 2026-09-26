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
process, which v8 coverage does not attribute. Backend sits at ~95.6 % lines /
96.7 % branches (thresholds enforced), just above the constitution floor.

**Why acceptable**: the block is trivial glue that is exercised by every
`npm run dev` / `npm start` and by the live quickstart runs.

**Upgrade path**: spawn-based smoke test asserting the `backend listening`
stdout line (behavioral, still not coverage-attributed) — or fold the block
into an exported `startServer()` and call it from a test with a stubbed
listener.

## 3. Vercel deployment (pending provisioning — T069)

**What**: the serverless adaptation is **implemented and tested**
(`api/{index,config,health}.ts` path-agnostic functions over the shared
Express app + `vercel.json`; `NATIVE_CURRENCY_*` env overrides for
arbitrary EVM chains), but no deployment exists yet: the wallet key and
remote RPC URL are user-provisioned (FR-013/FR-014), a Vercel project must
be linked, and contracts must be deployed to the target chain first.

**Why deferred**: deployment is the endgame step; the wallet key and RPC URL
are user-provisioned at that point (FR-013/FR-014). Tracked in the README
“Deployment target” section.

**Task status — T069 BLOCKED**: remote production validation cannot run
until a real host exists. Per the task's escape clause this is recorded
here rather than silently skipped. When the Vercel deployment lands (user
provides the wallet key + RPC URL), re-run the quickstart “Production
Deployment” section against the public origin and re-verify **V1** (cold
load + wallet add/switch-network against `https://<host>/rpc`), **V4**
(bidding through the public proxy), and **V8** (chain-death →
`chain_unreachable` recovery) there.

## 4. Quickstart runners are environment-local

**What**: the V1–V9 runner scripts used for live validation live outside the
repository (they hard-code local tooling paths such as the headless Chromium
install).

**Why acceptable**: they are validation instruments, not product code; results
are recorded in commit messages per T068, and the human-readable procedure is
`specs/001-auction-web-ui/quickstart.md`.

**Upgrade path**: same as item 1 — a committed e2e suite absorbs them.
