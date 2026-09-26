import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AppConfig } from './config';

/** Upstream read timeout for /rpc forwarding (ms). */
export const RPC_FORWARD_TIMEOUT_MS = 5_000;
/** Health probe timeout for eth_chainId (ms). */
export const HEALTH_PROBE_TIMEOUT_MS = 1_000;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Probe the upstream chain with eth_chainId.
 * Resolves true when the node answers 2xx within the timeout, false otherwise.
 */
export async function probeChain(anvilUrl: string): Promise<boolean> {
  try {
    const res = await fetch(anvilUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(HEALTH_PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function forwardJsonRpc(
  res: Response,
  config: AppConfig,
  payload: unknown,
): Promise<void> {
  try {
    const upstream = await fetch(config.anvilUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(RPC_FORWARD_TIMEOUT_MS),
    });
    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch (err) {
    res.status(502).json({
      error: 'chain_unreachable',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * /rpc router — CORS + GET/POST JSON-RPC passthrough to the localhost-bound node.
 * Body is re-serialized (semantically verbatim) and responses pass through untouched.
 */
export function createRpcProxy(config: AppConfig): Router {
  const router = Router();

  // CORS for wallet-extension origins + preflight handling.
  router.use((req: Request, res: Response, next: NextFunction) => {
    for (const [key, value] of Object.entries(CORS_HEADERS)) res.setHeader(key, value);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  router.post('/', (req: Request, res: Response) => {
    // express.json already parsed; strict mode limits bodies to objects/arrays.
    void forwardJsonRpc(res, config, req.body);
  });

  router.get('/', (req: Request, res: Response) => {
    const raw = req.query.data;
    if (typeof raw !== 'string') {
      res.status(400).json({ error: 'invalid_json', message: 'missing ?data= parameter' });
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      res.status(400).json({ error: 'invalid_json', message: 'unparseable ?data= JSON' });
      return;
    }
    void forwardJsonRpc(res, config, payload);
  });

  return router;
}
