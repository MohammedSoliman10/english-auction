import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, type Hex } from 'viem';

const mocks = vi.hoisted(() => ({
  usePublicClient: vi.fn(),
  useWatchContractEvent: vi.fn(),
}));

vi.mock('wagmi', () => ({
  usePublicClient: (params: unknown) => mocks.usePublicClient(params),
  useWatchContractEvent: (params: unknown) => mocks.useWatchContractEvent(params),
}));

vi.mock('../lib/config', () => ({
  useRuntimeConfig: () => ({
    chainId: 2026,
    auctionAddress: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
  }),
}));

import { useActivityLog } from './useActivityLog';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';

const AUCTION = '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0' as const;
const BIDDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;
const TX = `0x${'11'.repeat(32)}` as Hex;

/** blockNumber → timestamp (seconds). */
const BLOCK_TIME: Record<string, bigint> = {
  '100': 1_790_000_000n,
  '102': 1_790_000_120n,
  '103': 1_790_000_240n,
  '104': 1_790_000_360n,
};

type LogKind = 'Start' | 'Bid' | 'Withdraw' | 'End';

function makeLog(kind: LogKind, blockNumber: bigint, logIndex: number, amount?: bigint) {
  const base = { address: AUCTION, blockNumber, logIndex, transactionHash: TX, removed: false };
  if (kind === 'Start') {
    return { ...base, topics: encodeEventTopics({ abi: EnglishAuctionAbi, eventName: 'Start' }), data: '0x' as Hex };
  }
  if (kind === 'Bid') {
    return {
      ...base,
      topics: encodeEventTopics({ abi: EnglishAuctionAbi, eventName: 'Bid', args: { sender: BIDDER } }),
      data: encodeAbiParameters([{ type: 'uint256' }], [amount ?? 0n]),
    };
  }
  if (kind === 'Withdraw') {
    return {
      ...base,
      topics: encodeEventTopics({ abi: EnglishAuctionAbi, eventName: 'Withdraw', args: { bidder: BIDDER } }),
      data: encodeAbiParameters([{ type: 'uint256' }], [amount ?? 0n]),
    };
  }
  // End carries no indexed args.
  const topic0 = encodeEventTopics({ abi: EnglishAuctionAbi, eventName: 'End' })[0];
  return {
    ...base,
    topics: [topic0],
    data: encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [BIDDER, amount ?? 0n],
    ),
  };
}

function mockChain(logs: unknown[]) {
  const getLogs = vi.fn().mockResolvedValue(logs);
  const getBlock = vi.fn(({ blockNumber }: { blockNumber: bigint }) =>
    Promise.resolve({ timestamp: BLOCK_TIME[String(blockNumber)] ?? 0n }),
  );
  mocks.usePublicClient.mockReturnValue({ getLogs, getBlock });
  return { getLogs, getBlock };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useWatchContractEvent.mockReturnValue(undefined);
});

describe('useActivityLog — FR-009 fetch + decode + newest-first', () => {
  it('decodes all four kinds ordered newest-first with actor/amount/time', async () => {
    const { getLogs, getBlock } = mockChain([
      makeLog('Bid', 102n, 0, 1_500_000_000_000_000_000n),
      makeLog('Start', 100n, 0),
      makeLog('End', 104n, 0, 1_500_000_000_000_000_000n),
      makeLog('Withdraw', 103n, 0, 500_000_000_000_000_000n),
    ]);

    const { result } = renderHook(() => useActivityLog());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getLogs).toHaveBeenCalledWith({
      address: AUCTION,
      fromBlock: 0n,
      toBlock: 'latest',
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.entries.map((e) => e.kind)).toEqual([
      'End',
      'Withdraw',
      'Bid',
      'Start',
    ]);

    const withdraw = result.current.entries[1];
    expect(withdraw.actor).toBe(BIDDER);
    expect(withdraw.amount).toBe(500_000_000_000_000_000n);
    expect(withdraw.time).toBe(1_790_000_240n);
    expect(withdraw.id).toBe('103-0');

    const start = result.current.entries[3];
    expect(start.actor).toBeUndefined();
    expect(start.amount).toBeUndefined();
    expect(start.time).toBe(1_790_000_000n);

    expect(getBlock).toHaveBeenCalledTimes(4);
  });

  it('breaks same-block ties by log index (descending)', async () => {
    mockChain([
      makeLog('Bid', 102n, 0, 100n),
      makeLog('Bid', 102n, 1, 200n),
    ]);

    const { result } = renderHook(() => useActivityLog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.entries.map((e) => e.id)).toEqual(['102-1', '102-0']);
    expect(result.current.entries[0].amount).toBe(200n);
  });

  it('reloads when an auction event lands (event → re-read)', async () => {
    const { getLogs } = mockChain([makeLog('Start', 100n, 0)]);

    renderHook(() => useActivityLog());
    await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

    const watcher = mocks.useWatchContractEvent.mock.calls[0][0] as {
      onLogs: (logs: unknown[]) => void;
    };
    act(() => watcher.onLogs([]));
    await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));
  });
});

describe('useActivityLog — failure states (data-model §1)', () => {
  it('collapses a failed log fetch to chain_unreachable', async () => {
    mocks.usePublicClient.mockReturnValue({
      getLogs: vi.fn().mockRejectedValue(new Error('boom')),
      getBlock: vi.fn(),
    });

    const { result } = renderHook(() => useActivityLog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('chain_unreachable');
    expect(result.current.entries).toEqual([]);
  });

  it('reports chain_unreachable when no client is configured', async () => {
    mocks.usePublicClient.mockReturnValue(undefined);

    const { result } = renderHook(() => useActivityLog());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('chain_unreachable');
  });
});
