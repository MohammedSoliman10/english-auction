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
