import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuctionState: vi.fn(),
}));

vi.mock('../hooks/useAuctionState', () => ({
  useAuctionState: () => mocks.useAuctionState(),
}));

import { ResultPanel } from './ResultPanel';
import { formatAddress } from '../lib/format';

const WINNER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;
const ZERO = '0x0000000000000000000000000000000000000000' as const;

function auctionState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'SETTLED',
    highestBidder: WINNER,
    highestBid: 8_000_000_000_000_000n, // 0.008 ETH
    isLoading: false,
    error: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAuctionState.mockImplementation(() => auctionState());
});

describe('ResultPanel — US4 scenarios 1–2 (matrix §3 SETTLED row)', () => {
  it('shows the winner and final amount once settled (scenario 1)', () => {
    render(<ResultPanel />);
    expect(screen.getByText('winner')).toBeInTheDocument();
    expect(screen.getByText(formatAddress(WINNER))).toBeInTheDocument();
    expect(screen.getByText('final bid')).toBeInTheDocument();
    expect(screen.getByText('0.008')).toBeInTheDocument();
  });

  it('shows NO BIDS when nobody bid — floor amount suppressed (scenario 2)', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ highestBidder: ZERO, highestBid: 100_000_000_000_000_000n }),
    );
    render(<ResultPanel />);

    expect(screen.getByText('NO BIDS')).toBeInTheDocument();
    // the starting-bid floor must never masquerade as a real result
    expect(screen.queryByText('final bid')).not.toBeInTheDocument();
    expect(screen.queryByText('0.1')).not.toBeInTheDocument();
    expect(screen.queryByText('winner')).not.toBeInTheDocument();
  });

  it('renders nothing outside SETTLED (phase-exclusive)', () => {
    for (const phase of ['NOT_STARTED', 'OPEN_FOR_BIDS', 'AWAITING_SETTLEMENT']) {
      mocks.useAuctionState.mockImplementation(() => auctionState({ phase }));
      const { container, unmount } = render(<ResultPanel />);
      expect(container.firstChild).toBeNull();
      unmount();
    }
  });
});
