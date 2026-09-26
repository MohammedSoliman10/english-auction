import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server';
import { loadConfig } from '../src/config';
import { TEST_ENV, testConfig } from './helpers';

describe('GET /api/config', () => {
  it('returns the full runtime config (contracts/backend-api.md §2)', async () => {
    const app = createApp(testConfig());
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      chainId: 2026,
      chainName: 'English Auction Chain',
      rpcUrl: '/rpc',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      auctionAddress: TEST_ENV.AUCTION_ADDRESS,
      nftAddress: TEST_ENV.NFT_ADDRESS,
      deployedAt: '2026-09-26T12:00:00.000Z',
    });
  });

  it('returns 503 not_deployed when addresses are missing', async () => {
    const app = createApp(loadConfig({ ...TEST_ENV, AUCTION_ADDRESS: '', NFT_ADDRESS: '' }));
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('not_deployed');
    expect(res.body.message).toMatch(/deploy\.sh/);
  });
});
