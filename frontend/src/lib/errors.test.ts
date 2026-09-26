import { describe, expect, it } from 'vitest';
import { friendlyMessage, REVERT_MESSAGES } from './errors';

describe('revert catalogue (data-model §7)', () => {
  it.each([
    ['not started', 'Auction has not started yet'],
    ['started', 'Auction already started'],
    ['not seller', 'Only the seller can start this auction'],
    ['value < highest', 'Bid must exceed current highest'],
    ['ended', 'Auction ended — no more bids'],
    ['not ended', 'Auction is still in progress'],
    ['transfer failed', 'Transfer failed — funds remain claimable, retry'],
    // legacy typo from the original source must map to the same message (R5 #5)
    ['trasfer failed', 'Transfer failed — funds remain claimable, retry'],
  ] as const)('maps %j to the Caliper-voice message', (revert, message) => {
    expect(friendlyMessage(revert)).toBe(message);
    expect(REVERT_MESSAGES[revert]).toBe(message);
  });

  it('maps revert reasons embedded in longer strings', () => {
    expect(friendlyMessage('execution reverted: value < highest')).toBe(
      'Bid must exceed current highest',
    );
    expect(friendlyMessage('ERC721: transfer failed')).toBe(
      'Transfer failed — funds remain claimable, retry',
    );
  });

  it('returns a generic message for unknown causes — never raw internals', () => {
    const msg = friendlyMessage('some completely unknown vm error');
    expect(msg).not.toContain('unknown vm error');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('always returns a non-empty string', () => {
    for (const input of ['', '   ', 'x']) {
      expect(friendlyMessage(input).length).toBeGreaterThan(0);
    }
  });
});
