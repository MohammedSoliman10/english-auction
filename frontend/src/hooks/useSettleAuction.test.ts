import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../lib/config', () => ({
  useRuntimeConfig: () => ({
    chainId: 2026,
    chainName: 'English Auction Chain',
    rpcUrl: '/rpc',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    auctionAddress: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
    nftAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
    deployedAt: '2026-09-26T12:00:00.000Z',
  }),
}));

import { useSettleAuction } from './useSettleAuction';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import {
  ALREADY_SETTLED_MESSAGE,
  NOT_CONNECTED_MESSAGE,
  REVERT_MESSAGES,
  wrongNetworkMessage,
} from '../lib/errors';

const AUCTION = '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0' as const;
const ACCOUNT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;
const HASH = '0xabc123abc123abc123abc123abc123abc123abc1' as const;

const REJECTED_NEUTRAL_NOTICE = 'Transaction rejected in wallet — no changes were made.';

function auctionState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'AWAITING_SETTLEMENT',
    myRefundable: 0n,
    isLoading: false,
    error: undefined,
    ...overrides,
  };
}

function mockWallet({ connected = true, chainId = 2026 } = {}) {
  mocks.useAccount.mockReturnValue({
    address: connected ? ACCOUNT : undefined,
    isConnected: connected,
  });
  mocks.useChainId.mockReturnValue(chainId);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useWriteContract.mockResolvedValue(HASH);
  mocks.useWaitForTransactionReceipt.mockReturnValue({
    data: undefined,
    isError: false,
    error: null,
  });
  mocks.useAuctionState.mockImplementation(() => auctionState());
  mockWallet();
});

describe('useSettleAuction.validate — US4 scenarios 3–4 (FR-004)', () => {
  it('blocks a disconnected user', () => {
    mockWallet({ connected: false });
    const { result } = renderHook(() => useSettleAuction());
    expect(result.current.validate()).toBe(NOT_CONNECTED_MESSAGE);
  });

  it('blocks the wrong network with the catalogue message', () => {
    mockWallet({ chainId: 1 });
    const { result } = renderHook(() => useSettleAuction());
    expect(result.current.validate()).toBe(wrongNetworkMessage('English Auction Chain'));
  });

  it('blocks settle before start (not started)', () => {
    mocks.useAuctionState.mockImplementation(() => auctionState({ phase: 'NOT_STARTED' }));
    const { result } = renderHook(() => useSettleAuction());
    expect(result.current.validate()).toBe(REVERT_MESSAGES['not started']);
  });

  it('blocks settle before endAt — "still in progress" (scenario 3)', async () => {
    mocks.useAuctionState.mockImplementation(() => auctionState({ phase: 'OPEN_FOR_BIDS' }));
    const { result } = renderHook(() => useSettleAuction());
    expect(result.current.validate()).toBe(REVERT_MESSAGES['not ended']);

    // no empty wallet prompt when blocked
    await act(async () => {
      await result.current.submit();
    });
    expect(mocks.useWriteContract).not.toHaveBeenCalled();
  });

  it('blocks a second settle once already ended (scenario 4)', () => {
    mocks.useAuctionState.mockImplementation(() => auctionState({ phase: 'SETTLED' }));
    const { result } = renderHook(() => useSettleAuction());
    expect(result.current.validate()).toBe(ALREADY_SETTLED_MESSAGE);
  });

  it('passes in AWAITING_SETTLEMENT (the settle window)', () => {
    const { result } = renderHook(() => useSettleAuction());
    expect(result.current.validate()).toBeNull();
  });
});

describe('useSettleAuction.submit — write + lifecycle', () => {
  it('calls end() on the auction contract without value', async () => {
    const { result } = renderHook(() => useSettleAuction());

    await act(async () => {
      await result.current.submit();
    });

    expect(mocks.useWriteContract).toHaveBeenCalledTimes(1);
    expect(mocks.useWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AUCTION,
        abi: EnglishAuctionAbi,
        functionName: 'end',
      }),
    );
    expect((mocks.useWriteContract.mock.calls[0][0] as { value?: unknown }).value).toBeUndefined();
  });

  it('walks to SUCCESS on the receipt (phase matrix AWAITING_SETTLEMENT → SETTLED)', async () => {
    const { result, rerender } = renderHook(() => useSettleAuction());

    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.tx.status).toBe('pending');

    mocks.useWaitForTransactionReceipt.mockReturnValue({
      data: { status: 'success', transactionHash: HASH },
      isError: false,
      error: null,
    });
    rerender();

    expect(result.current.tx.status).toBe('success');
  });

  it('maps wallet rejection to the neutral notice; no retry', async () => {
    mocks.useWriteContract.mockRejectedValue(
      Object.assign(new Error('User rejected the request.'), { code: 4001 }),
    );
    const { result } = renderHook(() => useSettleAuction());

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.tx.status).toBe('rejected');
    expect(result.current.tx.message).toBe(REJECTED_NEUTRAL_NOTICE);
    expect(result.current.tx.hash).toBeUndefined();
    expect(mocks.useWriteContract).toHaveBeenCalledTimes(1);
  });
});
