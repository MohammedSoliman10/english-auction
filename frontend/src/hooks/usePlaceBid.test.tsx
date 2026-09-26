import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  useAccount: vi.fn(),
  useChainId: vi.fn(),
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
  useAuctionState: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => mocks.useAccount(),
  useChainId: () => mocks.useChainId(),
  useWriteContract: () => ({ writeContractAsync: mocks.useWriteContract }),
  useWaitForTransactionReceipt: () => mocks.useWaitForTransactionReceipt(),
}));

vi.mock('./useAuctionState', () => ({
  useAuctionState: () => mocks.useAuctionState(),
}));

import { usePlaceBid } from './usePlaceBid';
import { RuntimeConfigContext } from '../lib/config';
import type { RuntimeConfig } from '../lib/types';

const CONFIG: RuntimeConfig = {
  chainId: 2026,
  chainName: 'English Auction Chain',
  rpcUrl: '/rpc',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  auctionAddress: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
  nftAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
  deployedAt: '2026-09-26T12:00:00.000Z',
};

const ACCOUNT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;
const HIGH = 1_000_000_000_000_000_000n; // 1.0 ETH current highest
const HASH = '0x1234567890abcdef1234567890abcdef12345678' as const;

function auctionState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'OPEN_FOR_BIDS',
    startingBid: 100_000_000_000_000_000n,
    highestBid: HIGH,
    timeRemaining: 3600n,
    myRefundable: 0n,
    isHighestBidder: false,
    isSeller: false,
    isLoading: false,
    error: undefined,
    ...overrides,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <RuntimeConfigContext.Provider value={CONFIG}>{children}</RuntimeConfigContext.Provider>
);

function renderBid() {
  return renderHook(() => usePlaceBid(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAccount.mockReturnValue({ address: ACCOUNT, isConnected: true });
  mocks.useChainId.mockReturnValue(CONFIG.chainId);
  mocks.useAuctionState.mockImplementation(() => auctionState());
  mocks.useWaitForTransactionReceipt.mockReturnValue({
    data: undefined,
    isError: false,
    error: null,
  });
  mocks.useWriteContract.mockResolvedValue(HASH);
});

describe('usePlaceBid — validate() pre-wallet guards (FR-004, matrix §3)', () => {
  it('returns null when the bid is valid', () => {
    const { result } = renderBid();
    expect(result.current.validate(HIGH + 1n)).toBeNull();
  });

  it('rejects when no wallet is connected', () => {
    mocks.useAccount.mockReturnValue({ address: undefined, isConnected: false });
    const { result } = renderBid();
    expect(result.current.validate(HIGH + 1n)).toMatch(/connect/i);
  });

  it('rejects on the wrong network', () => {
    mocks.useChainId.mockReturnValue(1);
    const { result } = renderBid();
    expect(result.current.validate(HIGH + 1n)).toMatch(/network/i);
  });

  it('rejects before the auction started (catalogue message)', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ phase: 'NOT_STARTED' }),
    );
    const { result } = renderBid();
    expect(result.current.validate(HIGH + 1n)).toBe('Auction has not started yet');
  });

  it('rejects after bidding closed (catalogue message)', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ phase: 'AWAITING_SETTLEMENT' }),
    );
    const { result } = renderBid();
    expect(result.current.validate(HIGH + 1n)).toBe('Auction ended — no more bids');
  });

  it('rejects after settlement (catalogue message)', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ phase: 'SETTLED' }),
    );
    const { result } = renderBid();
    expect(result.current.validate(HIGH + 1n)).toBe('Auction ended — no more bids');
  });

  it('rejects a bid at or below the current highest', () => {
    const { result } = renderBid();
    expect(result.current.validate(HIGH)).toBe('Bid must exceed current highest');
    expect(result.current.validate(HIGH - 1n)).toBe('Bid must exceed current highest');
  });
});

describe('usePlaceBid — submit() guard + write (FR-003, data-model §6)', () => {
  it('never prompts the wallet when validation fails', async () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ phase: 'NOT_STARTED' }),
    );
    const { result } = renderBid();

    await act(async () => {
      result.current.submit(HIGH + 1n);
    });

    expect(mocks.useWriteContract).not.toHaveBeenCalled();
    // data-model §6: the tx edge reads "user action (validated)" — a blocked
    // bid never enters the state machine. The catalogue message is surfaced
    // inline by the form via validate() instead (matrix §3).
    expect(result.current.tx.status).toBe('idle');
    expect(result.current.validate(HIGH + 1n)).toBe('Auction has not started yet');
  });

  it('writes bid() with value = amount when valid', async () => {
    const { result } = renderBid();

    await act(async () => {
      result.current.submit(HIGH + 1n);
    });

    expect(mocks.useWriteContract).toHaveBeenCalledWith({
      address: CONFIG.auctionAddress,
      abi: expect.any(Array),
      functionName: 'bid',
      value: HIGH + 1n,
    });
    expect(result.current.tx.status).toBe('pending');
    expect(result.current.tx.hash).toBe(HASH);
  });

  it('surfaces tx lifecycle states from useTxLifecycle', async () => {
    mocks.useWriteContract.mockRejectedValue(
      Object.assign(new Error('rejected'), { code: 4001 }),
    );
    const { result } = renderBid();

    await act(async () => {
      result.current.submit(HIGH + 1n);
    });

    expect(result.current.tx.status).toBe('rejected');
  });
});
