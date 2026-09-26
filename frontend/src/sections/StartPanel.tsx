import { useState, type FormEvent } from 'react';
import { MonoLabel } from '../components/MonoLabel';
import { formatAddress, formatEth } from '../lib/format';
import { useAuctionState } from '../hooks/useAuctionState';
import { useStartAuction } from '../hooks/useStartAuction';

/**
 * Seller-only launch area (contract §1, matrix §3 NOT_STARTED row).
 *
 * Renders nothing outside NOT_STARTED — panels are mutually exclusive by
 * phase (FR-004), so the start action can never compete with another one.
 * Non-sellers get a read-only waiting state (no dead CTA to click).
 */
export function StartPanel() {
  const { phase, seller, nftId, startingBid, isLoading, isSeller } = useAuctionState();
  const { validate, submit, tx } = useStartAuction();
  const [message, setMessage] = useState<string | null>(null);

  if (phase !== 'NOT_STARTED') return null;

  // approve → start runs as one sequence (two prompts) — hold the CTA down
  // so a double click cannot launch a competing escrow.
  const inFlight = tx.status === 'awaiting_confirmation' || tx.status === 'pending';

  if (!isSeller) {
    return (
      <section
        aria-label="auction not started"
        className="flex flex-col gap-3 border border-surface-3 bg-surface-1 p-6"
      >
        <div className="flex items-center justify-between">
          <MonoLabel className="text-white">waiting for the seller</MonoLabel>
          <MonoLabel className="text-signal">auction not started</MonoLabel>
        </div>
        <p className="font-mono text-sm text-paper">
          {formatAddress(seller)} must escrow the NFT and start the auction.
        </p>
      </section>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate();
    setMessage(problem);
    if (problem === null) submit();
  }

  return (
    <section
      aria-label="start auction"
      className="flex flex-col gap-4 border border-surface-3 bg-surface-1 p-6"
    >
      <div className="flex items-center justify-between">
        <MonoLabel className="text-white">auction not started</MonoLabel>
        <MonoLabel className="text-signal">seller action</MonoLabel>
      </div>

      <p className="font-mono text-sm text-paper">
        Escrow NFT #{nftId} into the auction contract to open bidding — first bid must
        exceed {formatEth(startingBid)} ETH.
      </p>

      {message !== null ? (
        <p role="alert" className="font-mono text-sm text-white">
          {message}
        </p>
      ) : null}

      <form onSubmit={onSubmit}>
        <button
          type="submit"
          disabled={isLoading || inFlight}
          className="border-2 border-white bg-white px-4 py-2 text-void transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MonoLabel className="text-void">start auction</MonoLabel>
        </button>
      </form>
    </section>
  );
}
