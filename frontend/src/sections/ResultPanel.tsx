import { zeroAddress } from 'viem';
import { MonoLabel } from '../components/MonoLabel';
import { Readout } from '../components/Readout';
import { formatAddress } from '../lib/format';
import { useAuctionState } from '../hooks/useAuctionState';

/**
 * Final result (contract §1, matrix §3 SETTLED row — US4 scenarios 1–2).
 *
 * Renders only once the auction is SETTLED. Winner is keyed on
 * `highestBidder != 0` — never on the amount: with zero bids the contract's
 * `highestBid` still holds the starting-bid floor (characterized in T050),
 * which must not masquerade as a real result ("NO BIDS" instead).
 */
export function ResultPanel() {
  const { phase, highestBidder, highestBid } = useAuctionState();

  if (phase !== 'SETTLED') return null;

  const noBids = highestBidder.toLowerCase() === zeroAddress;

  return (
    <section
      aria-label="auction result"
      className="flex flex-col gap-4 border border-surface-3 bg-surface-1 p-6"
    >
      <div className="flex items-center justify-between">
        <MonoLabel className="text-white">auction result</MonoLabel>
        <MonoLabel className="text-signal">settled</MonoLabel>
      </div>

      {noBids ? (
        <>
          <MonoLabel className="text-white">NO BIDS</MonoLabel>
          <p className="font-mono text-sm text-paper">
            Nobody bid — the NFT returned to the seller.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <Readout label="winner" value={formatAddress(highestBidder)} />
          <Readout label="final bid" value={highestBid} unit="eth" />
        </div>
      )}
    </section>
  );
}
