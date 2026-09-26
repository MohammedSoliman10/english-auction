import { useState } from 'react';
import { MonoLabel } from '../components/MonoLabel';
import { Readout } from '../components/Readout';
import { useAuctionState } from '../hooks/useAuctionState';
import { useWithdrawFunds } from '../hooks/useWithdrawFunds';

/**
 * Refund claim area (contract §1, matrix §3 — FR-005, US3).
 *
 * Renders only while a claim exists (`myRefundable > 0`), in ANY phase: a
 * credit stays claimable at any time after being outbid, so this secondary
 * area coexists with the phase's primary action instead of competing with it.
 * The "nothing to withdraw" rule is enforced pre-wallet (FR-004) by the hook's
 * validate() — surfaced inline, never as a wallet prompt.
 */
export function WithdrawPanel() {
  const { myRefundable, isLoading } = useAuctionState();
  const { validate, submit, tx } = useWithdrawFunds();
  const [message, setMessage] = useState<string | null>(null);

  if (myRefundable === 0n) return null;

  // Hold the CTA down while the claim walks the write state machine — a
  // double click must not fire a competing withdraw.
  const inFlight = tx.status === 'awaiting_confirmation' || tx.status === 'pending';

  function onClick() {
    const problem = validate();
    setMessage(problem);
    if (problem === null) submit();
  }

  return (
    <section
      aria-label="withdraw refund"
      className="flex flex-col gap-4 border border-surface-3 bg-surface-1 p-6"
    >
      <div className="flex items-center justify-between">
        <MonoLabel className="text-white">refund available</MonoLabel>
        <MonoLabel className="text-signal">outbid credit</MonoLabel>
      </div>

      <Readout
        label="my refundable"
        value={myRefundable}
        unit="eth"
        hint="credited when you were outbid"
      />

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
        <MonoLabel className="text-void">withdraw</MonoLabel>
      </button>
    </section>
  );
}
