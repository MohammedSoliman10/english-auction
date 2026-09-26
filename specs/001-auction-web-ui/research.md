# Phase 0: Research — English Auction Web App

**Feature**: 001-auction-web-ui | **Date**: 2026-09-26
**Input**: `plan.md` Technical Context (no unresolved NEEDS CLARIFICATION remained —
user inputs Q1/Q2/Q3 from `/speckit.specify` resolved the scope unknowns).

---

## R1: Frontend framework & chain layer

**Decision**: React 19 + TypeScript (strict) + Vite, with **wagmi v3 + viem 2.x +
@tanstack/react-query v5** as the chain/wallet layer (verified current on npm: wagmi
3.7.x, Tailwind 4.3.x, viem 2.x per wagmi.sh install docs).

**Rationale**: Directly covers FR-001…FR-010: `useAccount`/`useConnect`/`useSwitchChain`
(FR-001), `useReadContract` + `useReadContracts` (FR-002), `useWriteContract` with
`useWaitForTransactionReceipt` (FR-010 lifecycle), `useWatchContractEvent` (FR-009 live
activity log, SC-002 near-instant reflection). React Query gives refetch-on-load +
polling (FR-015) for free. wagmi is user-authorized ("use … wagmi … as you like").

**Alternatives considered**:
- *Next.js*: SSR unnecessary — static SPA served by Express; adds framework complexity
  with zero user-visible value (violates YAGNI, constitution IV).
- *viem only, no wagmi*: manual EIP-1193 wiring + cache layer re-implements wagmi badly
  (violates DRY).
- *ethers v6*: not wagmi's native peer; bundling both is dead weight.

---

## R2: Styling — enforcing the Caliper monochrome system

**Decision**: Tailwind CSS **v4.3** CSS-first configuration. All colors live in exactly
one file — `frontend/src/styles/caliper.css` `@theme` block — exposing only the
reference ramp: `#0A0D09` `#131519` `#1D2026` `#2A2E35` `#979C99` `#F4F5F7` `#FFFFFF`.
Type roles: heavy tight grotesk for display headings ("Caliper."-style), monospace for
uppercase micro-labels (`tracking`-spaced `0.25rem`-scale labels). Hairline grid = CSS
background; signal bars = inline-SVG component stepping through ramp values; radial
gauge = SVG `stroke-dasharray` arc in ramp grays.

**Rationale**: `@theme` tokens are the single source of truth (DRY) and make SC-004
mechanically checkable: any hex/rgb literal outside `caliper.css` is a violation.
Zero-runtime CSS, small bundle (SC-006 <3 s load).

**SC-004 enforcement**: `scripts/check.sh` greps `frontend/src` for color literals
(`#hex`, `rgb(`, `hsl(`, `oklch(`) excluding `styles/caliper.css` → non-zero match fails
the gate; plus visual review in the constitution checklist.

**Alternatives considered**:
- *CSS Modules*: manual token wiring, more boilerplate for identical result.
- *styled-components*: runtime cost + inline styles invite palette drift.
- *MUI/Chakra*: colorful default themes fight the achromatic constraint outright.

---

## R3: Hosted shared chain for online use (FR-013, Q1=A)

**Decision**: **Server-hosted Anvil** (Foundry — constitution's canonical tooling) with a
persistent state file (`--state`/`--load-state`/`--dump-state`), reached by visitors only
through the backend's **`/rpc` JSON-RPC proxy**. The wallet connects to a custom chain
(**chainId 2026**, "English Auction Chain", 18-dec ETH) whose RPC URL is
`https://<host>/rpc` — added via one-click `wallet_addEthereumChain` guided in the UI.
Contracts are deployed by `scripts/deploy.sh` (forge script) which writes addresses into
`backend/.env`, served to the SPA at runtime via `GET /api/config`.

**Rationale**: Exactly Q1=A — works online, zero Sepolia, zero tooling on the visitor's
machine (only a wallet, per spec assumption). Proxying keeps the node bound to
localhost, centralizes CORS (browser + wallet extension origins), and lets us return a
clean `502 {error:"chain unreachable"}` (edge case coverage) instead of a raw socket
error. Anvil state file makes server restarts survive (auction continues across
redeploys of the *frontend*, not the chain).

**Alternatives considered**:
- *Public testnet (any)*: rejected by Q1 ("without Sepolia" → hosted chain chosen).
- *Third-party hosted RPC (QuickNode/Alchemy)*: external account, funding, rate limits —
  and still needs somewhere to deploy; not "ours".
- *Chain in the browser (iframe/WASM node)*: each visitor gets a different chain —
  auction state would not be shared (breaks the product).
- *hardhat node*: diverges from Foundry-canonical tooling gate.

**Known risks + mitigations**:
- *Wallet must be told about the custom chain* → guided add/switch flow is a UI
  acceptance scenario (FR-001).
- *Anvil restart loses non-dumped state* → graceful dump on shutdown + document limits
  in quickstart (chain is a demo ledger; contracts also redeployable).
- *RPC proxy abuse* → size limit, method allowlist passthrough, timeouts.

---

## R4: ABI & address wiring (no hardcoded artifacts)

**Decision**: `scripts/sync-abi.mjs` (Node, zero deps) copies forge `out/**/*.json` ABIs
into `frontend/src/lib/abi/` on `predev`/`prebuild`; contract addresses never enter the
bundle — they arrive at runtime from `GET /api/config` (R3). wagmi config is built after
the boot fetch (small Caliper-styled loading readout).

**Rationale**: Redeploys change addresses (demo chain resets); baked addresses would
require rebuilds (violates simplicity). ABIs are build outputs → sync script, never
hand-edited (V protects generated files).

**Alternatives considered**:
- *@wagmi/cli codegen*: capable, but an extra config surface for exactly what a
  40-line script does (YAGNI).
- *Manual ABI copy*: drift risk → silent runtime breakage (constitution: visible debt).

---

## R5: Contract modernization (NOTIFIED to user — "let me know first")

Planned changes to the pasted contracts; **implementation starts only after user
acknowledgment** (user instruction) — Q1–Q3 answers already pre-approve items 1–3:

1. **Duration parameter** *(approved by Q3=C)*: `constructor(..., uint256 duration)`
   with `DEFAULT_AUCTION_DURATION = 7 days`; `endAt = block.timestamp + duration`.
   Demo deploys pass `60`.
2. **OpenZeppelin via forge** *(build requirement)*: delete the hand-rolled `IERC721`
   stub and the two `https://github.com/...` raw imports (unresolvable by forge); use
   `forge install OpenZeppelin/openzeppelin-contracts@<tag>` + `import {IERC721}` /
   `import {ERC721, ERC721URIStorage}` — tag-pinned (constitution V).
3. **Exact compiler pin**: both contracts `pragma solidity 0.8.31;` (SolimanWeb3 is
   `^0.8.28`; `foundry.toml` sets `solc = "0.8.31"`) — tooling gate.
4. **NatSpec + lint-clean** *(constitution I)*: full `@notice/@param/@dev` on every
   external function; no magic numbers; `forge lint`/`forge fmt` zero warnings.
5. **Revert-string typo fix** *(approved 2026-09-26)*: `end()` `"trasfer failed"` →
   `"transfer failed"` (UI catalogue tolerates both spellings).
6. **Safe mint** *(approved 2026-09-26)*: `mintNFT` switches `_mint` → `_safeMint`
   (rejects non-receiver contract recipients).
7. **Name trim** *(approved 2026-09-26)*: `"Soliman Web3 "` → `"Soliman Web3"` (trailing
   space removed).
8. **`startingBid` immutable getter** *(approved 2026-09-26 via /speckit.analyze I-1)*:
   `uint256 public immutable startingBid` set in the constructor — additive, non-breaking
   ABI surface so FR-002's "starting bid" display remains observable after the first bid
   and across fresh page loads (previously unmeetable against the frozen ABI).

**Frozen regardless of the above**: event signatures (`Start()`, `Bid(address,uint256)`,
`Withdraw(address,uint256)`, `End(address,uint256)`) and all other revert strings
unchanged — the UI error catalogue (contracts/frontend-ui.md) and ABI surface stay stable.

**Reentrancy review (no guard added — YAGNI unless tests disagree)**: `withdraw` is
CEI (balance zeroed before call; failed call reverts whole tx → claim restored);
`end` sets `ended = true` first; during `end`, `bid` reverts on time and `end`
reverts on `!ended`; recipient callbacks can only touch their own `bids` entry.
**Fuzz + invariant tests are the executable proof** (constitution II/III) — if a
counterexample appears, OZ `ReentrancyGuard` is added test-first as a flagged change.

---

## R6: Testing strategy (constitution II/III)

**Decision**: Strict test-first task ordering (red-green-refactor per slice). Contract
suites: **unit** (access control, every revert string, lifecycle, zero-bid path, refund
accounting incl. same-bidder rebid), **fuzz** (arbitrary bid sequences & amounts,
boundary timestamps `endAt-1/endAt/endAt+1`, durations 1s…365d), **invariants**
(solvency: `address(this).balance == sum(bids) + (ended ? 0 : highestBid-if-live)`;
escrow conservation: auction owns ≤1 token; terminal immutability: once `ended`,
balance/NFT only leaves in settlement). Frontend: Vitest + RTL with wagmi mock
connector — hooks (validation logic, error catalogue, derived phase) + components.
Backend: supertest for `/api/config`, `/rpc` proxy (up/down node), static fallback.
Coverage ≥95% line / ≥90% branch enforced per package in `check.sh`.

**Alternatives considered**:
- *Playwright e2e*: valuable for SC-003/SC-007 but heavy (browser orchestration +
  wallet automation is brittle). Deferred — v1 validates via `quickstart.md` manual
  walkthrough + scripted on-chain lifecycle. Recorded as known debt (constitution V) if
  not upgraded later.

---

## R7: Backend scope (YAGNI)

**Decision**: Express 5 on Node ≥20: `GET /api/health`, `GET /api/config`, `/rpc`
proxy, static SPA with history fallback. No DB, no sessions, no auth, no signing
server-side (FR-014 — nothing to custody).

**Alternatives considered**: Fastify (marginal gain at this size), full REST API
(no data exists outside the chain), nginx-only (user requested Node; also needs the
config endpoint anyway).

---

## Open items resolved

All Technical Context NEEDS CLARIFICATION items: **none** (spec clarifications Q1–Q3
settled scope; R1–R7 settle implementation unknowns). R5 contract changes #1–8 are
**all user-approved** (2026-09-26) — including the `/speckit.analyze` I-1 remediation
(#8 `startingBid` getter). No pending user confirmations remain.
