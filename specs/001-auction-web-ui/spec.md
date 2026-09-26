# Feature Specification: English Auction Web App

**Feature Branch**: `001-auction-web-ui`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Build a web app for the EnglishAuction + SolimanWeb3 (ERC721) contracts. Main goal is a frontend UI using the provided monochrome 'Caliper' reference design (dark achromatic palette #0A0D09 → #FFFFFF, hairline grids, grayscale signal bars, mono labels — never a colorful dashboard). The two pasted contracts (EnglishAuction.sol, SolimanWeb3.sol) are the contracts to use; they may be modified if needed. When deployed, the app must work online without Sepolia and without requiring Anvil/local chain tooling on the visitor's machine."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Place a bid on a live auction (Priority: P1)

A visitor connects their wallet, sees the live auction (current highest bid, who is winning, time remaining), and places a bid higher than the current highest. If outbid, their funds become withdrawable. The interface shows their bid status at all times.

**Why this priority**: Bidding is the core value of an auction app. This story alone delivers a working product: a bidder can participate end-to-end against a pre-started auction.

**Independent Test**: With an auction already started, connect a wallet, submit a bid above the highest, and observe the "highest bid" readout update and the previous highest bidder's refund become withdrawable — all without errors.

**Acceptance Scenarios**:

1. **Given** a started auction with highest bid 0.1 and end time in the future, **When** a connected user bids 0.15, **Then** the bid is accepted, the readout shows 0.15 with the user as highest bidder, and a Bid entry appears in the activity log.
2. **Given** a started auction with highest bid 0.1, **When** a user bids 0.1 or less, **Then** the bid is rejected with a clear "must exceed current highest bid" message and no state change occurs.
3. **Given** a started auction whose end time has passed, **When** a user attempts to bid, **Then** the bid is rejected with an "auction ended" message.
4. **Given** a user was outbid, **When** they open the app again later (fresh page load), **Then** their withdrawable balance is shown correctly and they can reclaim it.

---

### User Story 2 - Seller launches an auction (Priority: P2)

A seller connects their wallet, selects/mints an NFT they own, and starts the auction. The NFT moves into escrow, the auction opens for bidding, and a visible countdown shows when it ends.

**Why this priority**: Without a started auction there is nothing to bid on; this is the supply side of the marketplace and the prerequisite for all other stories.

**Independent Test**: With a wallet that owns the NFT, click start, approve the wallet prompts, and verify the NFT is held by the auction contract and the UI flips to "live" with a running countdown.

**Acceptance Scenarios**:

1. **Given** a connected seller wallet that owns the NFT (and has approved it), **When** they start the auction, **Then** the NFT transfers into the auction contract, the UI shows the auction as live with a countdown, and a Start event appears in the activity log.
2. **Given** a wallet that does not own the NFT, **When** it attempts to start the auction, **Then** the action fails gracefully with a clear message and no partial state change.
3. **Given** an auction already started, **When** anyone attempts to start it again, **Then** the attempt is rejected with an "already started" message.
4. **Given** a seller starts an auction, **When** the page is reloaded, **Then** the live state, countdown, and escrowed NFT ownership are reflected accurately.

---

### User Story 3 - Outbid user withdraws their refund (Priority: P3)

A user who was outbid returns to the app, sees their withdrawable balance, and reclaims it in one action.

**Why this priority**: Fair refunds are essential to trust, but they only occur after bidding activity exists — hence below starting and bidding.

**Independent Test**: After being outbid, click withdraw and verify the wallet balance increases by the full previous bid and the in-app withdrawable readout resets to zero.

**Acceptance Scenarios**:

1. **Given** a user holds a withdrawable balance of 0.5, **When** they click withdraw and confirm, **Then** they receive 0.5 and the readout resets to zero with a Withdraw entry in the activity log.
2. **Given** a user with zero withdrawable balance, **When** they attempt to withdraw, **Then** the action is blocked with a clear "nothing to withdraw" message (no empty transaction submitted).
3. **Given** a withdrawal transaction that fails in the wallet, **When** the user rejects it, **Then** the app shows a neutral "transaction rejected" notice and the balance remains unchanged.

---

### User Story 4 - Settle and view the auction result (Priority: P4)

After the countdown reaches zero, anyone can finalize the auction: the winner receives the NFT, the seller receives the highest bid, and the UI displays the final result. If nobody bid, the NFT returns to the seller.

**Why this priority**: Settlement completes the lifecycle, but depends on bids having occurred and time elapsing.

**Independent Test**: After end time, trigger end, and verify the winner owns the NFT, the seller received the funds, and the UI shows a final "ended" state with winner and amount.

**Acceptance Scenarios**:

1. **Given** an ended-by-clock auction with at least one bid, **When** a user triggers end, **Then** the NFT transfers to the highest bidder, the seller receives the highest bid, and the result (winner, amount) is displayed.
2. **Given** an ended-by-clock auction with zero bids, **When** end is triggered, **Then** the NFT returns to the seller and the result shows "no bids".
3. **Given** an auction whose end time has not been reached, **When** a user attempts to end it, **Then** the action is rejected with a "still in progress" message.
4. **Given** an already-ended auction, **When** a user attempts to end it again, **Then** the attempt is rejected and no assets move.

---

### User Story 5 - Mint an NFT to auction (Priority: P5)

A would-be seller without an NFT can mint one through the app by providing a metadata JSON URI, then proceeds to Story 2.

**Why this priority**: Lowers onboarding friction for sellers, but sellers who already own an NFT can skip it — thus non-essential for MVP.

**Independent Test**: Submit a valid metadata URI, confirm the wallet prompts, and verify a new token id is assigned to the caller and displayed as ready to auction.

**Acceptance Scenarios**:

1. **Given** a connected wallet, **When** they submit a valid metadata URI, **Then** a new NFT is minted to their wallet and the UI confirms the new token id.
2. **Given** an invalid or unreachable URI — invalid meaning it does not start with `http://`, `https://`, `ipfs://`, or `data:` — **When** they submit it, **Then** the app warns before spending gas, or surfaces the failure clearly after rejection.

---

### Edge Cases

- What happens when a bid is submitted equal to or below the current highest bid? → Rejected with clear message; no wallet prompt for a doomed transaction.
- What happens when bidding starts before the auction is started or after it ended? → Blocked with explicit "not started" / "ended" messaging.
- What happens when the auction ends with zero bids? → NFT returns to seller; UI shows "no bids" result.
- What happens when the seller starts the auction but does not own/approve the NFT? → Start fails atomically; UI explains the missing prerequisite.
- What happens when someone tries to end an auction twice or before the end time? → Rejected; no asset movement.
- What happens when a user rejects or a transaction reverts in their wallet? → UI shows a neutral failure notice; on-chain and displayed state remain unchanged and consistent.
- What happens when a withdrawal target cannot receive funds? → The failed transfer reverts the entire transaction, restoring the claim in full; the user can retry later and the UI surfaces the failure without any loss of funds.
- What happens when the page is closed mid-transaction? → On next load, all state is re-derived fresh; the UI never trusts stale local data.
- What happens when the network/RPC endpoint is unreachable? → UI shows a clear connection error state instead of empty/broken views.
- What happens on very small screens or mobile browsers? → Layout remains usable; all primary actions reachable without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let a visitor connect a browser wallet and display the connected account and network status.
- **FR-002**: The app MUST display live auction state at all times: auction status (not started / live / ended), current highest bid, highest bidder, starting bid, time remaining, and the connected user's withdrawable balance.
- **FR-003**: Any connected user MUST be able to place a bid strictly greater than the current highest bid while the auction is live.
- **FR-004**: The app MUST block and clearly explain every invalid action before a wallet prompt appears (bid too low, not started, ended, already started, nothing to withdraw, already ended).
- **FR-005**: An outbid user MUST be able to withdraw their full previous bid in a single action at any time after being outbid.
- **FR-006**: The seller MUST be able to start the auction, which escrows their NFT into the auction contract and opens bidding with a visible countdown.
- **FR-007**: After the end time, any user MUST be able to trigger settlement: winner receives the NFT, seller receives the highest bid; with zero bids the NFT returns to the seller.
- **FR-008**: The app MUST allow minting an NFT by supplying a metadata JSON URI, returning the new token id to the minter.
- **FR-009**: The app MUST show an activity log derived from on-chain events (Start, Bid, Withdraw, End) with actor, amount, and time.
- **FR-010**: Every wallet action MUST show its full lifecycle (awaiting confirmation → pending → success/reverted/rejected) with the failure reason surfaced when available.
- **FR-011**: The interface MUST strictly follow the reference "Caliper" monochrome design system: dark achromatic background ramp `#0A0D09`, `#131519`, `#1D2026`, `#2A2E35`, mid-gray `#979C99`, light `#F4F5F7`, white `#FFFFFF`; hairline grid backgrounds; grayscale signal-bar/radial-gauge data visualizations; small uppercase monospace micro-labels; large bold display headings — zero chromatic (colored) pixels anywhere in the UI.
- **FR-012**: The UI MUST be responsive and usable on desktop and mobile viewports.
- **FR-013**: The deployed app MUST work for an online visitor with nothing but a browser and a wallet. Target: a hosted shared chain — a node runs on a server and the app points at its RPC endpoint — so visitors need no local blockchain tooling, no Sepolia or other public testnet, and no developer setup on their machine.
- **FR-014**: The app MUST NOT custody user keys or funds; every state-changing action requires explicit wallet confirmation.
- **FR-015**: All displayed auction state MUST be re-derived from the chain on every page load (no stale trust in locally stored state).
- **FR-016**: The app MUST present a single auction page showing the one configured auction instance; a create-auction flow and a multi-auction list/grid view are OUT OF SCOPE for v1.

### Key Entities

- **Auction**: One auction instance for one NFT — attributes: seller, NFT (contract + token id), starting bid, current highest bid & highest bidder, per-bidder withdrawable balances, start/end times, started/ended flags. Relationships: created by seller; escrows exactly one NFT; referenced by many Bids.
- **Bid**: An attempt to become highest bidder — attributes: bidder, amount, timestamp. Relationship: superseded bids become the bidder's withdrawable balance.
- **NFT (SolimanWeb3 token)**: A mintable collectible — attributes: token id, owner, metadata JSON URI. Relationship: owned by a wallet; escrowed by an Auction while live; transferred to winner (or back to seller) at settlement.
- **Wallet session**: The connected visitor — attributes: account address, connected network, approval status. Relationship: acts as bidder, seller, or observer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor goes from opening the URL to seeing live auction state in under 30 seconds, installing nothing beyond their existing wallet.
- **SC-002**: 95% of bid attempts are reflected in the interface within 15 seconds of wallet confirmation (measured across repeated quickstart V4 validation runs).
- **SC-003**: The complete lifecycle (mint → start → bid → outbid → withdraw → end) can be demonstrated end-to-end with zero manual fixes or console interventions.
- **SC-004**: 100% of UI colors are achromatic — every rendered color falls on the gray ramp defined in FR-011 (verified by sampling the rendered palette).
- **SC-005**: 100% of invalid actions in the Edge Cases section are prevented with a clear user-facing message and no unintended on-chain state change.
- **SC-006**: The interface loads to a usable state in under 3 seconds on a standard broadband connection.
- **SC-007**: All primary flows (bid, withdraw, start, end) work without layout breakage on the latest Chrome, Firefox, Safari, and a mobile viewport.
- **SC-008**: After any page reload, displayed state matches on-chain state exactly (0 discrepancies in a scripted lifecycle comparison).

## Assumptions

- Visitors have an existing browser wallet; wallet setup itself is out of scope.
- The seller owns the auctioned NFT and approves the escrow transfer before starting (US2).
- The two provided contracts are the behavioral source of truth; they may be modified only in behavior-compatible ways (bug fixes, deployment parameters).
- Auction duration is a constructor parameter chosen at deploy time, defaulting to 7 days; demo deployments may set it as low as 60 seconds.
- Bidding uses the chain's native currency only (contract accepts `msg.value`); no ERC-20 bidding, fees, royalties, or extensions in v1.
- Metadata URIs point to valid JSON reachable off-chain; content hosting of that JSON is out of scope.
- One auction deployment per NFT; v1 displays only the single configured auction instance (no cross-auction aggregation — see FR-016).
- The reference image is the authoritative style guide; no branding beyond "English Auction" display text is required in v1.
- No admin/owner role, upgradeability, or pausing is required in v1.
