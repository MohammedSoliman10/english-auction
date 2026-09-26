import path from 'node:path';
import { rename } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server';
import { testConfig } from './helpers';

/**
 * T066 — static SPA + JSON 404 + body-limit coverage (contracts/backend-api.md
 * §4/§5). Characterization tests over already-shipped middleware (documented
 * test-first protocol exception); they close the constitution III line/branch
 * gaps on `server.ts`.
 */
describe('static SPA + history fallback', () => {
  const distIndex = path.resolve(process.cwd(), '../frontend/dist/index.html');
  const parked = `${distIndex}.bak-test`;

  afterEach(async () => {
    // restore index.html if the missing-build test failed mid-flight
    await rename(parked, distIndex).catch(() => undefined);
  });

  it('serves index.html for unknown SPA routes (history fallback)', async () => {
    const app = createApp(testConfig());
    const res = await request(app).get('/some/deep/route');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('<div id="root"');
  });

  it('falls through to the JSON 404 when the SPA is not built', async () => {
    await rename(distIndex, parked);
    try {
      const app = createApp(testConfig());
      const res = await request(app).get('/some/deep/route');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: 'not_found', path: '/some/deep/route' });
    } finally {
      await rename(parked, distIndex);
    }
  });
});

describe('JSON 404 for API-ish misses (backend-api.md §5)', () => {
  it('returns JSON 404 for unknown API paths', async () => {
    const app = createApp(testConfig());
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found', path: '/api/nope' });
  });

  it('returns JSON 404 for non-GET page methods', async () => {
    const app = createApp(testConfig());
    const res = await request(app).post('/somewhere');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found', path: '/somewhere' });
  });

  it('returns JSON 404 for /rpc-prefixed misses (fallback branch)', async () => {
    const app = createApp(testConfig());
    const res = await request(app).get('/rpc-foo');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found', path: '/rpc-foo' });
  });
});

describe('JSON error middleware (backend-api.md §5)', () => {
  it('returns 413 payload_too_large over the 256kb limit', async () => {
    const app = createApp(testConfig());
    const res = await request(app)
      .post('/rpc')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(300_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('payload_too_large');
  });

  it('passes other body-parser failures to express (next(err) → 415)', async () => {
    const app = createApp(testConfig());
    const res = await request(app)
      .post('/rpc')
      .set('Content-Type', 'application/json; charset=big5')
      .send('{"jsonrpc":"2.0","id":1,"method":"eth_chainId"}');
    // unsupported charset is not an entity.* failure → next(err) reaches the
    // default express handler, which honors err.status (415 unsupported).
    expect(res.status).toBe(415);
  });
});
