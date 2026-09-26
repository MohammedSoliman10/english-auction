import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccount, useConnect, useSwitchChain } from 'wagmi';

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useConnect: vi.fn(),
  useSwitchChain: vi.fn(),
}));

import { Header } from './Header';
import { RuntimeConfigContext } from '../lib/config';
import type { RuntimeConfig } from '../lib/types';

const CONFIG: RuntimeConfig = {
  chainId: 2026,
  chainName: 'English Auction Chain',
  rpcUrl: '/rpc',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  auctionAddress: '0x00000000000000000000000000000000000000a1',
  nftAddress: '0x00000000000000000000000000000000000000b2',
  deployedAt: '2026-09-26T12:00:00.000Z',
};

const connect = vi.fn();
const switchChainAsync = vi.fn();

function mockWallet({ connected, chainId }: { connected: boolean; chainId: number }) {
  vi.mocked(useAccount).mockReturnValue({
    address: connected ? '0x1234567890abcdef1234567890abcdef12345678' : undefined,
    isConnected: connected,
    // Real wagmi: the WALLET's chain rides on the account/connection state.
    chainId: connected ? chainId : undefined,
  } as never);
  vi.mocked(useConnect).mockReturnValue({
    connect,
    connectors: [{ uid: 'injected' }] as never,
    isPending: false,
  } as never);
  vi.mocked(useSwitchChain).mockReturnValue({ switchChainAsync } as never);
}

function renderHeader() {
  return render(
    <RuntimeConfigContext.Provider value={CONFIG}>
      <Header />
    </RuntimeConfigContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  switchChainAsync.mockResolvedValue({ id: 2026 });
  delete (window as { ethereum?: unknown }).ethereum;
});

describe('Header — wallet connect (FR-001)', () => {
  it('offers a connect button when disconnected and connects on click', () => {
    mockWallet({ connected: false, chainId: 2026 });
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    expect(connect).toHaveBeenCalledWith({
      connector: expect.objectContaining({ uid: 'injected' }),
    });
  });

  it('shows shortened address + network badge when connected on the auction chain', () => {
    mockWallet({ connected: true, chainId: 2026 });
    renderHeader();
    expect(screen.getByText('0x1234…5678')).toBeInTheDocument();
    expect(screen.getByText(CONFIG.chainName)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /switch/i })).not.toBeInTheDocument();
  });
});

describe('Header — guided network switch (FR-001, V1)', () => {
  it('reads the wallet network from useAccount — not the app-selected chain', () => {
    // Real wagmi contract: useChainId() tracks the app-selected chain (the
    // config default, 2026), while the wallet's ACTUAL chain arrives via
    // useAccount().chainId. Detection must use the latter, or a wallet on
    // mainnet would silently look connected to the auction chain (V1).
    mockWallet({ connected: true, chainId: 2026 });
    vi.mocked(useAccount).mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConnected: true,
      chainId: 1, // wallet is on Ethereum mainnet
    } as never);

    renderHeader();
    expect(screen.getByText(/wrong network/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch/i })).toBeInTheDocument();
  });

  it('auto-prompts a switch to chainId 2026 exactly once on wrong network', async () => {
    mockWallet({ connected: true, chainId: 1 });
    renderHeader();
    await waitFor(() =>
      expect(switchChainAsync).toHaveBeenCalledWith({ chainId: 2026 }),
    );
    expect(switchChainAsync).toHaveBeenCalledTimes(1);
    // effect must not re-prompt on re-render
    fireEvent.click(screen.getByRole('button', { name: /switch/i }));
    expect(switchChainAsync).toHaveBeenCalledTimes(2);
  });

  it('surfaces a wrong-network badge and a manual switch button', () => {
    mockWallet({ connected: true, chainId: 1 });
    renderHeader();
    expect(screen.getByText(/wrong network/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch/i })).toBeInTheDocument();
  });

  it('falls back to wallet_addEthereumChain when the wallet reports code 4902', async () => {
    mockWallet({ connected: true, chainId: 1 });
    switchChainAsync.mockRejectedValue(
      Object.assign(new Error('Unrecognized chain'), { code: 4902 }),
    );
    const request = vi.fn().mockResolvedValue(null);
    Object.defineProperty(window, 'ethereum', {
      value: { request },
      configurable: true,
    });

    renderHeader();

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith({
        method: 'wallet_addEthereumChain',
        params: [
          expect.objectContaining({
            chainId: '0x7ea', // 2026
            chainName: 'English Auction Chain',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [expect.stringMatching(/\/rpc$/)],
          }),
        ],
      }),
    );
  });

  it('reports a declined switch instead of failing silently (4001)', async () => {
    mockWallet({ connected: true, chainId: 1 });
    switchChainAsync.mockRejectedValue(
      Object.assign(new Error('User rejected'), { code: 4001 }),
    );
    renderHeader();
    await waitFor(() =>
      expect(screen.getByText(/declined/i)).toBeInTheDocument(),
    );
  });
});
