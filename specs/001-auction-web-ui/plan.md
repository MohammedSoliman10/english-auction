# Implementation Plan: English Auction Web App

**Branch**: `001-auction-web-ui` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-auction-web-ui/spec.md`

## Summary

Build a single-page, strictly monochrome ("Caliper") auction web app over the two provided
contracts. Approach: (1) harden `EnglishAuction` + `SolimanWeb3` in Foundry — test-first,
pinned OpenZeppelin, exact-pinned Solidity, configurable duration (per clarified Q3);
(2) React + Vite + TypeScript frontend using wagmi v3 / viem 2.x for wallet connection,
typed contract reads/writes, and live event subscriptions, styled with Tailwind CSS v4
whose theme tokens are the gray ramp only; (3) a minimal Node.js/Express backend that
serves the built SPA and proxies JSON-RPC to a **server-hosted Anvil node** (clarified Q1:
hosted shared chain — no Sepolia, no visitor-side tooling), exposing runtime config
(`GET /api/config`) so addresses never get hardcoded. Scope is one auction page
(clarified Q2) — no create-auction flow, no multi-auction list.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) for frontend + backend; Solidity exactly
`0.8.31` (single pinned compiler for both contracts); Node.js ≥ 20 LTS

**Primary Dependencies**: React 19, Vite, wagmi v3, viem ^2.x, @tanstack/react-query v5,
Tailwind CSS v4.3 (CSS-first `@theme`), Express 5, Foundry (`forge`/`anvil`/`cast`),
OpenZeppelin Contracts v5 (forge-installed, tag-pinned), ESLint, Vitest

**Storage**: N/A — the chain is the single source of truth (FR-015). Server keeps only
Anvil's state file across restarts; no database (constitution: minimal state, YAGNI)

**Testing**: `forge test` (unit + fuzz + invariant) with `forge coverage` gates ≥95% line /
≥90% branch on `contracts/src`; Vitest + React Testing Library (frontend hooks/components);
Vitest + supertest (backend proxy/config); all gates run via `scripts/check.sh`

**Target Platform**: Modern browsers (Chrome, Firefox, Safari — desktop + mobile viewport)
with an EIP-1193 wallet; Linux server running Anvil + Node.js

**Project Type**: web application (frontend + backend + smart contracts)

**Performance Goals**: SC-006 usable in < 3 s load (standard broadband); SC-002 bids
reflected < 15 s after wallet confirmation (event subscription makes this near-instant);
single shared RPC must serve **50 concurrent connected viewers** (reads + event
subscriptions) without degraded UI responsiveness

**Constraints**: SC-004/FR-011 achromatic-only UI (gray ramp #0A0D09 → #FFFFFF, verified);
FR-013 hosted-chain-only (no Sepolia, no local node on visitor machines); FR-014 no key or
fund custody (every write is wallet-confirmed); constitution gates — zero-warning
fmt/lint/build/test, exact-pinned solc, coverage thresholds, NatSpec on all contract
interfaces

**Scale/Scope**: 1 page, 1 auction instance, 2 contracts, 3 packages
(`contracts/`, `frontend/`, `backend/`); 5 user stories; personal-project scale, no
multi-tenant or admin scope in v1 (FR-016)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Requirement (constitution v1.0.0) | Status | Notes |
|------|-----------------------------------|--------|-------|
| I. Code Quality | Single-purpose functions, full NatSpec, no magic numbers, zero lint warnings | PASS (planned) | NatSpec on every external function; `DEFAULT_AUCTION_DURATION` constant replaces `60`/`7 days` literals; ESLint (TS) + `forge lint` + `forge fmt` at zero warnings |
| II. Test-First | Tests written & approved before implementation; red-green-refactor; regression test per bug fix | PASS (planned) | `/speckit.tasks` MUST order every slice as tests-first; any contract bug found ships with a failing-test-first fix |
| III. Testing & Coverage | ≥95% line / ≥90% branch on `src/`; fuzz + invariant on critical logic; deterministic tests | PASS (planned) | Fuzz: bid amounts, timing boundaries, duration. Invariants: solvency (refunds + highest bid = ETH received), escrow conservation (≤1 NFT), terminal-state immutability. Coverage enforced in `check.sh` |
| IV. Maintainability | YAGNI, DRY, minimal state, events for transitions | PASS | No DB/SSR/e2e-framework in v1; palette defined once in `styles/caliper.css`; contract events are the activity-log source (FR-009) |
| V. Documentation | Docs updated in the same change | PASS (planned) | README + NatSpec + `quickstart.md` updated per task; known-shortcut TODOs recorded |
| Tooling Gates | forge canonical, **pinned solc**, fmt/build/test clean | **ACTION FLAGGED** | Requires notifying user (approved scope): replace GitHub-raw OZ imports with `forge install` (tag-pinned); unify both contracts on exact `pragma solidity 0.8.31` (SolimanWeb3 is `^0.8.28`) |
| Workflow | Small reviewable changes; quality gate before merge; breaking changes called out | PASS (planned) | Tasks split into small independently-passing slices; `scripts/check.sh` = fmt + lint + build + test + coverage; ABI/event surface kept stable — any deviation reported to user first (per user instruction) |

**Gate verdict**: PASS with one pre-notified tooling action (contract build modernization —
already surfaced to the user as a change requiring their awareness before implementation).
No unjustified violations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-auction-web-ui/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (backend API, UI contract, chain interface)
│   ├── backend-api.md
│   ├── frontend-ui.md
│   └── chain-interface.md
├── checklists/
│   └── requirements.md  # /speckit.specify output
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (project root: `english-auction/`)

```text
english-auction/                     # project root (git repo to be initialized here)
├── package.json                     # npm workspaces: frontend, backend + root scripts
├── scripts/
│   ├── check.sh                     # quality gate: fmt + lint + build + test + coverage (all packages)
│   ├── start-chain.sh               # anvil with --state persistence for hosted shared chain
│   ├── deploy.sh                    # forge script → deploys both contracts → writes addresses to backend/.env
│   └── sync-abi.mjs                 # forge out/ artifacts → frontend/src/lib/abi/ (run on predev/prebuild)
├── contracts/                       # Foundry project (canonical Solidity toolchain)
│   ├── foundry.toml                 # solc pinned 0.8.31, fmt + lint config, coverage settings
│   ├── README.md                    # pinned OZ tag record (R5 #2)
│   ├── src/
│   │   ├── EnglishAuction.sol
│   │   └── SolimanWeb3.sol
│   ├── test/
│   │   ├── EnglishAuction.t.sol         # unit: access control, reverts, lifecycle
│   │   ├── EnglishAuction.fuzz.t.sol    # fuzz: amounts, timing, duration
│   │   ├── EnglishAuction.invariant.t.sol
│   │   └── SolimanWeb3.t.sol
│   └── script/
│       └── Deploy.s.sol
├── frontend/
│   ├── index.html
│   ├── vite.config.ts                # Vitest config + coverage thresholds ≥95/90
│   └── src/
│       ├── main.tsx                  # boot: fetch /api/config → mount providers
│       ├── App.tsx                   # single-page composition per contracts/frontend-ui.md §1
│       ├── App.test.tsx              # integration: phase transitions across stories
│       ├── app/
│       │   ├── providers.tsx         # WagmiProvider + QueryClientProvider
│       │   └── wagmi.ts              # chain def (id 2026), http transport → /rpc, wallet connectors
│       ├── components/               # presentational: SignalBars, RadialGauge, HairlineGrid,
│       │   └── ...                   #   Readout, MonoLabel, DisplayHeading, StatusBadge, TxToast
│       ├── sections/                 # page composition: Header, AuctionPanel, BidForm,
│       │   └── ...                   #   WithdrawPanel, StartPanel, SettlePanel, ResultPanel,
│       │                             #   Countdown, ActivityLog, MintPanel, ErrorState
│       ├── hooks/
│       │   ├── useAuctionState.ts    # derived phase + reads (FR-002)
│       │   ├── usePlaceBid.ts        # client validation + write (FR-003/004)
│       │   ├── useWithdrawFunds.ts   # (FR-005)
│       │   ├── useStartAuction.ts    # (FR-006)
│       │   ├── useSettleAuction.ts   # (FR-007)
│       │   ├── useMintNft.ts         # (FR-008)
│       │   ├── useActivityLog.ts     # event logs Start/Bid/Withdraw/End (FR-009)
│       │   └── useTxLifecycle.ts     # awaiting→pending→success/reverted/rejected (FR-010)
│       ├── lib/
│       │   ├── config.ts             # runtime config from /api/config
│       │   ├── abi/                  # synced from forge out/ (generated — do not edit)
│       │   ├── format.ts             # wei/ETH, countdown, address shortening
│       │   └── errors.ts             # revert-string → user message catalogue (FR-004)
│       ├── styles/
│       │   └── caliper.css           # Tailwind v4 @theme: THE only color definitions (SC-004)
│       └── **/*.test.{ts,tsx}        # Vitest + RTL (co-located)
└── backend/
    ├── package.json
    ├── src/
    │   ├── server.ts                 # Express: static SPA + /api/* + /rpc mount
    │   ├── rpc-proxy.ts              # JSON-RPC pass-through → anvil, CORS, limits, 502 on down
    │   └── config.ts                 # env: PORT, ANVIL_URL, CHAIN_ID, NFT_ADDRESS, AUCTION_ADDRESS
    ├── test/                         # Vitest + supertest
    └── .env.example

docs/
└── tech-debt.md                      # recorded deferrals (e.g., Playwright e2e — research R6)
```

**Structure Decision**: Web-application layout (Option 2) — `contracts/` + `frontend/` +
`backend/` under the spec-kit project root `english-auction/`, unified by npm workspaces
and a single quality gate (`scripts/check.sh`). Rationale: the backend's only jobs are SPA
hosting + RPC proxying + runtime config (FR-013) — no data store, so no API/domain layer
is introduced (YAGNI). Not a constitution violation: three packages is the standard
web-app shape, and Solidity tooling remains exclusively Foundry.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | — | All constitution gates pass; the one ACTION FLAGGED item (OZ install + solc pin) is a compliance fix, not a violation |

## Post-Design Constitution Re-Check (after Phase 1)

*Re-evaluated 2026-09-26 against design artifacts (`research.md`, `data-model.md`,
`contracts/`, `quickstart.md`):*

- **I. Code Quality**: NatSpec obligations pinned in `contracts/chain-interface.md` §2;
  magic numbers replaced by `DEFAULT_AUCTION_DURATION` + deploy-time env; design tokens
  centralized (single palette file) — PASS.
- **II. Test-First**: test obligations enumerated per suite in
  `contracts/chain-interface.md` §4; `/speckit.tasks` must order tests-first per slice;
  reentrancy hardening reserved as test-first flagged change only if invariant tests
  find a counterexample — PASS.
- **III. Coverage**: ≥95%/≥90% gates wired into `scripts/check.sh` for all three
  packages; fuzz (amounts/timing/durations) + invariants (solvency, escrow
  conservation, terminal immutability) specified — PASS.
- **IV. Maintainability**: no DB/SSR/e2e-framework introduced (R6 records Playwright
  deferral as visible debt, not silent); palette/events as single sources — PASS.
- **V. Documentation**: `quickstart.md` + README/NatSpec update obligations defined;
  known-deferral (Playwright, optional `_safeMint`/name-trim items 5a/5b) recorded in
  research R5/R6 — PASS.
- **Tooling**: OZ forge-install + exact `0.8.31` pin + fmt/lint gates confirmed
  implementable as designed — PASS (ACTION FLAGGED items remain user-notified, not
  violations).
- **Workflow**: slice-sized tasks + single `check.sh` gate + frozen ABI/event surface
  (breaking changes would be reported to user first, per standing instruction) — PASS.

**Post-design verdict**: PASS — no violations to justify; Complexity Tracking remains
empty.
