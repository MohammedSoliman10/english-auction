import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppConfig } from './config';
import { createApp } from './server';

/**
 * Vercel serverless glue (contracts/backend-api.md §4, T069/T070 deploy).
 *
 * Each function file under `/api` owns exactly one endpoint. Before the
 * shared Express app sees the request, `rebasePath` forces that endpoint's
 * path (keeping the query string) — so the handler behaves identically
 * whether the platform delivers the ORIGINAL request URL or the REWRITE
 * TARGET (`/rpc` → `/api/index`), without depending on unverified rewrite
 * semantics. The Express app is built once per cold start.
 */

/** Force `req.url` to `route`, preserving any query string. Idempotent. */
export function rebasePath(req: IncomingMessage, route: string): void {
  const raw = req.url ?? '/';
  const q = raw.indexOf('?');
  const search = q === -1 ? '' : raw.slice(q);
  const path = q === -1 ? raw : raw.slice(0, q);
  if (path !== route) req.url = `${route}${search}`;
}

/** Path-agnostic handler that serves one fixed route of the Express app. */
export function createVercelHandler(
  route: string,
  config?: AppConfig,
): (req: IncomingMessage, res: ServerResponse) => void {
  const app = createApp(config);
  return (req: IncomingMessage, res: ServerResponse): void => {
    rebasePath(req, route);
    void app(req, res);
  };
}
