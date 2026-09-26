# Tasks: English Auction Web App

**Input**: Design documents from `/specs/001-auction-web-ui/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓
**Constitution**: v1.0.0 — Principle II (Test-First) is NON-NEGOTIABLE → **tests are included for every
story and MUST be written and verified RED before the matching implementation task.**

**Organization**: Tasks grouped by user story (US1 bid → US2 start → US3 withdraw → US4 settle →
US5 mint) so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1…US5)
- Exact file paths in every description; approved contract changes = research R5 items 1–7

## Path Conventions

Project root = `english-auction/` (spec-kit root). Structure per plan.md:
`contracts/` (Foundry), `frontend/src/`, `backend/src/`, `scripts/`, `specs/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize git repository at project root `english-auction/` with root `.gitignore` (node_modules, dist, contracts/out, contracts/cache, contracts/broadcast, .env, coverage) and initial branch `001-auction-web-ui`
- [X] T002 Create root `package.json` with npm workspaces (`frontend`, `backend`) and scripts `dev`, `build`, `start`, `check` (delegates to `scripts/check.sh`)
- [X] T003 Initialize Foundry project at `contracts/` (`forge init --no-commit`) and configure `contracts/foundry.toml`: exact `solc = "0.8.31"`, OZ remapping `@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/`, fmt rules, lint, `[fuzz]` runs=500, `[invariant]` runs=64 per plan.md tooling gate
- [X] T004 Scaffold Vite + React 19 + TypeScript frontend at `frontend/` (package.json, vite.config.ts, index.html, tsconfig strict)
- [X] T005 Scaffold Express 5 + TypeScript backend at `backend/` (package.json, tsconfig.json, `backend/.env.example` with PORT=3000, ANVIL_URL, CHAIN_ID=2026, NFT_ADDRESS, AUCTION_ADDRESS)
- [X] T006 [P] Configure ESLint flat config for `frontend/` and `backend/` (typescript-eslint + react-hooks + import order), zero-warning target, wired as `npm run lint` in both workspaces
- [X] T007 [P] Configure Vitest coverage thresholds ≥95% lines / ≥90% branches in `frontend/vite.config.ts` and `backend/vitest.config.ts` per constitution III
- [X] T008 Create `scripts/check.sh` quality gate: forge fmt --check + forge lint + forge build + forge test + forge coverage gate (≥95/90) | eslint both packages | vitest run --coverage both packages
- [X] T009 [P] Write root `README.md` skeleton (prereqs, scripts table, ports, links to quickstart.md and specs/001-auction-web-ui/)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Contracts foundation (approved changes R5 #1–8 — all user-approved 2026-09-26)

- [X] T010 [P] Tag-pinned OpenZeppelin install in `contracts/` (`forge install OpenZeppelin/openzeppelin-contracts@<exact-v5-tag> --no-commit`), record tag in `contracts/README.md` (replaces GitHub-raw imports — R5 #2)
- [X] T011 Write RED modernization tests in `contracts/test/EnglishAuction.t.sol`: constructor stores `duration_` and `startingBid`, `duration()` + `startingBid()` getters return exactly what was passed (R5 #8 — FR-002 coverage), `nft()/nftId()/seller()/highestBid()` getters, default `DEFAULT_AUCTION_DURATION == 7 days`
- [X] T012 Implement `contracts/src/EnglishAuction.sol` modernization per chain-interface §2: constructor `(address,uint256,uint256,uint256 duration_)`, constants `DEFAULT_AUCTION_DURATION = 7 days`, `uint256 public immutable startingBid` (R5 #8), `endAt = block.timestamp + duration` at `start()`, OZ `IERC721` import, exact `pragma solidity 0.8.31;`, full NatSpec, revert string `"trasfer failed"` → `"transfer failed"` → T011 GREEN
- [X] T013 Write RED constructor tests in `contracts/test/SolimanWeb3.t.sol`: `name() == "Soliman Web3"`, `symbol() == "SW3"` (R5 #7 trailing-space trim)
- [X] T014 Implement `contracts/src/SolimanWeb3.sol` modernization per R5: OZ `ERC721`/`ERC721URIStorage` imports (no GitHub URLs), exact `pragma solidity 0.8.31;`, `mintNFT` uses `_safeMint` (R5 #6), name trim, full NatSpec → T013 GREEN

### Backend foundation (contracts/backend-api.md)

- [X] T015 [P] Write RED backend tests: `backend/test/health.test.ts` (200 ok/degraded), `backend/test/config.test.ts` (200 full config shape, 503 `not_deployed` when AUCTION_ADDRESS missing), `backend/test/rpc-proxy.test.ts` (forwards body verbatim, 400 `invalid_json`, 502 `chain_unreachable` on dead upstream, CORS preflight OPTIONS) per contracts/backend-api.md
- [X] T016 Implement `backend/src/config.ts` (env parsing + validation), `backend/src/rpc-proxy.ts` (256KB limit, 5s timeout, error mapping), `backend/src/server.ts` (endpoints + static `frontend/dist` + history fallback + JSON 404 for `/api/*`) → T015 GREEN

### Frontend design system + boot (contracts/frontend-ui.md §4, §6)

- [X] T017 [P] Write RED design-system tests: `frontend/src/components/MonoLabel.test.tsx` (uppercase + letter-spacing ≥0.12em), `SignalBars.test.tsx` (13 grayscale ramp steps, no color literals), `RadialGauge.test.tsx` (gray arc), `HairlineGrid.test.tsx`, `Readout.test.tsx` (value formatting), `StatusBadge.test.tsx`
- [X] T018 Implement `frontend/src/styles/caliper.css` (Tailwind v4 `@theme` — ONLY the 7 tokens: void #0A0D09, surface-1 #131519, surface-2 #1D2026, surface-3 #2A2E35, signal #979C99, paper #F4F5F7, white #FFFFFF) + `frontend/src/components/{HairlineGrid,DisplayHeading,MonoLabel,Readout,SignalBars,RadialGauge,StatusBadge,TxToast}.tsx` → T017 GREEN
- [X] T019 [P] Write RED lib tests: `frontend/src/lib/format.test.ts` (wei↔ETH exact rounding, countdown mm:ss/h:mm:ss, address `0x1234…abcd`), `frontend/src/lib/errors.test.ts` (full revert catalogue data-model §7 incl. both `"trasfer failed"` and `"transfer failed"` spellings → same message)
- [X] T020 Implement `frontend/src/lib/format.ts` + `frontend/src/lib/errors.ts` → T019 GREEN
- [X] T021 Write RED header/wallet tests `frontend/src/sections/Header.test.tsx`: connect button, address + network badge, guided `wallet_addEthereumChain`/`wallet_switchEthereumChain` for chainId 2026 (FR-001), wrong-network state
- [X] T022 Implement boot + wallet layer: `frontend/src/lib/config.ts` (fetch `/api/config` before render), `frontend/src/app/wagmi.ts` (chain id 2026, http transport `/rpc`, injected connector), `frontend/src/app/providers.tsx` (Wagmi + QueryClient), `frontend/src/main.tsx`, `frontend/src/sections/Header.tsx` → T021 GREEN
- [X] T023 [P] Create `scripts/sync-abi.mjs` (copies forge `out/**/*.json` ABIs → `frontend/src/lib/abi/` with "GENERATED — do not edit" banner), wired to frontend `predev`/`prebuild` scripts per research R4
- [X] T024 [P] Create `scripts/start-chain.sh` (anvil `--chain-id 2026`, `--load-state/--dump-state` persistence) and `scripts/deploy.sh` (forge script → writes `backend/.env`) plus `contracts/script/Deploy.s.sol`: deploy SolimanWeb3 → `mintNFT` token 0 to deployer → deploy `EnglishAuction(nft, 0, STARTING_BID_WEI default 0.001 ether, DURATION_SECONDS default 604800)` per chain-interface §3
- [X] T025 Write RED `frontend/src/hooks/useTxLifecycle.test.ts`: state machine IDLE→AWAITING_CONFIRMATION→PENDING→SUCCESS / REJECTED / REVERTED per data-model §6, hash captured, failure surfaces message (FR-010)
- [X] T026 Implement `frontend/src/hooks/useTxLifecycle.ts` (composes `useWriteContract` + `useWaitForTransactionReceipt`) → T025 GREEN
- [X] T027 [P] Configure Vite dev proxy (`/api` + `/rpc` → `http://localhost:3000`) in `frontend/vite.config.ts` for local dev parity with production single-origin

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 - Place a bid on a live auction (Priority: P1) 🎯 MVP

**Goal**: Connected user sees live auction state and places a bid above the current highest;
outbid peers become refundable; activity log streams events

**Independent Test**: With auction started (arranged via `cast send`/deploy — US2 UI not required),
connect wallet, bid above highest → readout updates + prior bidder refundable + `Bid` log entry;
invalid bids blocked pre-wallet (quickstart V1, V4)

### Tests for User Story 1 ⚠️ (write FIRST — must fail)

- [X] T028 [P] [US1] RED contract tests for `bid()` in `contracts/test/EnglishAuction.t.sol`: reverts `"not started"` / `"ended"` (after endAt) / `"value < highest"` (incl. equal); prior `highestBid` credited to prior `highestBidder`'s `bids`; same-bidder rebid credits own old bid to `bids`; emits `Bid(sender, amount)`
- [X] T029 [P] [US1] RED fuzz tests in `contracts/test/EnglishAuction.fuzz.t.sol`: random bid sequences (multiple bidders, amounts > 0) conserve funds while live: `address(auction).balance == Σ bids + highestBid`
- [X] T030 [P] [US1] RED tests `frontend/src/hooks/useAuctionState.test.tsx`: phase derivation NOT_STARTED/OPEN_FOR_BIDS/AWAITING_SETTLEMENT/SETTLED; `startingBid` read from the immutable getter — constant across bids and reloads (R5 #8, FR-002); `timeRemaining = max(0, endAt−now)`; `myRefundable`; `isHighestBidder`; loading/error incl. `chain_unreachable` (data-model §1)
- [X] T031 [P] [US1] RED tests `frontend/src/hooks/usePlaceBid.test.tsx`: `validate()` returns catalogue message for bid ≤ highest / not started / ended / wrong network / not connected, `null` when valid; `submit()` guarded until validation passes (FR-003/FR-004)

### Implementation for User Story 1

- [X] T032 [US1] Implement `frontend/src/hooks/useAuctionState.ts` (multi-read + poll + event-driven refetch, FR-002/FR-015) depends on T030
- [X] T033 [US1] Implement `frontend/src/hooks/usePlaceBid.ts` (validation via `lib/errors.ts`, writes via `useTxLifecycle`) depends on T031, T026
- [X] T034 [P] [US1] RED tests `frontend/src/sections/AuctionPanel.test.tsx` + `frontend/src/sections/BidForm.test.tsx`: readouts + countdown + gauge render; BidForm disabled states per state→action matrix (frontend-ui.md §3)
- [X] T035 [US1] Implement `frontend/src/sections/AuctionPanel.tsx` (status, countdown, RadialGauge time arc, highest bid/bidder readouts, NFT preview) and `frontend/src/sections/BidForm.tsx` (amount input ETH, inline validation) → T034 GREEN
- [X] T036 [P] [US1] RED tests `frontend/src/hooks/useActivityLog.test.ts` + `frontend/src/sections/ActivityLog.test.tsx`: fetches Start/Bid/Withdraw/End logs, ordered newest-first, actor + amount + time formatting (FR-009)
- [X] T037 [US1] Implement `frontend/src/hooks/useActivityLog.ts` + `frontend/src/sections/ActivityLog.tsx`; mount `TxToast` globally (FR-010 surface) → T036 GREEN
- [X] T038 [US1] Assemble `frontend/src/App.tsx` single-page composition (Header, AuctionPanel, BidForm, ActivityLog, TxToast) per frontend-ui.md §1; run quickstart V1 + V4 manually

**Checkpoint**: US1 fully functional — MVP demoable (bid on a pre-started auction)

---

## Phase 4: User Story 2 - Seller launches an auction (Priority: P2)

**Goal**: Seller starts auction → NFT escrowed, countdown begins, UI flips to LIVE

**Independent Test**: Wallet owning the NFT starts auction → `ownerOf(nftId) == auction`,
phase = OPEN_FOR_BIDS with running countdown; non-seller/double-start blocked (quickstart V3)

### Tests for User Story 2 ⚠️ (write FIRST — must fail)

- [X] T039 [P] [US2] RED contract tests for `start()` in `contracts/test/EnglishAuction.t.sol`: reverts `"not seller"`, `"started"` (double start); escrow `ownerOf(nftId) == address(this)`; `endAt == block.timestamp + duration`; emits `Start()`; requires prior NFT approval (revert bubbles from transfer)
- [X] T040 [P] [US2] RED tests `frontend/src/hooks/useStartAuction.test.ts`: `validate()` blocks not-seller / already-started / not-connected / wrong-network with catalogue messages (FR-004, US2 scenarios 2–3)
- [X] T041 [P] [US2] RED tests `frontend/src/sections/StartPanel.test.tsx`: seller sees start CTA pre-start; non-seller sees read-only state; after start → LIVE flip + countdown appears (US2 scenario 4 reload-safe)

### Implementation for User Story 2

- [X] T042 [US2] Implement `frontend/src/hooks/useStartAuction.ts` depends on T040, T026
- [X] T043 [US2] Implement `frontend/src/sections/StartPanel.tsx` (escrow step: approve + start, seller gating) → T041 GREEN
- [X] T044 [US2] Extend `frontend/src/App.tsx` pre-start composition (MintPanel placeholder area + StartPanel) and add integration test `frontend/src/App.test.tsx` asserting start → phase transition + countdown (US2 scenarios 1, 4)

**Checkpoint**: US2 independent — seller can launch; US1 bidding then works against it

---

## Phase 5: User Story 3 - Outbid user withdraws refund (Priority: P3)

**Goal**: Outbid user reclaims full prior bid in one action

**Independent Test**: After being outbid, withdraw → wallet balance +claimable, readout resets to 0;
0-claim blocked pre-wallet (quickstart V5)

### Tests for User Story 3 ⚠️ (write FIRST — must fail)

- [X] T045 [P] [US3] RED contract tests for `withdraw()` in `contracts/test/EnglishAuction.t.sol`: claims exact `bids[caller]`; balance zeroed before transfer (CEI — read `bids` during a reentering receiver attempt via test contract); emits `Withdraw(bidder, amount)`; second withdraw transfers 0 without revert; outbid flow: bid A → bid B → A withdraw == A's bid
- [X] T046 [P] [US3] RED tests `frontend/src/hooks/useWithdrawFunds.test.ts`: `validate()` blocks zero claim ("Nothing to withdraw") and not-connected (US3 scenario 2); success resets readout (scenario 1); rejected tx → neutral notice, balance unchanged (scenario 3)

### Implementation for User Story 3

- [X] T047 [US3] Implement `frontend/src/hooks/useWithdrawFunds.ts` depends on T046, T026
- [X] T048 [P] [US3] RED tests `frontend/src/sections/WithdrawPanel.test.tsx`: claimable readout >0 shows CTA; hidden/disabled at 0; post-withdraw reset
- [X] T049 [US3] Implement `frontend/src/sections/WithdrawPanel.tsx` → T048 GREEN

**Checkpoint**: US3 independent — refunds work; US1+US3 together form the full bidder loop

---

## Phase 6: User Story 4 - Settle and view auction result (Priority: P4)

**Goal**: After end time, anyone finalizes: winner gets NFT, seller gets highest bid (or NFT back
on zero bids); result displayed

**Independent Test**: After `endAt`, settle from any account → NFT/payout moved, ResultPanel shows
winner+amount or "NO BIDS"; early/double settle blocked (quickstart V6, V7)

### Tests for User Story 4 ⚠️ (write FIRST — must fail)

- [X] T050 [P] [US4] RED contract tests for `end()` in `contracts/test/EnglishAuction.t.sol`: reverts `"not started"`, `"not ended"` (before endAt), `"ended"` (double); with bids → NFT to `highestBidder`, seller balance += exactly `highestBid`; zero bids → NFT back to seller, seller receives 0; emits `End(winner, amount)`; seller-payout revert message `"transfer failed"` (typo fixed, R5 #5)
- [X] T051 [P] [US4] RED timing-boundary tests in `contracts/test/EnglishAuction.t.sol` (or fuzz durations 1s…31_536_000s): bid rejected at `endAt`, settle rejected at `endAt−1`, both settle allowed at `endAt` and `endAt+1`
- [X] T052 [P] [US4] RED invariant suite `contracts/test/EnglishAuction.invariant.t.sol` + handler contract: (1) solvency `address(auction).balance == Σ bids + (live ? highestBid : 0)`; (2) escrow conservation auction owns ≤1 token; (3) terminal immutability `ended ⇒` no state transitions reachable
- [X] T053 [P] [US4] RED tests `frontend/src/hooks/useSettleAuction.test.ts`: `validate()` — before endAt blocked ("still in progress"), already ended blocked, not-started blocked, otherwise ok (US4 scenarios 3–4); phase matrix AWAITING_SETTLEMENT → SETTLED

### Implementation for User Story 4

- [X] T054 [US4] Implement `frontend/src/hooks/useSettleAuction.ts` depends on T053, T026
- [X] T055 [P] [US4] RED tests `frontend/src/sections/SettlePanel.test.tsx` + `frontend/src/sections/ResultPanel.test.tsx`: settle CTA only in AWAITING_SETTLEMENT; ResultPanel shows winner + amount / "NO BIDS" (scenario 2)
- [X] T056 [US4] Implement `frontend/src/sections/SettlePanel.tsx` + `frontend/src/sections/ResultPanel.tsx` → T055 GREEN

**Checkpoint**: US4 independent — full auction lifecycle closes on-chain + on-screen

---

## Phase 7: User Story 5 - Mint an NFT to auction (Priority: P5)

**Goal**: Would-be seller mints via metadata URI, then proceeds to US2

**Independent Test**: Submit valid URI → new sequential token id owned by caller displayed;
empty/invalid URI warned (quickstart V2)

### Tests for User Story 5 ⚠️ (write FIRST — must fail)

- [X] T057 [P] [US5] RED contract tests in `contracts/test/SolimanWeb3.t.sol`: first `mintNFT` returns id 0 and assigns ownership; sequential ids 1, 2…; `tokenURI(id)` == submitted jsonUri; `_safeMint` behavior: mint to a contract without `onERC721Received` reverts; mint to EOA succeeds (R5 #6)
- [X] T058 [P] [US5] RED tests `frontend/src/hooks/useMintNft.test.ts`: `validate()` blocks empty URI, warns on obviously invalid URI (not http/ipfs/data) per spec scenario 2; surfaces revert/failure (FR-008, FR-010)
- [X] T059 [P] [US5] RED tests `frontend/src/sections/MintPanel.test.tsx`: URI input + mint CTA; success shows new tokenId; failure surfaced; disconnected/wrong-network states

### Implementation for User Story 5

- [X] T060 [US5] Implement `frontend/src/hooks/useMintNft.ts` depends on T058, T026
- [X] T061 [US5] Implement `frontend/src/sections/MintPanel.tsx` → T059 GREEN
- [X] T062 [US5] Wire pre-start flow in `frontend/src/App.tsx` (MintPanel → StartPanel handoff: after mint, token id passed into start context) + update `frontend/src/App.test.tsx` integration

**Checkpoint**: All 5 stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T063 [P] Responsive + a11y pass across `frontend/src/sections/` and `frontend/src/components/`: 360px width no horizontal scroll, focus rings `--color-white`, contrast ≥14:1 paper-on-void; update tests (FR-012, SC-007)
- [X] T064 [P] Add quality gates to `scripts/check.sh`: SC-004 palette gate (fail on any hex/rgb/hsl/oklch literal in `frontend/src` outside `frontend/src/styles/caliper.css`) AND SC-006 bundle budget (fail if initial JS+CSS from `vite build` exceeds 300 KB gzip)
- [X] T065 [P] Connection/error states (tests first → impl): `chain_unreachable` (502) and `not_deployed` (503) Caliper-styled views in `frontend/src/sections/ErrorState.tsx` + boot wiring in `frontend/src/App.tsx` (spec edge cases, SC-005)
- [X] T066 Verify/raise coverage ≥95% lines / ≥90% branches all three packages (`forge coverage`, `vitest --coverage`); close gaps with RED-first tests (constitution III)
- [X] T067 Documentation sync per constitution V: root `README.md` (run/deploy/validation), NatSpec final review in `contracts/src/*.sol`, record known debt — Playwright e2e deferral (research R6) — in `docs/tech-debt.md`
- [X] T068 Execute `specs/001-auction-web-ui/quickstart.md` scenarios V1–V9 end-to-end; fix any failure test-first (RED regression test → fix → GREEN); note results in PR/commit message
- [ ] T069 **[BLOCKED — no production host available yet; re-run at the Vercel deployment step (user-provisioned wallet key + RPC URL) — recorded in docs/tech-debt.md]** Remote production validation (FR-013): execute the quickstart "Production Deployment" section on a real host (anvil + deploy + `npm run build`/`npm start` behind HTTPS reverse proxy) and re-verify V1, V4, and V8 against the public origin — wallet add-network flow must work with `https://<host>/rpc`; if no host is available yet, mark BLOCKED in the task and record it in `docs/tech-debt.md` (do not silently skip)
- [X] T070 Run full `./scripts/check.sh` gate green (fmt + lint + build + all tests + coverage + palette grep + bundle budget) and commit final state on branch `001-auction-web-ui`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
  - Contracts (T010–T014) → parallel with backend (T015–T016) and frontend design/boot (T017–T027) streams
  - T023/T024 depend on T012/T014 (ABIs/deploy need built contracts)
- **US1 (Phase 3)**: After Foundational — MVP
- **US2 (Phase 4)**: After Foundational; independent of US1 code (only shares foundation hooks)
- **US3 (Phase 5)**: After Foundational (log/UI integration benefits from US1 but not required)
- **US4 (Phase 6)**: After Foundational; invariant suite (T052) assumes US1–US3 contract tests exist in same file — run last among contract suites
- **US5 (Phase 7)**: After Foundational
- **Polish (Phase 8)**: After all desired stories (T068 quickstart requires US1+US2+US4 lifecycle minimum; T069 requires T068 green + a reachable production host)

### Within Each User Story

1. All RED test tasks first ([P] among themselves) — verify they FAIL
2. Implementation tasks (respecting `depends on` notes)
3. GREEN confirmation → integration/App wiring → checkpoint validation (quickstart scenario)

### Cross-Story Notes

- `contracts/test/EnglishAuction.t.sol` is appended by US1/US2/US3/US4 — execute those
  test tasks sequentially relative to each other (not [P] against each other)
- `frontend/src/App.tsx` is touched by US1 (T038), US2 (T044), US5 (T062) — sequential
- All other [P] tasks touch distinct files

### Parallel Opportunities

- Phase 1: T006 ∥ T007 ∥ T009 after T002–T005 exist
- Phase 2: contracts stream (T010–T014) ∥ backend stream (T015–T016) ∥ frontend stream (T017–T022, T025–T027) ∥ T023 ∥ T024
- Each story: all RED test tasks run in parallel, then implementation

---

## Parallel Example: User Story 1

```bash
# RED tests first — launch together (distinct files):
Task: "T028 RED contract tests for bid() in contracts/test/EnglishAuction.t.sol"
Task: "T029 RED fuzz tests in contracts/test/EnglishAuction.fuzz.t.sol"
Task: "T030 RED tests frontend/src/hooks/useAuctionState.test.ts"
Task: "T031 RED tests frontend/src/hooks/usePlaceBid.test.ts"

# Then implementation:
Task: "T032 Implement frontend/src/hooks/useAuctionState.ts"
Task: "T033 Implement frontend/src/hooks/usePlaceBid.ts"
Task: "T034+T035 AuctionPanel + BidForm (tests → impl)"
Task: "T036+T037 ActivityLog + TxToast (tests → impl)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational (CRITICAL — blocks all stories)
2. Phase 3 US1 (bid loop) — validate with quickstart V1 + V4 (start auction via `cast send`)
3. **STOP and VALIDATE** — demoable MVP: connect, watch state, bid

### Incremental Delivery

1. Setup + Foundational → contracts modernized (R5 #1–8), backend serving, design system live
2. +US1 → bid MVP (demo)
3. +US2 → seller launch (full live demo)
4. +US3 → refunds (full bidder fairness)
5. +US4 → settlement (complete lifecycle, invariants proven)
6. +US5 → mint onboarding
7. Polish → quickstart V1–V9 + `check.sh` green (SC-004 palette gate, coverage ≥95/90)

### Definition of Done per task

- RED test committed first (verified failing) for any implementation task
- `./scripts/check.sh` green after each story checkpoint
- Docs/NatSpec updated in the same change (constitution V)
- Commit per task or logical group on `001-auction-web-ui`

---

## Notes

- [P] = different files, no dependencies on incomplete tasks
- Contract change approvals recorded: R5 #1 duration (Q3), #2 OZ forge-install, #3 pragma
  0.8.31, #4 NatSpec/lint, #5 typo fix, #6 `_safeMint`, #7 name trim — all user-approved
  2026-09-26; R5 #8 `startingBid` immutable getter — approved 2026-09-26 via
  /speckit.analyze I-1 remediation
- Revert strings & event signatures frozen (chain-interface.md §1) — UI catalogue tolerates
  both `trasfer`/`transfer` spellings until contracts are rebuilt (T012)
- Known debt (constitution V, research R6): Playwright e2e deferred to post-v1, recorded in
  `docs/tech-debt.md` (T067)
