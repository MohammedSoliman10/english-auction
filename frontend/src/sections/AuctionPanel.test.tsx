import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuctionState: vi.fn(),
}));

vi.mock('../hooks/useAuctionState', () => ({
  useAuctionState: () => mocks.useAuctionState(),
}));

import { AuctionPanel } from './AuctionPanel';

const SELLER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const BIDDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const NFT = '0x5fbdb2315678afecb367f032d93f642f64180aa3';
const ZERO = '0x0000000000000000000000000000000000000000';

interface StateOverrides {
  phase?: string;
  highestBid?: bigint;
  highestBidder?: string;
  startingBid?: bigint;
  timeRemaining?: bigint;
  nftId?: bigint;
  isLoading?: boolean;
  error?: string;
}

function auctionState(o: StateOverrides = {}) {
  return {
    phase: 'OPEN_FOR_BIDS',
    seller: SELLER,
    nft: NFT,
    nftId: 7n,
    startingBid: 100_000_000_000_000_000n, // 0.1
    highestBid: 1_500_000_000_000_000_000n, // 1.5
    highestBidder: BIDDER,
    endAt: 0n,
    timeRemaining: 3661n, // 1:01:01
    myRefundable: 0n,
    isHighestBidder: false,
    isSeller: false,
    isLoading: false,
    error: undefined,
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAuctionState.mockImplementation(() => auctionState());
});

describe('AuctionPanel — readouts + countdown + gauge (FR-002, §1)', () => {
  it('shows phase badge, countdown and the time-remaining gauge', () => {
    render(<AuctionPanel />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-phase', 'OPEN_FOR_BIDS');
    expect(screen.getByText('1:01:01')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'time remaining' })).toBeInTheDocument();
  });

  it('shows the highest bid as exact ETH with the starting-bid floor', () => {
    render(<AuctionPanel />);
    expect(screen.getByText('1.5')).toBeInTheDocument();
    expect(screen.getByText(/starting bid 0\.1/i)).toBeInTheDocument();
  });

  it('shortens the highest bidder address', () => {
    render(<AuctionPanel />);
    expect(screen.getByText('0x7099…79C8')).toBeInTheDocument();
  });

  it('reads "no bids yet" while nobody has bid', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ highestBidder: ZERO }),
    );
    render(<AuctionPanel />);
    expect(screen.getByText('no bids yet')).toBeInTheDocument();
  });

  it('previews the escrowed NFT id + contract', () => {
    render(<AuctionPanel />);
    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(screen.getByText('0x5fbd…0aa3')).toBeInTheDocument();
  });
});

describe('AuctionPanel — loading / error states (data-model §1)', () => {
  it('shows a loading note instead of readouts while reading the chain', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ isLoading: true }),
    );
    render(<AuctionPanel />);
    expect(screen.getByText(/reading chain/i)).toBeInTheDocument();
    expect(screen.queryByText('1.5')).not.toBeInTheDocument();
  });

  it('surfaces chain_unreachable as an alert — never a raw error', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ error: 'chain_unreachable' }),
    );
    render(<AuctionPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent(/chain unreachable/i);
    expect(screen.queryByText('1.5')).not.toBeInTheDocument();
  });
});
