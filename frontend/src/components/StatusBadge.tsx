import type { AuctionPhase } from '../lib/types';
import { MonoLabel } from './MonoLabel';

interface StatusBadgeProps {
  phase: AuctionPhase;
  className?: string;
}

/** Phase → readable uppercase text (state by words, not hue — SC-004). */
const PHASE_TEXT: Record<AuctionPhase, string> = {
  NOT_STARTED: 'NOT STARTED',
  OPEN_FOR_BIDS: 'OPEN FOR BIDS',
  AWAITING_SETTLEMENT: 'AWAITING SETTLEMENT',
  SETTLED: 'SETTLED',
};

/** Phase → border shape (state is also encoded in shape, FR-011). */
const PHASE_SHAPE: Record<AuctionPhase, string> = {
  NOT_STARTED: 'dashed',
  OPEN_FOR_BIDS: 'solid',
  AWAITING_SETTLEMENT: 'double',
  SETTLED: 'dotted',
};

/**
 * Achromatic phase badge: uppercase text + distinct border shape per phase.
 */
export function StatusBadge({ phase, className = '' }: StatusBadgeProps) {
  const shape = PHASE_SHAPE[phase];
  return (
    <span
      role="status"
      data-phase={phase}
      data-shape={shape}
      className={`inline-flex items-center border-2 border-signal bg-surface-2 px-3 py-1 ${className}`}
      style={{ borderStyle: shape }}
    >
      <MonoLabel className="text-paper">{PHASE_TEXT[phase]}</MonoLabel>
    </span>
  );
}
