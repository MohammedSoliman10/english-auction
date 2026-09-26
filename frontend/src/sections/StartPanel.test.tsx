import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useStartAuction: vi.fn(),
  useAuctionState: vi.fn(),
}));

vi.mock('../hooks/useStartAuction', () => ({
  useStartAuction: () => mocks.useStartAuction(),
}));
vi.mock('../hooks/useAuctionState', () => ({
  useAuctionState: () => mocks.useAuctionState(),
}));

import { AuctionPanel } from './AuctionPanel';
import { StartPanel } from './StartPanel';

const SELLER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ZERO = '0x0000000000000000000000000000000000000000';
const NFT = '0x5fbdb2315678afecb367f032d93f642f64180aa3';

const validate = vi.fn();
const submit = vi.fn();

function auctionState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'NOT_STARTED',
    seller: SELLER,
    nft: NFT,
    nftId: 7n,
    startingBid: 100_000_000_000_000_000n,
    highestBid: 100_000_000_000_000_000n,
    highestBidder: ZERO,
    endAt: 0n,
    timeRemaining: 0n,
    myRefundable: 0n,
    isHighestBidder: false,
    isSeller: true,
    isLoading: false,
    error: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  validate.mockReturnValue(null);
  mocks.useStartAuction.mockImplementation(() => ({ validate, submit, tx: { status: 'idle' } }));
  mocks.useAuctionState.mockImplementation(() => auctionState());
});

describe('StartPanel — seller CTA / read-only state (matrix §3, US2)', () => {
  it('gives the seller a start CTA before the auction is live', () => {
    render(<StartPanel />);
    expect(screen.getByRole('button', { name: /start auction/i })).toBeEnabled();
    expect(screen.getByText(/escrow/i)).toBeInTheDocument();
  });

  it('shows a read-only waiting state to everyone else — no CTA', () => {
    mocks.useAuctionState.mockImplementation(() => auctionState({ isSeller: false }));
    render(<StartPanel />);
    expect(
      screen.queryByRole('button', { name: /start auction/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/waiting for the seller/i)).toBeInTheDocument();
    expect(screen.getByText(/0xf39F…2266/)).toBeInTheDocument();
  });

  it('shows the catalogue message without prompting the wallet when blocked', () => {
    validate.mockReturnValue('Auction already started');
    render(<StartPanel />);
    fireEvent.click(screen.getByRole('button', { name: /start auction/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Auction already started');
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits when validation passes', () => {
    render(<StartPanel />);
    fireEvent.click(screen.getByRole('button', { name: /start auction/i }));
    expect(validate).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables the start CTA while the escrow sequence is in flight', () => {
    mocks.useStartAuction.mockImplementation(() => ({
      validate,
      submit,
      tx: { status: 'awaiting_confirmation' },
    }));
    render(<StartPanel />);
    expect(screen.getByRole('button', { name: /start auction/i })).toBeDisabled();
  });

  it('renders nothing once the auction is live (panels are exclusive)', () => {
    mocks.useAuctionState.mockImplementation(() => auctionState({ phase: 'OPEN_FOR_BIDS' }));
    const { container } = render(<StartPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('StartPanel — US2 scenario 4: LIVE flip + countdown (reload-safe)', () => {
  it('trades the start CTA for the live countdown after start', () => {
    mocks.useAuctionState.mockImplementation(() => auctionState());
    const { rerender } = render(
      <>
        <AuctionPanel />
        <StartPanel />
      </>,
    );
    expect(screen.getByRole('button', { name: /start auction/i })).toBeInTheDocument();

    // start() confirmed → the read model re-derives from the contract
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ phase: 'OPEN_FOR_BIDS', timeRemaining: 604_800n, endAt: 123n }),
    );
    rerender(
      <>
        <AuctionPanel />
        <StartPanel />
      </>,
    );
    expect(
      screen.queryByRole('button', { name: /start auction/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('168:00:00')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-phase', 'OPEN_FOR_BIDS');
  });
});
