import { MonoLabel } from '../components/MonoLabel';
import { RadialGauge } from '../components/RadialGauge';
import { Readout } from '../components/Readout';
import { StatusBadge } from '../components/StatusBadge';
import { formatAddress, formatCountdown, formatEth } from '../lib/format';
import { useAuctionState } from '../hooks/useAuctionState';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Primary auction readout area (contract §1): phase badge, countdown,
 * radial time arc, highest bid/bidder, and the escrowed NFT preview.
 *
 * The arc sweeps once per minute — the read model has no auction start
 * timestamp (§2), so the dial acts as a live seconds instrument while the
 * numeric countdown carries the absolute time remaining.
 */
export function AuctionPanel() {
  const {
    phase,
    nft,
    nftId,
    startingBid,
    highestBid,
    highestBidder,
    timeRemaining,
    isLoading,
    error,
  } = useAuctionState();

  const sweep = Number(timeRemaining % 60n) / 60;

  if (error) {
    return (
      <section aria-label="auction status" className="border border-surface-3 bg-surface-1 p-6">
        <div role="alert" className="flex flex-col gap-2">
          <MonoLabel className="text-white">chain unreachable</MonoLabel>
          <p className="font-mono text-sm text-paper">
            Cannot read auction state — retrying automatically.
          </p>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section aria-label="auction status" className="border border-surface-3 bg-surface-1 p-6">
        <div className="flex flex-col gap-2">
          <MonoLabel className="text-signal">status</MonoLabel>
          <MonoLabel className="text-white">reading chain…</MonoLabel>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="auction status"
      className="flex flex-col gap-6 border border-surface-3 bg-surface-1 p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <MonoLabel className="text-signal">status</MonoLabel>
          <StatusBadge phase={phase} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <MonoLabel className="text-signal">time remaining</MonoLabel>
          <span className="font-display text-3xl font-bold tabular-nums text-white">
            {formatCountdown(Number(timeRemaining))}
          </span>
        </div>
      </div>

      <RadialGauge value={sweep} label="time remaining" size={72} className="self-center" />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Readout
          label="highest bid"
          value={highestBid}
          unit="eth"
          hint={`starting bid ${formatEth(startingBid)}`}
        />
        <Readout
          label="highest bidder"
          value={highestBidder === ZERO_ADDRESS ? 'no bids yet' : formatAddress(highestBidder)}
        />
      </div>

      <div className="flex items-center justify-between border border-surface-3 bg-surface-2 px-4 py-3">
        <MonoLabel className="text-signal">escrowed nft</MonoLabel>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm text-paper">#{nftId}</span>
          <span className="font-mono text-sm text-signal">{formatAddress(nft)}</span>
        </div>
      </div>
    </section>
  );
}
