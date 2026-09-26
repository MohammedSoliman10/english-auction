import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server';
import { startUpstream, testConfig } from './helpers';

describe('GET /api/health', () => {
  const closers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const close of closers.splice(0)) await close();
  });

  it('returns 200 degraded when chain is down', async () => {
    const app = createApp(testConfig());
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.chain).toBe('down');
    expect(typeof res.body.uptimeSec).toBe('number');
  });

  it('returns 200 ok when chain responds', async () => {
    const upstream = await startUpstream();
    closers.push(() => new Promise((r) => upstream.server.close(() => r())));
    const app = createApp(testConfig({ anvilUrl: upstream.url }));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', chain: 'up' });
  });
});
