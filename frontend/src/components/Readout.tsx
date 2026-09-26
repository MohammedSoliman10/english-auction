import { formatEth } from '../lib/format';
import { MonoLabel } from './MonoLabel';

interface ReadoutProps {
  label: string;
  value: bigint | string;
  unit?: string;
  hint?: string;
  className?: string;
}

/**
 * Instrument-panel value readout: mono label over a large tabular value.
 * Bigints render as exact ETH (formatEth); strings pass through untouched.
 */
export function Readout({ label, value, unit, hint, className = '' }: ReadoutProps) {
  const display = typeof value === 'bigint' ? formatEth(value) : value;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <MonoLabel>{label}</MonoLabel>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold tabular-nums text-paper sm:text-4xl">
          {display}
        </span>
        {unit ? <MonoLabel className="text-signal">{unit}</MonoLabel> : null}
      </div>
      {hint ? <MonoLabel className="text-surface-3">{hint}</MonoLabel> : null}
    </div>
  );
}
