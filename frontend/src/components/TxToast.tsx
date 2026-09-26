import { formatAddress } from '../lib/format';
import type { TxLifecycle } from '../lib/types';
import { MonoLabel } from './MonoLabel';

interface TxToastProps {
  tx: TxLifecycle;
}

const COPY: Record<TxLifecycle['status'], string> = {
  idle: '',
  awaiting_confirmation: 'CONFIRM IN YOUR WALLET…',
  pending: 'PENDING',
  success: 'CONFIRMED',
  rejected: 'REJECTED IN WALLET',
  reverted: 'TRANSACTION REVERTED',
};

/**
 * FR-010 write-transaction lifecycle toast:
 * awaiting → pending(hash) → success | reverted | rejected.
 * Achromatic: state conveyed by text, never colored fills.
 */
export function TxToast({ tx }: TxToastProps) {
  if (tx.status === 'idle') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-3 border border-surface-3 bg-surface-1 px-4 py-3 shadow-lg"
      data-testid="tx-toast"
    >
      <span
        aria-hidden="true"
        className="size-2 bg-white"
        style={{
          opacity: tx.status === 'pending' || tx.status === 'awaiting_confirmation' ? 1 : 0.5,
        }}
      />
      <div className="flex flex-col">
        <MonoLabel className="text-white">{COPY[tx.status]}</MonoLabel>
        {tx.hash ? (
          <span className="font-mono text-xs text-signal">{formatAddress(tx.hash)}</span>
        ) : null}
        {tx.message ? (
          <span className="max-w-64 font-mono text-xs text-paper">{tx.message}</span>
        ) : null}
      </div>
    </div>
  );
}
