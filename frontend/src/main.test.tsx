import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from './main';

const CONFIG = {
  chainId: 2026,
  chainName: 'English Auction Chain',
  rpcUrl: '/rpc',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  auctionAddress: '0x00000000000000000000000000000000000000a1',
  nftAddress: '0x00000000000000000000000000000000000000b2',
  deployedAt: '2026-09-26T12:00:00.000Z',
};

function freshRoot(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('boot sequence (FR-015, contract §6)', () => {
  it('renders the app chrome once /api/config succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => CONFIG }),
    );
    const root = freshRoot();
    await act(async () => {
      await renderApp(root);
    });
    expect(screen.getByText('ENGLISH AUCTION.')).toBeInTheDocument();
  });

  it('shows an actionable alert — never a blank page — when not deployed (503)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'not_deployed', message: 'run scripts/deploy.sh first.' }),
      }),
    );
    const root = freshRoot();
    await act(async () => {
      await renderApp(root);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/deploy\.sh/);
    expect(screen.getByText('not deployed')).toBeInTheDocument(); // ErrorState kind label
  });

  it('shows a server-unreachable alert when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const root = freshRoot();
    await act(async () => {
      await renderApp(root);
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('connection error')).toBeInTheDocument(); // ErrorState kind label
  });

  it('is a no-op when the mount point is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => CONFIG }),
    );
    await expect(renderApp(null)).resolves.toBeUndefined();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
