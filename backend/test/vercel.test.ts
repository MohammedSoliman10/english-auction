import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import healthHandler from '../../api/health';
import rpcHandler from '../../api/index';
import configHandler from '../../api/config';
import { loadConfig } from '../src/config';
import { createVercelHandler, rebasePath } from '../src/vercel';
import { startUpstream, TEST_ENV, testConfig } from './helpers';

/**
 * T069/T070 deploy layer — Vercel serverless functions (backend-api.md §4).
 *
 * Each `/api/*.ts` function owns ONE route and rebase-paths the incoming
 * request before handing it to the shared Express app, so the handler works
 * whether the platform delivers the original URL or the rewrite target
 * (no assumption about vercel.json rewrite URL semantics). Characterization
 * over createApp (already tested) + the rebase glue that is new here.
 */

/** Minimal IncomingMessage stand-in with a writable url. */
function reqAt(url: string): IncomingMessage {
  return { url } as IncomingMessage;
}

describe('rebasePath (rewrite-semantics hardening)', () => {
  it('forces the function-owned route when the platform passes another path', () => {
    const req = reqAt('/api/index');
    rebasePath(req, '/rpc');
    expect(req.url).toBe('/rpc');
  });

  it('preserves the query string (GET /rpc?data= through a rewrite)', () => {
    const req = reqAt('/api/index?data=%7B%22id%22%3A1%7D');
    rebasePath(req, '/rpc');
    expect(req.url).toBe('/rpc?data=%7B%22id%22%3A1%7D');
  });

  it('is idempotent when the path already matches', () => {
    const req = reqAt('/rpc?data=x');
    rebasePath(req, '/rpc');
    expect(req.url).toBe('/rpc?data=x');
  });

  it('routes config/health functions to their own endpoints', () => {
    const cfg = reqAt('/api/index');
    rebasePath(cfg, '/api/config');
    expect(cfg.url).toBe('/api/config');
    const health = reqAt('/somewhere');
    rebasePath(health, '/api/health');
    expect(health.url).toBe('/api/health');
  });

  it('defaults a missing url to the owned route', () => {
    const req = { } as IncomingMessage;
    rebasePath(req, '/rpc');
    expect(req.url).toBe('/rpc');
  });
});

describe('serverless handlers over the shared Express app', () => {
  it('config handler returns 200 with the runtime addresses', async () => {
    const handler = createVercelHandler('/api/config', testConfig());
    const res = await request(handler).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.chainId).toBe(2026);
    expect(res.body.rpcUrl).toBe('/rpc');
    expect(res.body.nftAddress).toBe(TEST_ENV.NFT_ADDRESS);
  });

  it('config handler 503 not_deployed when addresses are missing', async () => {
    const notDeployed = loadConfig({ ...TEST_ENV, AUCTION_ADDRESS: '', NFT_ADDRESS: '' });
    const handler = createVercelHandler('/api/config', notDeployed);
    const res = await request(handler).get('/whatever/path');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('not_deployed');
  });

  it('rpc handler forwards JSON-RPC from ANY incoming path (rebased)', async () => {
    const upstream = await startUpstream();
    try {
      const handler = createVercelHandler('/rpc', testConfig({ anvilUrl: upstream.url }));
      const res = await request(handler)
        .post('/api/index')
        .send({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] });
      expect(res.status).toBe(200);
      expect(upstream.received.length).toBe(1);
      expect(upstream.received[0]).toMatchObject({ method: 'eth_chainId' });
    } finally {
      await new Promise((r) => upstream.server.close(() => r()));
    }
  });

  it('rpc handler keeps GET ?data= working through a rewrite target', async () => {
    const upstream = await startUpstream();
    try {
      const handler = createVercelHandler('/rpc', testConfig({ anvilUrl: upstream.url }));
      const data = encodeURIComponent(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_blockNumber' }));
      const res = await request(handler).get(`/api/index?data=${data}`);
      expect(res.status).toBe(200);
      expect(upstream.received.length).toBe(1);
    } finally {
      await new Promise((r) => upstream.server.close(() => r()));
    }
  });

  it('health handler reports degraded against a dead chain', async () => {
    const handler = createVercelHandler('/api/health', testConfig());
    const res = await request(handler).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'degraded', chain: 'down' });
    expect(typeof res.body.uptimeSec).toBe('number');
  });
});

describe('api/ entry modules (Vercel function files)', () => {
  it('each module default-exports a request handler function', () => {
    expect(typeof configHandler).toBe('function');
    expect(typeof healthHandler).toBe('function');
    expect(typeof rpcHandler).toBe('function');
  });
});
