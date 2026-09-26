import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAccount: vi.fn(),
  useChainId: vi.fn(),
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
  useReadContract: vi.fn(),
  useAuctionState: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => mocks.useAccount(),
  useChainId: () => mocks.useChainId(),
  useWriteContract: () => ({ writeContractAsync: mocks.useWriteContract }),
  useWaitForTransactionReceipt: () => mocks.useWaitForTransactionReceipt(),
  useReadContract: (params: unknown) => mocks.useReadContract(params),
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

import { useStartAuction } from './useStartAuction';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import {
  NOT_CONNECTED_MESSAGE,
  NOT_OWNER_MESSAGE,
  REVERT_MESSAGES,
  wrongNetworkMessage,
} from '../lib/errors';

const AUCTION = '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0' as const;
const SELLER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const NFT = '0x5fbdb2315678afecb367f032d93f642f64180aa3' as const;
const OTHER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;

function auctionState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'NOT_STARTED',
    seller: SELLER,
    nft: NFT,
    nftId: 7n,
    isSeller: true,
    isLoading: false,
    error: undefined,
    ...overrides,
  };
}

function ownerRead(overrides: Record<string, unknown> = {}) {
  return { data: SELLER, isError: false, isLoading: false, refetch: vi.fn(), ...overrides };
}

function mockWallet({ connected, chainId }: { connected: boolean; chainId: number }) {
  mocks.useAccount.mockReturnValue({
    address: connected ? SELLER : undefined,
    isConnected: connected,
    chainId: connected ? chainId : undefined,
  });
  mocks.useChainId.mockReturnValue(chainId);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useWriteContract.mockResolvedValue('0xhash');
  mocks.useWaitForTransactionReceipt.mockReturnValue({
    data: undefined,
    isError: false,
    error: null,
  });
  mocks.useAuctionState.mockImplementation(() => auctionState());
  mocks.useReadContract.mockReturnValue(ownerRead());
  mockWallet({ connected: true, chainId: 2026 });
});

describe('useStartAuction.validate — FR-004 pre-wallet guards (US2 scenarios 2–3)', () => {
  it('blocks a disconnected user', () => {
    mockWallet({ connected: false, chainId: 2026 });
    const { result } = renderHook(() => useStartAuction());
    expect(result.current.validate()).toBe(NOT_CONNECTED_MESSAGE);
  });

  it('blocks the wrong network', () => {
    mockWallet({ connected: true, chainId: 1 });
    const { result } = renderHook(() => useStartAuction());
    expect(result.current.validate()).toBe(wrongNetworkMessage('English Auction Chain'));
  });

  it('blocks a double start with the catalogue message (contract guard order)', () => {
    for (const phase of ['OPEN_FOR_BIDS', 'AWAITING_SETTLEMENT', 'SETTLED']) {
      mocks.useAuctionState.mockImplementation(() => auctionState({ phase }));
      const { result, unmount } = renderHook(() => useStartAuction());
      expect(result.current.validate()).toBe(REVERT_MESSAGES.started);
      unmount();
    }
  });

  it('blocks a non-seller with the catalogue message', () => {
    mocks.useAuctionState.mockImplementation(() => auctionState({ isSeller: false }));
    const { result } = renderHook(() => useStartAuction());
    expect(result.current.validate()).toBe(REVERT_MESSAGES['not seller']);
  });

  it('passes for the seller before start', () => {
    const { result } = renderHook(() => useStartAuction());
    expect(result.current.validate()).toBeNull();
  });

  it('blocks the escrow when the seller no longer owns the NFT (spec §7 prerequisite)', async () => {
    mocks.useReadContract.mockReturnValue(ownerRead({ data: OTHER }));
    const { result } = renderHook(() => useStartAuction());
    expect(result.current.validate()).toBe(NOT_OWNER_MESSAGE);
    await act(async () => {
      await result.current.submit();
    });
    expect(mocks.useWriteContract).not.toHaveBeenCalled();
  });

  it('blocks when the NFT ownership cannot be read (missing prerequisite)', () => {
    mocks.useReadContract.mockReturnValue(ownerRead({ data: undefined, isError: true }));
    const { result } = renderHook(() => useStartAuction());
    expect(result.current.validate()).toBe(NOT_OWNER_MESSAGE);
  });
});

describe('useStartAuction.submit — sequences ERC-721 approve → start (T043 escrow step)', () => {
  it('opens the wallet for approve() first, then fires start() once mined', async () => {
    mocks.useWriteContract
      .mockResolvedValueOnce('0xapprove1111')
      .mockResolvedValueOnce('0xstart2222');
    const { result, rerender } = renderHook(() => useStartAuction());

    await act(async () => {
      await result.current.submit();
    });

    // Step 1: ERC-721 approval for the auction contract (idempotent).
    expect(mocks.useWriteContract).toHaveBeenCalledTimes(1);
    expect(mocks.useWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: NFT,
        functionName: 'approve',
        args: [AUCTION, 7n],
      }),
    );
    expect(result.current.tx.status).toBe('pending');

    // Approval mined → Step 2: escrow via start().
    mocks.useWaitForTransactionReceipt.mockReturnValue({
      data: { status: 'success', transactionHash: '0xapprove1111' },
      isError: false,
      error: null,
    });
    rerender();

    expect(mocks.useWriteContract).toHaveBeenCalledTimes(2);
    expect(mocks.useWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        address: AUCTION,
        abi: EnglishAuctionAbi,
        functionName: 'start',
      }),
    );
  });

  it('stops the sequence when the approval is rejected', async () => {
    mocks.useWriteContract.mockRejectedValue(
      Object.assign(new Error('User rejected the request.'), { code: 4001 }),
    );
    const { result, rerender } = renderHook(() => useStartAuction());

    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.tx.status).toBe('rejected');

    mocks.useWaitForTransactionReceipt.mockReturnValue({
      data: undefined,
      isError: false,
      error: null,
    });
    rerender();
    expect(mocks.useWriteContract).toHaveBeenCalledTimes(1);
  });

  it('never prompts the wallet when validation fails', async () => {
    mocks.useAuctionState.mockImplementation(() => auctionState({ isSeller: false }));
    const { result } = renderHook(() => useStartAuction());
    await act(async () => {
      await result.current.submit();
    });
    expect(mocks.useWriteContract).not.toHaveBeenCalled();
    expect(result.current.tx.status).toBe('idle');
  });

  it('starts idle (data-model §6)', () => {
    const { result } = renderHook(() => useStartAuction());
    expect(result.current.tx.status).toBe('idle');
  });
});
