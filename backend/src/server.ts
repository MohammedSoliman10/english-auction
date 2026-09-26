import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { isDeployed, loadConfig, type AppConfig } from './config';
import { createRpcProxy, probeChain } from './rpc-proxy';

/**
 * Application factory (contracts/backend-api.md).
 *
 * Serves:  /api/health, /api/config, /rpc (proxy to localhost-bound node),
 *          static SPA from frontend/dist with history fallback.
 * Fallback: /dev proxies Vite (:5173) against this server — identical routing.
 */
export function createApp(config: AppConfig = loadConfig()): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  // ── /rpc ────────────────────────────────────────────────────────────────
  app.use('/rpc', createRpcProxy(config));

  // ── /api/health ─────────────────────────────────────────────────────────
  app.get('/api/health', (_req: Request, res: Response) => {
    void probeChain(config.anvilUrl).then((up) => {
      res.json({
        status: up ? 'ok' : 'degraded',
        chain: up ? 'up' : 'down',
        uptimeSec: Math.floor(process.uptime()),
      });
    });
  });

  // ── /api/config ─────────────────────────────────────────────────────────
  app.get('/api/config', (_req: Request, res: Response) => {
    if (!isDeployed(config)) {
      res.status(503).json({
        error: 'not_deployed',
        message: 'Contract addresses missing — run scripts/deploy.sh first.',
      });
      return;
    }
    const { chainId, chainName, rpcUrl, nativeCurrency, auctionAddress, nftAddress, deployedAt } =
      config;
    res.json({ chainId, chainName, rpcUrl, nativeCurrency, auctionAddress, nftAddress, deployedAt });
  });

  // ── Static SPA + history fallback (skipped cleanly when not built yet) ──
  const distDir = path.resolve(__dirname, '../../frontend/dist');
  const indexHtml = path.join(distDir, 'index.html');
  app.use(express.static(distDir, { index: false }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/rpc')) {
      next();
      return;
    }
    res.sendFile(indexHtml, (err) => {
      if (err) next(); // no build yet → JSON 404 below
    });
  });

  // ── JSON 404 for API-ish misses and unbuilt SPA ─────────────────────────
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', path: req.path });
  });

  // ── JSON errors: body-parser failures (invalid_json, payload too large) ─
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const type = (err as { type?: string } | null)?.type;
    if (type === 'entity.parse.failed') {
      res.status(400).json({ error: 'invalid_json', message: 'request body is not valid JSON' });
      return;
    }
    if (type === 'entity.too.large') {
      res.status(413).json({ error: 'payload_too_large', message: 'body exceeds 256kb' });
      return;
    }
    next(err);
  });

  return app;
}

if (require.main === module) {
  const config = loadConfig();
  createApp(config).listen(config.port, () => {
    console.log(`backend listening on :${config.port}`);
  });
}
