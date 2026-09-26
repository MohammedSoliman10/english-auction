# Contract: Frontend UI (React app — `frontend/src/`)

**Feature**: 001-auction-web-ui | **Date**: 2026-09-26 | **Spec**: FR-001…FR-016, SC-004

## 1. Page composition (single page, FR-016)

```text
<AuctionPage>
├── <Header>            brand display "ENGLISH AUCTION." + <ConnectWallet> + network badge
├── <AuctionPanel>      status readout, <Countdown>, <RadialGauge> time-remaining arc,
│                       highest bid <Readout>, highest bidder, escrowed NFT preview
├── <BidForm>           amount input (ETH) + bid button — enabled only in OPEN_FOR_BIDS
├── <WithdrawPanel>     my-refundable <Readout> + withdraw button (shown when > 0 OR after outbid)
├── <MintPanel>         URI input + mint button (pre-start onboarding, US5)
├── <StartPanel>        seller-only start action (pre-start state)
├── <SettlePanel>       settle/end action (AWAITING_SETTLEMENT state, anyone)
├── <ResultPanel>       settled winner + amount / "NO BIDS" (SETTLED state)
├── <ActivityLog>       Start/Bid/Withdraw/End events, mono table, <SignalBars> bid history
├── <ErrorState>        full-page connection error (chain_unreachable / not_deployed)
└── <TxToast>           lifecycle: awaiting → pending(hash) → success | reverted | rejected
```

Panels are mutually exclusive by `phase` — one primary action area visible at a time
(prevents invalid actions, FR-004).

## 2. Hook API (TypeScript surface)

```ts
// FR-002 — derived read model (re-fetch on mount + poll + on event)
useAuctionState(): {
  phase: 'NOT_STARTED' | 'OPEN_FOR_BIDS' | 'AWAITING_SETTLEMENT' | 'SETTLED';
  seller: Address; nft: Address; nftId: bigint;
  startingBid: bigint;            // immutable getter — always available (R5 #8)
  highestBid: bigint; highestBidder: Address;
  endAt: bigint; timeRemaining: bigint;   // seconds, ≥ 0
  myRefundable: bigint; isHighestBidder: boolean; isSeller: boolean;
  isLoading: boolean; error?: string;      // includes 'chain_unreachable'
}

// Every write: client pre-validation (FR-004) BEFORE wallet prompt, then tx lifecycle
usePlaceBid():  { validate(amount: bigint): string | null;   // revert-cat. msg or null
                  submit(amount: bigint): void; tx: TxLifecycle }
useWithdrawFunds(): { validate(): string | null; submit(): void; tx: TxLifecycle }
useStartAuction():  { validate(): string | null; submit(): void; tx: TxLifecycle }
useSettleAuction(): { validate(): string | null; submit(): void; tx: TxLifecycle }
useMintNft():       { validate(uri: string): string | null; submit(uri: string): void; tx: TxLifecycle }

useActivityLog(): { entries: Array<{ kind:'Start'|'Bid'|'Withdraw'|'End';
                                     actor: Address; amount?: bigint; time: number }>;
                    isLoading: boolean }

type TxLifecycle = { status: 'idle'|'awaiting_confirmation'|'pending'|'success'
                            |'rejected'|'reverted';
                     hash?: `0x${string}`; message?: string }   // FR-010
```

Validation messages come from the shared catalogue
(`lib/errors.ts`, see data-model §7) — contract revert strings never reach the user raw.

## 3. State → action matrix (FR-004 acceptance)

| phase | wallet | visible primary action | blocked actions produce |
|-------|--------|------------------------|--------------------------|
| NOT_STARTED | any | — (read-only) | bid → "Auction has not started yet" |
| NOT_STARTED | seller | `<StartPanel>` | start by non-seller → "Only the seller can start" |
| OPEN_FOR_BIDS | any | `<BidForm>`; `<WithdrawPanel>` if `myRefundable > 0` | bid ≤ highest → inline "Bid must exceed current highest"; wrong network → prompt to switch |
| AWAITING_SETTLEMENT | any | `<SettlePanel>` | bid → "Auction ended — no more bids" |
| SETTLED | any | `<ResultPanel>` | end again → "Auction already settled" |

## 4. Design-token contract (SC-004 — achromatic, FR-011)

Defined once in `frontend/src/styles/caliper.css` `@theme`:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-void` | `#0A0D09` | page background |
| `--color-surface-1` | `#131519` | panel background |
| `--color-surface-2` | `#1D2026` | raised surface / borders fill |
| `--color-surface-3` | `#2A2E35` | hairline grid + borders |
| `--color-signal` | `#979C99` | mid-gray text, signal bars mid steps |
| `--color-paper` | `#F4F5F7` | primary text |
| `--color-white` | `#FFFFFF` | display headings, peak bar, CTA fill |

Rules: no other color literals anywhere in `frontend/src` (enforced by `check.sh`
grep); type = tight grotesk display (`DisplayHeading`) + monospace uppercase
micro-labels (`MonoLabel`, letter-spacing ≥ 0.12em); hairline grid = `HairlineGrid`
component (1px `--color-surface-3` lines); data viz = `SignalBars` (13-step grayscale
ramp mirroring the reference image) and `RadialGauge` (gray arc) — never color-coded
semantic colors: state is conveyed by text + shape, not hue.

## 5. Responsive & a11y floor (FR-012, SC-007)

Breakpoints: mobile-first, `sm 640px`, `lg 1024px`. All primary actions reachable
without horizontal scrolling at 360px width. Contrast: `--color-paper` on
`--color-void` ≥ 14:1; focus rings visible in `--color-white` (achromatic-safe).

## 6. Boot sequence (FR-015 / R4)

`fetch('/api/config')` → build wagmi config (`http(s)://<origin>/rpc`, chainId from
config) → mount providers → `useAuctionState` initial read. Config fetch failure shows
the connection-error state (spec edge case), never a blank page.
