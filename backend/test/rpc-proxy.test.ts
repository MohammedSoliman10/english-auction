import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server';
import { startUpstream, testConfig } from './helpers';

describe('POST/GET /rpc proxy', () => {
  let upstream: Awaited<ReturnType<typeof startUpstream>>;

  beforeEach(async () => {
    upstream = await startUpstream();
  });
  afterEach(async () => {
    await new Promise((r) => upstream.server.close(() => r()));
  });

  it('forwards JSON-RPC body verbatim and passes the response through', async () => {
    const app = createApp(testConfig({ anvilUrl: upstream.url }));
    const payload = { jsonrpc: '2.0', id: 7, method: 'eth_blockNumber', params: [] };
    const res = await request(app).post('/rpc').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ jsonrpc: '2.0', id: 1, result: '0xabc' });
    expect(upstream.received).toEqual([payload]);
  });

  it('forwards batch arrays as-is', async () => {
    const app = createApp(testConfig({ anvilUrl: upstream.url }));
    const batch = [
      { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] },
      { jsonrpc: '2.0', id: 2, method: 'eth_blockNumber', params: [] },
    ];
    const res = await request(app).post('/rpc').send(batch);
    expect(res.status).toBe(200);
    expect(upstream.received).toEqual([batch]);
  });

  it('supports GET /rpc?data=<urlencoded json>', async () => {
    const app = createApp(testConfig({ anvilUrl: upstream.url }));
    const payload = { jsonrpc: '2.0', id: 3, method: 'eth_chainId', params: [] };
    const res = await request(app).get('/rpc').query({ data: JSON.stringify(payload) });
    expect(res.status).toBe(200);
    expect(upstream.received).toEqual([payload]);
  });

  it('returns 400 invalid_json for unparseable bodies', async () => {
    const app = createApp(testConfig({ anvilUrl: upstream.url }));
    const res = await request(app)
      .post('/rpc')
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_json');
    expect(upstream.received).toEqual([]);
  });

  it('returns 400 invalid_json for unparseable GET data', async () => {
    const app = createApp(testConfig({ anvilUrl: upstream.url }));
    const res = await request(app).get('/rpc').query({ data: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_json');
  });

  it('returns 502 chain_unreachable when the node is down', async () => {
    const app = createApp(testConfig({ anvilUrl: 'http://127.0.0.1:1' }));
    const res = await request(app)
      .post('/rpc')
      .send({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('chain_unreachable');
  });

  it('answers CORS preflight for wallet-extension origins', async () => {
    const app = createApp(testConfig({ anvilUrl: upstream.url }));
    const res = await request(app).options('/rpc');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
    expect(res.headers['access-control-allow-headers']).toMatch(/Content-Type/i);
  });
});
