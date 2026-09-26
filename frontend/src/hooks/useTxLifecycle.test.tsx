import { act, render, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';

const mocks = vi.hoisted(() => ({
  writeContractAsync: vi.fn(),
  receipt: {
    data: undefined as
      | { status: 'success' | 'reverted'; transactionHash: `0x${string}` }
      | undefined,
    isError: false,
    error: null as unknown,
  },
}));

vi.mock('wagmi', () => ({
  useWriteContract: () => ({ writeContractAsync: mocks.writeContractAsync }),
  useWaitForTransactionReceipt: () => mocks.receipt,
}));

import { useTxLifecycle } from './useTxLifecycle';
import type { TxWriteParams } from './useTxLifecycle';
import { TxProvider, useTxStore } from '../app/TxProvider';
import type { TxLifecycle } from '../lib/types';

const HASH = '0x1234567890abcdef1234567890abcdef12345678' as const;

const PARAMS: TxWriteParams = {
  address: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
  abi: EnglishAuctionAbi,
  functionName: 'bid',
  value: 1_000_000_000_000_000n,
};

function freshReceipt() {
  mocks.receipt.data = undefined;
  mocks.receipt.isError = false;
  mocks.receipt.error = null;
}

beforeEach(() => {
  vi.clearAllMocks();
  freshReceipt();
});

describe('useTxLifecycle (data-model §6, FR-010)', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useTxLifecycle());
    expect(result.current.tx.status).toBe('idle');
    expect(result.current.tx.hash).toBeUndefined();
  });

  it('walks IDLE → AWAITING_CONFIRMATION → PENDING capturing the hash', async () => {
    const { result } = renderHook(() => useTxLifecycle());
    let resolveWrite!: (h: `0x${string}`) => void;
    mocks.writeContractAsync.mockImplementation(
      () => new Promise<`0x${string}`>((resolve) => (resolveWrite = resolve)),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.write(PARAMS);
    });
    expect(result.current.tx.status).toBe('awaiting_confirmation');

    await act(async () => {
      resolveWrite(HASH);
      await pending;
    });
    expect(result.current.tx.status).toBe('pending');
    expect(result.current.tx.hash).toBe(HASH);
  });

  it('walks PENDING → SUCCESS when the receipt confirms', async () => {
    const { result, rerender } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockResolvedValue(HASH);
    await act(async () => {
      await result.current.write(PARAMS);
    });

    mocks.receipt.data = { status: 'success', transactionHash: HASH };
    rerender();

    expect(result.current.tx.status).toBe('success');
    expect(result.current.tx.hash).toBe(HASH);
  });

  it('maps wallet rejection (4001) to REJECTED — neutral, no hash', async () => {
    const { result } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockRejectedValue(
      Object.assign(new Error('User rejected the request.'), { code: 4001 }),
    );
    await act(async () => {
      await result.current.write(PARAMS);
    });
    expect(result.current.tx.status).toBe('rejected');
    expect(result.current.tx.hash).toBeUndefined();
    expect(result.current.tx.message).toBeTruthy();
  });

  it('maps contract revert reasons to catalogue messages (FR-004)', async () => {
    const { result } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockRejectedValue(
      Object.assign(
        new Error('The contract function "bid" reverted with the following reason:'),
        { shortMessage: 'execution reverted: value < highest' },
      ),
    );
    await act(async () => {
      await result.current.write(PARAMS);
    });
    expect(result.current.tx.status).toBe('reverted');
    expect(result.current.tx.message).toBe('Bid must exceed current highest');
  });

  it('marks REVERTED when the mined receipt reports on-chain failure', async () => {
    const { result, rerender } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockResolvedValue(HASH);
    await act(async () => {
      await result.current.write(PARAMS);
    });

    mocks.receipt.data = { status: 'reverted', transactionHash: HASH };
    rerender();

    expect(result.current.tx.status).toBe('reverted');
    expect(result.current.tx.message).toBeTruthy();
  });

  it('ignores stale receipts from a previous hash', async () => {
    const { result, rerender } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockResolvedValue(HASH);
    await act(async () => {
      await result.current.write(PARAMS);
    });

    // receipt belongs to a different (older) hash — must not flip state
    mocks.receipt.data = {
      status: 'success',
      transactionHash: '0x9999999999999999999999999999999999999999',
    };
    rerender();
    expect(result.current.tx.status).toBe('pending');

    mocks.receipt.data = { status: 'success', transactionHash: HASH };
    rerender();
    expect(result.current.tx.status).toBe('success');
  });

  it('reset() returns to idle', async () => {
    const { result } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockResolvedValue(HASH);
    await act(async () => {
      await result.current.write(PARAMS);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.tx.status).toBe('idle');
    expect(result.current.tx.hash).toBeUndefined();
  });

  // --- coverage completion for the error-text branches (existing behavior) ---

  it('maps a receipt-wait failure to REVERTED with catalogue text', async () => {
    const { result, rerender } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockResolvedValue(HASH);
    await act(async () => {
      await result.current.write(PARAMS);
    });

    mocks.receipt.isError = true;
    mocks.receipt.error = new Error('execution reverted: not ended');
    rerender();

    expect(result.current.tx.status).toBe('reverted');
    expect(result.current.tx.message).toBe('Auction is still in progress');
  });

  it('maps an error carrying only details (viem transport shape)', async () => {
    const { result } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockRejectedValue({
      details: 'execution reverted: ended',
    });
    await act(async () => {
      await result.current.write(PARAMS);
    });
    expect(result.current.tx.status).toBe('reverted');
    expect(result.current.tx.message).toBe('Auction ended — no more bids');
  });

  it('falls back to a generic message for a non-object cause', async () => {
    const { result } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockRejectedValue(42);
    await act(async () => {
      await result.current.write(PARAMS);
    });
    expect(result.current.tx.status).toBe('reverted');
    expect(result.current.tx.message).toBeTruthy();
  });

  it('recognises viem UserRejectedRequestError by name', async () => {
    const { result } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockRejectedValue({
      name: 'UserRejectedRequestError',
      message: 'User rejected the request.',
    });
    await act(async () => {
      await result.current.write(PARAMS);
    });
    expect(result.current.tx.status).toBe('rejected');
  });

  it('recognises rejection by message text (wallet connector fallback)', async () => {
    const { result } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockRejectedValue({
      message: 'User denied transaction signature.',
    });
    await act(async () => {
      await result.current.write(PARAMS);
    });
    expect(result.current.tx.status).toBe('rejected');
  });

  it('recognises ACTION_REJECTED codes from WalletConnect', async () => {
    const { result } = renderHook(() => useTxLifecycle());
    mocks.writeContractAsync.mockRejectedValue({
      code: 'ACTION_REJECTED',
      message: 'Request rejected',
    });
    await act(async () => {
      await result.current.write(PARAMS);
    });
    expect(result.current.tx.status).toBe('rejected');
  });
});

describe('useTxLifecycle ↔ global TxProvider (FR-010 mount, T037)', () => {
  let published: TxLifecycle | null = null;

  function Capture() {
    const store = useTxStore();
    published = store ? store.tx : null;
    return null;
  }

  const storeWrapper = ({ children }: { children: ReactNode }) => (
    <TxProvider>
      <Capture />
      {children}
    </TxProvider>
  );

  beforeEach(() => {
    published = null;
  });

  it('publishes lifecycle transitions to the store (standalone hooks unaffected)', async () => {
    const { result } = renderHook(() => useTxLifecycle(), { wrapper: storeWrapper });
    expect(published).toEqual({ status: 'idle' });

    mocks.writeContractAsync.mockRejectedValue(
      Object.assign(new Error('User rejected the request.'), { code: 4001 }),
    );
    await act(async () => {
      await result.current.write(PARAMS);
    });

    expect(published?.status).toBe('rejected');
    expect(published?.message).toBe('Transaction rejected in wallet — no changes were made.');
  });

  it('propagates reset() back to idle in the store', async () => {
    const { result } = renderHook(() => useTxLifecycle(), { wrapper: storeWrapper });
    mocks.writeContractAsync.mockRejectedValue({ code: 4001 });
    await act(async () => {
      await result.current.write(PARAMS);
    });
    expect(published?.status).toBe('rejected');

    act(() => {
      result.current.reset();
    });
    expect(published?.status).toBe('idle');
  });

  it('a newly mounted hook does not wipe a live toast with its initial idle (quickstart V3)', async () => {
    let api: ReturnType<typeof useTxLifecycle> | null = null;
    function Probe() {
      api = useTxLifecycle();
      return null;
    }
    // ONE tree — the panel swap happens inside the same provider (App root).
    const view = render(
      <TxProvider>
        <Capture />
        <Probe />
      </TxProvider>,
    );
    mocks.writeContractAsync.mockRejectedValue({ code: 4001 });
    await act(async () => {
      await api?.write(PARAMS);
    });
    expect(published?.status).toBe('rejected');

    // panel swap at the phase flip: writing panel out…
    view.rerender(
      <TxProvider>
        <Capture />
        <span />
      </TxProvider>,
    );
    // …fresh hook mounts in
    view.rerender(
      <TxProvider>
        <Capture />
        <Probe />
      </TxProvider>,
    );
    expect(published?.status).toBe('rejected'); // store keeps the finished toast
  });

  it('a surviving mounted hook completes a pending store tx after the writing panel unmounts', async () => {
    let api: ReturnType<typeof useTxLifecycle> | null = null;
    function Writer() {
      api = useTxLifecycle();
      return null;
    }
    function Survivor() {
      api = useTxLifecycle();
      return null;
    }
    const view = render(
      <TxProvider>
        <Capture />
        <Writer />
      </TxProvider>,
    );
    mocks.writeContractAsync.mockResolvedValue(HASH);
    await act(async () => {
      await api?.write(PARAMS);
    });
    expect(published?.status).toBe('pending');

    // start() still in flight when the phase flips away: writer unmounts…
    view.rerender(
      <TxProvider>
        <Capture />
        <span />
      </TxProvider>,
    );
    expect(published?.status).toBe('pending');

    // …a surviving mounted instance picks the lifecycle up (mount = no clobber)
    view.rerender(
      <TxProvider>
        <Capture />
        <Survivor />
      </TxProvider>,
    );
    expect(published?.status).toBe('pending');

    mocks.receipt.data = { status: 'success', transactionHash: HASH };
    act(() => {
      view.rerender(
        <TxProvider>
          <Capture />
          <Survivor />
        </TxProvider>,
      );
    });
    expect(published?.status).toBe('success');
  });
});
