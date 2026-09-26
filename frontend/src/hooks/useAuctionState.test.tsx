import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  useReadContracts: vi.fn(),
  useAccount: vi.fn(),
  useWatchContractEvent: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useReadContracts: (params: unknown) => mocks.useReadContracts(params),
  useAccount: () => mocks.useAccount(),
  useWatchContractEvent: (params: unknown) => mocks.useWatchContractEvent(params),
}));

import { useAuctionState, READ_INDEX } from './useAuctionState';
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

const SELLER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const BIDDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;
const NFT = CONFIG.nftAddress;

const BASE_TIME = Date.UTC(2026, 8, 26, 12, 0, 0); // fixed "now"
const BASE_SEC = BASE_TIME / 1000;

interface RawOverrides {
  started?: boolean;
  ended?: boolean;
  endAt?: bigint;
  highestBid?: bigint;
  highestBidder?: string;
  seller?: string;
  startingBid?: bigint;
  nftId?: bigint;
  bids?: bigint;
}

/** Build the useReadContracts result array in READ_INDEX order. */
function rawData(o: RawOverrides = {}) {
  const data: unknown[] = [];
  data[READ_INDEX.started] = o.started ?? false;
  data[READ_INDEX.ended] = o.ended ?? false;
  data[READ_INDEX.endAt] = o.endAt ?? 0n;
  data[READ_INDEX.highestBid] = o.highestBid ?? 100_000_000_000_000_000n;
  data[READ_INDEX.highestBidder] = o.highestBidder ?? '0x0000000000000000000000000000000000000000';
  data[READ_INDEX.seller] = o.seller ?? SELLER;
  data[READ_INDEX.startingBid] = o.startingBid ?? 100_000_000_000_000_000n;
  data[READ_INDEX.nft] = NFT;
  data[READ_INDEX.nftId] = o.nftId ?? 1n;
  data[READ_INDEX.bids] = o.bids ?? 0n;
  return data;
}

function readResult(o: RawOverrides = {}, extra: Record<string, unknown> = {}) {
  return { data: rawData(o), isLoading: false, error: null, refetch: vi.fn(), ...extra };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <RuntimeConfigContext.Provider value={CONFIG}>{children}</RuntimeConfigContext.Provider>
);

function renderState() {
  return renderHook(() => useAuctionState(), { wrapper });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE_TIME);
  mocks.useAccount.mockReturnValue({ address: undefined, isConnected: false });
  mocks.useReadContracts.mockImplementation(() => readResult());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAuctionState — phase derivation (data-model §1)', () => {
  it('derives NOT_STARTED when start() never ran', () => {
    mocks.useReadContracts.mockImplementation(() => readResult({ started: false }));
    const { result } = renderState();
    expect(result.current.phase).toBe('NOT_STARTED');
  });

  it('derives OPEN_FOR_BIDS while live and now < endAt', () => {
    mocks.useReadContracts.mockImplementation(() =>
      readResult({ started: true, endAt: BigInt(BASE_SEC + 3600) }),
    );
    const { result } = renderState();
    expect(result.current.phase).toBe('OPEN_FOR_BIDS');
  });

  it('derives AWAITING_SETTLEMENT at endAt without settlement', () => {
    vi.setSystemTime((BASE_SEC + 3600) * 1000);
    mocks.useReadContracts.mockImplementation(() =>
      readResult({ started: true, endAt: BigInt(BASE_SEC + 3600) }),
    );
    const { result } = renderState();
    expect(result.current.phase).toBe('AWAITING_SETTLEMENT');
  });

  it('derives SETTLED once end() completed — wins over clock', () => {
    vi.setSystemTime((BASE_SEC + 3600) * 1000);
    mocks.useReadContracts.mockImplementation(() =>
      readResult({ started: true, ended: true, endAt: BigInt(BASE_SEC + 3600) }),
    );
    const { result } = renderState();
    expect(result.current.phase).toBe('SETTLED');
  });
});

describe('useAuctionState — derived values (FR-002, R5 #8)', () => {
  it('reads startingBid from the immutable getter — not from highestBid', () => {
    mocks.useReadContracts.mockImplementation(() =>
      readResult({
        started: true,
        endAt: BigInt(BASE_SEC + 3600),
        startingBid: 100_000_000_000_000_000n, // 0.1
        highestBid: 5_000_000_000_000_000_000n, // 5.0 after bidding
      }),
    );
    const { result } = renderState();
    expect(result.current.startingBid).toBe(100_000_000_000_000_000n);
    expect(result.current.highestBid).toBe(5_000_000_000_000_000_000n);
  });

  it('startingBid stays identical across refetches with different highestBid', () => {
    const start = 100_000_000_000_000_000n;
    mocks.useReadContracts.mockImplementation(() =>
      readResult({ started: true, endAt: BigInt(BASE_SEC + 3600), startingBid: start }),
    );
    const { result, rerender } = renderState();
    const first = result.current.startingBid;
    mocks.useReadContracts.mockImplementation(() =>
      readResult({
        started: true,
        endAt: BigInt(BASE_SEC + 3600),
        startingBid: start,
        highestBid: 9_000_000_000_000_000_000n,
      }),
    );
    rerender();
    expect(result.current.startingBid).toBe(first);
  });

  it('timeRemaining = max(0, endAt − now) and ticks down every second', () => {
    mocks.useReadContracts.mockImplementation(() =>
      readResult({ started: true, endAt: BigInt(BASE_SEC + 3600) }),
    );
    const { result } = renderState();
    expect(result.current.timeRemaining).toBe(3600n);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.timeRemaining).toBe(3595n);
  });

  it('timeRemaining clamps at zero after endAt', () => {
    vi.setSystemTime((BASE_SEC + 7200) * 1000);
    mocks.useReadContracts.mockImplementation(() =>
      readResult({ started: true, endAt: BigInt(BASE_SEC + 3600) }),
    );
    const { result } = renderState();
    expect(result.current.timeRemaining).toBe(0n);
  });

  it('exposes myRefundable + isHighestBidder + isSeller for the account', () => {
    mocks.useAccount.mockReturnValue({ address: BIDDER, isConnected: true });
    mocks.useReadContracts.mockImplementation(() =>
      readResult({
        started: true,
        endAt: BigInt(BASE_SEC + 3600),
        highestBidder: BIDDER,
        bids: 123n,
      }),
    );
    const { result } = renderState();
    expect(result.current.myRefundable).toBe(123n);
    expect(result.current.isHighestBidder).toBe(true);
    expect(result.current.isSeller).toBe(false);

    mocks.useAccount.mockReturnValue({ address: SELLER, isConnected: true });
    mocks.useReadContracts.mockImplementation(() =>
      readResult({ started: true, endAt: BigInt(BASE_SEC + 3600), seller: SELLER }),
    );
    const { result: r2 } = renderState();
    expect(r2.current.isSeller).toBe(true);
    expect(r2.current.isHighestBidder).toBe(false);
  });

  it('zeroes account-scoped values when no wallet is connected', () => {
    mocks.useReadContracts.mockImplementation(() =>
      readResult({ started: true, endAt: BigInt(BASE_SEC + 3600), bids: 777n }),
    );
    const { result } = renderState();
    expect(result.current.myRefundable).toBe(0n);
    expect(result.current.isHighestBidder).toBe(false);
    expect(result.current.isSeller).toBe(false);
  });
});

describe('useAuctionState — loading / error (data-model §1)', () => {
  it('reports isLoading while reads are in flight', () => {
    mocks.useReadContracts.mockImplementation(() =>
      readResult({}, { isLoading: true, data: undefined }),
    );
    const { result } = renderState();
    expect(result.current.isLoading).toBe(true);
  });

  it('maps RPC failures to chain_unreachable — never a raw error', () => {
    mocks.useReadContracts.mockImplementation(() =>
      readResult({}, { error: new TypeError('Failed to fetch') }),
    );
    const { result } = renderState();
    expect(result.current.error).toBe('chain_unreachable');
  });

  it('has no error once reads succeed', () => {
    const { result } = renderState();
    expect(result.current.error).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useAuctionState — read wiring (FR-002: mount + poll + event)', () => {
  interface ReadParams {
    contracts: Array<{ functionName: string; address: string; args?: readonly unknown[] }>;
    allowFailure?: boolean;
    query?: { refetchInterval?: number };
  }

  function readParams(): ReadParams {
    return mocks.useReadContracts.mock.calls[0][0] as ReadParams;
  }

  it('maps every READ_INDEX slot onto its auction getter (§2)', () => {
    renderState();
    const { contracts } = readParams();
    expect(contracts[READ_INDEX.started]?.functionName).toBe('started');
    expect(contracts[READ_INDEX.ended]?.functionName).toBe('ended');
    expect(contracts[READ_INDEX.endAt]?.functionName).toBe('endAt');
    expect(contracts[READ_INDEX.highestBid]?.functionName).toBe('highestBid');
    expect(contracts[READ_INDEX.highestBidder]?.functionName).toBe('highestBidder');
    expect(contracts[READ_INDEX.seller]?.functionName).toBe('seller');
    expect(contracts[READ_INDEX.startingBid]?.functionName).toBe('startingBid');
    expect(contracts[READ_INDEX.nft]?.functionName).toBe('nft');
    expect(contracts[READ_INDEX.nftId]?.functionName).toBe('nftId');
    expect(contracts[READ_INDEX.bids]?.functionName).toBe('bids');
    expect(contracts).toHaveLength(10);
    for (const c of contracts) expect(c.address).toBe(CONFIG.auctionAddress);
  });

  it('reads flat results (allowFailure: false) so failures map to one error state', () => {
    renderState();
    expect(readParams().allowFailure).toBe(false);
  });

  it('polls the read (refetchInterval configured)', () => {
    renderState();
    expect(readParams().query?.refetchInterval).toBeGreaterThan(0);
  });

  it('re-fetches when an auction event arrives (FR-002: on event)', () => {
    const refetch = vi.fn();
    mocks.useReadContracts.mockImplementation(() => readResult({}, { refetch }));
    renderState();

    expect(mocks.useWatchContractEvent).toHaveBeenCalledTimes(1);
    const watch = mocks.useWatchContractEvent.mock.calls[0][0] as {
      address: string;
      onLogs: (logs: unknown[]) => void;
    };
    expect(watch.address).toBe(CONFIG.auctionAddress);
    expect(typeof watch.onLogs).toBe('function');

    act(() => {
      watch.onLogs([]);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
