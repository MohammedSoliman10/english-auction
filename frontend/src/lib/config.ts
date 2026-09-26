import { createContext, useContext } from 'react';
import type { RuntimeConfig } from './types';

/** Runtime config provided to the tree by <Providers> after boot fetch. */
export const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

/** Access boot config; throws when used outside <Providers>. */
export function useRuntimeConfig(): RuntimeConfig {
  const config = useContext(RuntimeConfigContext);
  if (!config) {
    throw new Error('useRuntimeConfig must be used inside <Providers>');
  }
  return config;
}

/**
 * Boot fetch (FR-015 / contract §6): GET /api/config.
 * Throws an actionable Error for 503 (not deployed), other statuses, or
 * network failure — callers render the connection-error state, never blank.
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  let res: Response;
  try {
    res = await fetch('/api/config');
  } catch {
    throw new Error('Cannot reach the server — check that the backend is running, then reload.');
  }

  if (res.status === 503) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Contracts not deployed — run scripts/deploy.sh first.');
  }
  if (!res.ok) {
    throw new Error(`Unexpected config response (HTTP ${res.status}) — try again shortly.`);
  }
  return (await res.json()) as RuntimeConfig;
}
