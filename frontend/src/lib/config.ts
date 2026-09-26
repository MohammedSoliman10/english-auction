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

/** Which full-page ErrorState a boot failure maps to (spec edge cases). */
export type ConfigErrorKind = 'chain_unreachable' | 'not_deployed';

/** Boot failure tagged with its ErrorState kind (T065). */
export class ConfigLoadError extends Error {
  constructor(
    readonly kind: ConfigErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Boot fetch (FR-015 / contract §6): GET /api/config.
 * Throws an actionable ConfigLoadError for 503 (not deployed), other
 * statuses, or network failure — callers render the ErrorState, never blank.
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  let res: Response;
  try {
    res = await fetch('/api/config');
  } catch {
    throw new ConfigLoadError(
      'chain_unreachable',
      'Cannot reach the server — check that the backend is running, then reload.',
    );
  }

  if (res.status === 503) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ConfigLoadError(
      'not_deployed',
      body.message ?? 'Contracts not deployed — run scripts/deploy.sh first.',
    );
  }
  if (!res.ok) {
    throw new ConfigLoadError(
      'chain_unreachable',
      `Unexpected config response (HTTP ${res.status}) — try again shortly.`,
    );
  }
  return (await res.json()) as RuntimeConfig;
}
