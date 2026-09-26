import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAccount: vi.fn(),
  useChainId: vi.fn(),
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => mocks.useAccount(),
  useChainId: () => mocks.useChainId(),
  useWriteContract: () => ({ writeContractAsync: mocks.useWriteContract }),
  useWaitForTransactionReceipt: () => mocks.useWaitForTransactionReceipt(),
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

import { useMintNft } from './useMintNft';
import { SolimanWeb3Abi } from '../lib/abi/SolimanWeb3';
import {
  EMPTY_URI_MESSAGE,
  INVALID_URI_MESSAGE,
  NOT_CONNECTED_MESSAGE,
  wrongNetworkMessage,
} from '../lib/errors';

const NFT = '0x5fbdb2315678afecb367f032d93f642f64180aa3' as const;
const ACCOUNT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;
const HASH = '0xabc123abc123abc123abc123abc123abc123abc1' as const;

const REJECTED_NEUTRAL_NOTICE = 'Transaction rejected in wallet — no changes were made.';

const VALID_URIS = [
  'https://example.com/meta.json',
  'http://example.com/meta.json',
  'ipfs://bafybeigdyrztzt',
  'data:application/json;base64,eyJ7In0=',
];

const IDLE_RECEIPT = { data: undefined, isError: false, error: null };

/** Receipt carrying a single mint Transfer log for the given token id. */
function transferReceipt(tokenId: bigint) {
  return {
    data: {
      status: 'success',
      transactionHash: HASH,
      logs: [
        {
          address: NFT,
          topics: [
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
            `0x${'0'.repeat(64)}`,
            `0x${'00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8'}`,
            `0x${tokenId.toString(16).padStart(64, '0')}`,
          ],
          data: '0x',
        },
      ],
    },
    isError: false,
    error: null,
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
  mocks.useWaitForTransactionReceipt.mockReturnValue(IDLE_RECEIPT);
  mockWallet();
});

describe('useMintNft.validate — US5 scenario 2 (warn before gas) + wallet guards', () => {
  it('blocks a disconnected user', () => {
    mockWallet({ connected: false });
    const { result } = renderHook(() => useMintNft());
    expect(result.current.validate(VALID_URIS[0])).toBe(NOT_CONNECTED_MESSAGE);
  });

  it('blocks the wrong network with the catalogue message', () => {
    mockWallet({ chainId: 1 });
    const { result } = renderHook(() => useMintNft());
    expect(result.current.validate(VALID_URIS[0])).toBe(
      wrongNetworkMessage('English Auction Chain'),
    );
  });

  it('blocks an empty or whitespace-only URI', () => {
    const { result } = renderHook(() => useMintNft());
    expect(result.current.validate('')).toBe(EMPTY_URI_MESSAGE);
    expect(result.current.validate('   ')).toBe(EMPTY_URI_MESSAGE);
  });

  it('warns on an obviously invalid URI before any wallet prompt (scenario 2)', () => {
    const { result } = renderHook(() => useMintNft());
    for (const bad of ['banana.json', 'ftp://host/meta.json', 'www.example.com/m.json']) {
      expect(result.current.validate(bad)).toBe(INVALID_URI_MESSAGE);
    }
  });

  it('accepts the four valid schemes', () => {
    const { result } = renderHook(() => useMintNft());
    for (const uri of VALID_URIS) {
      expect(result.current.validate(uri)).toBeNull();
    }
  });
});

describe('useMintNft.submit — write + lifecycle + FR-008 token id', () => {
  it('calls mintNFT() on the NFT contract with the trimmed URI, no value', async () => {
    const { result } = renderHook(() => useMintNft());

    await act(async () => {
      result.current.submit('  https://example.com/meta.json  ');
    });

    expect(mocks.useWriteContract).toHaveBeenCalledTimes(1);
    expect(mocks.useWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: NFT,
        abi: SolimanWeb3Abi,
        functionName: 'mintNFT',
        args: ['https://example.com/meta.json'],
      }),
    );
    expect(
      (mocks.useWriteContract.mock.calls[0][0] as { value?: unknown }).value,
    ).toBeUndefined();
  });

  it('never prompts the wallet for an invalid URI', async () => {
    const { result } = renderHook(() => useMintNft());

    await act(async () => {
      result.current.submit('banana.json');
    });

    expect(mocks.useWriteContract).not.toHaveBeenCalled();
    expect(result.current.tx.status).toBe('idle');
  });

  it('surfaces the minted token id from the receipt (FR-008, scenario 1)', async () => {
    mocks.useWaitForTransactionReceipt.mockReturnValue(transferReceipt(7n));
    const { result, rerender } = renderHook(() => useMintNft());

    await act(async () => {
      result.current.submit(VALID_URIS[0]);
    });
    rerender();

    expect(result.current.tx.status).toBe('success');
    expect(result.current.mintedTokenId).toBe(7n);
  });

  it('keeps mintedTokenId null while idle and after a wallet rejection', async () => {
    const { result } = renderHook(() => useMintNft());
    expect(result.current.mintedTokenId).toBeNull();

    mocks.useWriteContract.mockRejectedValue(
      Object.assign(new Error('User rejected the request.'), { code: 4001 }),
    );
    await act(async () => {
      result.current.submit(VALID_URIS[0]);
    });

    expect(result.current.tx.status).toBe('rejected');
    expect(result.current.tx.message).toBe(REJECTED_NEUTRAL_NOTICE);
    expect(result.current.mintedTokenId).toBeNull();
  });
});
