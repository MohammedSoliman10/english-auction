import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { TxLifecycle } from '../lib/types';

interface TxStoreValue {
  /** Current global lifecycle (FR-010 surface for the mounted <TxToast>). */
  tx: TxLifecycle;
  /** Publish a lifecycle state from any mounted write hook. Stable identity. */
  publish: (next: TxLifecycle) => void;
  /** Return the store to idle (toast dismissal). Stable identity. */
  reset: () => void;
}

/**
 * Global transaction store (contract §1 — single <TxToast> node).
 *
 * `publish` is memoized once so write hooks can subscribe with a plain
 * effect (`[publish, tx]`) without ever looping: republishing the same
 * `TxLifecycle` object is a no-op (Object.is) inside React.
 *
 * The context is optional by design — `useTxLifecycle` works standalone
 * (unit tests without a provider) and only reports when a provider exists.
 */
const TxStoreContext = createContext<TxStoreValue | null>(null);

export function TxProvider({ children }: { children: ReactNode }) {
  const [tx, setTx] = useState<TxLifecycle>({ status: 'idle' });

  const publish = useCallback((next: TxLifecycle) => setTx(next), []);
  const reset = useCallback(() => setTx({ status: 'idle' }), []);
  const value = useMemo(() => ({ tx, publish, reset }), [tx, publish, reset]);

  return <TxStoreContext.Provider value={value}>{children}</TxStoreContext.Provider>;
}

/** Store handle, or `null` when rendered outside a <TxProvider>. */
export function useTxStore(): TxStoreValue | null {
  return useContext(TxStoreContext);
}
