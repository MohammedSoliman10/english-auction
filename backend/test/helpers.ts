import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadConfig, type AppConfig } from '../src/config';

/** Deterministic env for unit tests: dead upstream port by default. */
export const TEST_ENV = {
  PORT: '0',
  ANVIL_URL: 'http://127.0.0.1:1',
  CHAIN_ID: '2026',
  CHAIN_NAME: 'English Auction Chain',
  NFT_ADDRESS: '0x00000000000000000000000000000000000000nft',
  AUCTION_ADDRESS: '0x00000000000000000000000000000000000000auc',
  DEPLOYED_AT: '2026-09-26T12:00:00.000Z',
  DEPLOY_BLOCK: '11793146',
} as unknown as NodeJS.ProcessEnv;

/** AppConfig built from TEST_ENV with per-test overrides. */
export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...loadConfig(TEST_ENV), ...overrides };
}

/** Minimal JSON-RPC-ish upstream stub; records every received body. */
export function startUpstream(): Promise<{
  server: http.Server;
  url: string;
  received: unknown[];
}> {
  const received: unknown[] = [];
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      received.push(JSON.parse(data));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0xabc' }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}`, received });
    });
  });
}
