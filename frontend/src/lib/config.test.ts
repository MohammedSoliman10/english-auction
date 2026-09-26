import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRuntimeConfig } from './config';

const PAYLOAD = {
  chainId: 2026,
  chainName: 'English Auction Chain',
  rpcUrl: '/rpc',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  auctionAddress: '0x00000000000000000000000000000000000000a1',
  nftAddress: '0x00000000000000000000000000000000000000b2',
  deployedAt: '2026-09-26T12:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadRuntimeConfig (FR-015 boot)', () => {
  it('fetches /api/config and returns the parsed runtime config', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => PAYLOAD,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadRuntimeConfig()).resolves.toEqual(PAYLOAD);
    expect(fetchMock).toHaveBeenCalledWith('/api/config');
  });

  it('throws a not-deployed error on 503 (deploy.sh hint)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'not_deployed', message: 'run scripts/deploy.sh first.' }),
      }),
    );
    await expect(loadRuntimeConfig()).rejects.toThrow(/deploy\.sh/);
  });

  it('throws on unexpected server errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );
    await expect(loadRuntimeConfig()).rejects.toThrow();
  });

  it('throws when the server is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    await expect(loadRuntimeConfig()).rejects.toThrow();
  });
});
