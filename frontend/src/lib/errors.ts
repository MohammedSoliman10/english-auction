/**
 * Revert-string → user-message catalogue (data-model §7, FR-004).
 * Contract revert strings never reach the user raw.
 */
export const REVERT_MESSAGES = {
  'not started': 'Auction has not started yet',
  'not seller': 'Only the seller can start this auction',
  'not ended': 'Auction is still in progress',
  'value < highest': 'Bid must exceed current highest',
  'transfer failed': 'Transfer failed — funds remain claimable, retry',
  // legacy source typo (R5 #5) — must map to the identical message
  'trasfer failed': 'Transfer failed — funds remain claimable, retry',
  started: 'Auction already started',
  ended: 'Auction ended — no more bids',
} as const;

const GENERIC = 'Transaction could not be completed — try again.';

/**
 * Client pre-check messages (data-model §7, last row) — shown before any
 * wallet prompt. Shared by every write hook so the phrasing never drifts.
 */
export const NOT_CONNECTED_MESSAGE = 'Connect a wallet to continue.';

/**
 * US3 pre-check (data-model §7 client pre-check row, FR-004): withdraw is
 * blocked before any wallet prompt when the claim is zero — the contract's
 * withdraw() itself is unguarded, so the UI is where "nothing to withdraw"
 * is enforced (spec US3 scenario 2).
 */
export const NOTHING_TO_WITHDRAW_MESSAGE = 'Nothing to withdraw';

/**
 * US4 pre-check (matrix §3 SETTLED row): `end()` is terminal — a second
 * settle attempt is blocked before any wallet prompt.
 */
export const ALREADY_SETTLED_MESSAGE = 'Auction already settled';

/**
 * US2 escrow prerequisite (spec §7 open-question resolution): the seller
 * must still own the auctioned NFT before approve/start can be prompted.
 */
export const NOT_OWNER_MESSAGE =
  'You no longer own the auction NFT — transfer it back to start.';

export function wrongNetworkMessage(chainName: string): string {
  return `Wrong network — switch to ${chainName}.`;
}

/**
 * Map any error/cause text to a friendly Caliper-voice message.
 * Keys are checked longest-first so `not started` never matches `started`.
 */
export function friendlyMessage(cause: string): string {
  const normalized = cause.trim().toLowerCase();
  if (normalized.length === 0) return GENERIC;

  const byLength = Object.entries(REVERT_MESSAGES).sort(
    ([a], [b]) => b.length - a.length,
  );
  for (const [revert, message] of byLength) {
    if (normalized.includes(revert)) return message;
  }
  return GENERIC;
}
