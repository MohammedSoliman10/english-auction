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

import { useWithdrawFunds } from './useWithdrawFunds';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import {
  NOT_CONNECTED_MESSAGE,
  NOTHING_TO_WITHDRAW_MESSAGE,
  wrongNetworkMessage,
} from '../lib/errors';

const AUCTION = '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0' as const;
const ACCOUNT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;
const HASH = '0xabc123abc123abc123abc123abc123abc123abc1' as const;

const REJECTED_NEUTRAL_NOTICE = 'Transaction rejected in wallet — no changes were made.';

function auctionState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'OPEN_FOR_BIDS',
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

describe('useWithdrawFunds.validate — US3 scenarios 2–3 (FR-004)', () => {
  it('blocks a disconnected user', () => {
    mockWallet({ connected: false });
    const { result } = renderHook(() => useWithdrawFunds());
    expect(result.current.validate()).toBe(NOT_CONNECTED_MESSAGE);
  });

  it('blocks the wrong network with the catalogue message', () => {
    mockWallet({ chainId: 1 });
    const { result } = renderHook(() => useWithdrawFunds());
    expect(result.current.validate()).toBe(wrongNetworkMessage('English Auction Chain'));
  });

  it('blocks a zero claim with "Nothing to withdraw" — no empty wallet prompt', async () => {
    const { result } = renderHook(() => useWithdrawFunds());
    expect(result.current.validate()).toBe(NOTHING_TO_WITHDRAW_MESSAGE);

    await act(async () => {
      await result.current.submit();
    });
    expect(mocks.useWriteContract).not.toHaveBeenCalled();
  });

  it('passes when the claim is positive (outbid credit)', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ myRefundable: 500_000_000_000_000_000n }),
    );
    const { result } = renderHook(() => useWithdrawFunds());
    expect(result.current.validate()).toBeNull();
  });
});

describe('useWithdrawFunds.submit — write + lifecycle (US3 scenarios 1, 3)', () => {
  it('calls withdraw() on the auction contract without value', async () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ myRefundable: 500_000_000_000_000_000n }),
    );
    const { result } = renderHook(() => useWithdrawFunds());

    await act(async () => {
      await result.current.submit();
    });

    expect(mocks.useWriteContract).toHaveBeenCalledTimes(1);
    expect(mocks.useWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AUCTION,
        abi: EnglishAuctionAbi,
        functionName: 'withdraw',
      }),
    );
    expect((mocks.useWriteContract.mock.calls[0][0] as { value?: unknown }).value).toBeUndefined();
  });

  it('walks to SUCCESS on the receipt (scenario 1 — readout resets via re-read)', async () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ myRefundable: 500_000_000_000_000_000n }),
    );
    const { result, rerender } = renderHook(() => useWithdrawFunds());

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

  it('maps wallet rejection to the neutral notice; balance untouched (scenario 3)', async () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ myRefundable: 500_000_000_000_000_000n }),
    );
    mocks.useWriteContract.mockRejectedValue(
      Object.assign(new Error('User rejected the request.'), { code: 4001 }),
    );
    const { result } = renderHook(() => useWithdrawFunds());

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.tx.status).toBe('rejected');
    expect(result.current.tx.message).toBe(REJECTED_NEUTRAL_NOTICE);
    expect(result.current.tx.hash).toBeUndefined();
    // one attempt, no automatic retry — the claim stays claimable on-chain
    expect(mocks.useWriteContract).toHaveBeenCalledTimes(1);
  });
});
