import { useState } from 'react';
import { MonoLabel } from '../components/MonoLabel';
import { useAuctionState } from '../hooks/useAuctionState';
import { useSettleAuction } from '../hooks/useSettleAuction';

/**
 * Settlement action (contract §1, matrix §3 AWAITING_SETTLEMENT row — US4).
 *
 * Renders only while the clock has passed `endAt` and the auction is not yet
 * ended — panels are mutually exclusive by phase (FR-004). Settlement is
 * permissionless ("anyone" per frontend-ui.md §1): no seller gate. Blocked
 * attempts (scenario 3: still in progress / scenario 4: already settled) are
 * caught by validate() before any wallet prompt and surface inline.
 */
export function SettlePanel() {
  const { phase, isLoading } = useAuctionState();
  const { validate, submit, tx } = useSettleAuction();
  const [message, setMessage] = useState<string | null>(null);

  if (phase !== 'AWAITING_SETTLEMENT') return null;

  const inFlight = tx.status === 'awaiting_confirmation' || tx.status === 'pending';

  function onClick() {
    const problem = validate();
    setMessage(problem);
    if (problem === null) submit();
  }

  return (
    <section
      aria-label="settle auction"
      className="flex flex-col gap-4 border border-surface-3 bg-surface-1 p-6"
    >
      <div className="flex items-center justify-between">
        <MonoLabel className="text-white">settlement</MonoLabel>
        <MonoLabel className="text-signal">clock reached zero</MonoLabel>
      </div>

      <p className="font-mono text-sm text-paper">
        Anyone can finalize: the winner takes the NFT, the seller takes the highest bid.
      </p>

      {message !== null ? (
        <p role="alert" className="font-mono text-sm text-white">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onClick}
        disabled={isLoading || inFlight}
        className="border-2 border-white bg-white px-4 py-2 text-void transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <MonoLabel className="text-void">settle</MonoLabel>
      </button>
    </section>
  );
}
