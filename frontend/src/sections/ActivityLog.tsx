import { SignalBars } from '../components/SignalBars';
import { MonoLabel } from '../components/MonoLabel';
import { formatAddress, formatEth } from '../lib/format';
import { useActivityLog, type ActivityEntry } from '../hooks/useActivityLog';

/** Block timestamps are Unix seconds — render deterministic UTC HH:MM:SS. */
function formatLogTime(time: bigint): string {
  return new Date(Number(time) * 1000).toISOString().slice(11, 19);
}

/**
 * FR-009 activity log (contract §1): Start/Bid/Withdraw/End events as a
 * mono table — actor, amount, time — newest first, plus a grayscale
 * signal-bar history of bid sizes (SC-004: read by height, never hue).
 */
export function ActivityLog() {
  const { entries, isLoading, error } = useActivityLog();

  const bidValues = entries
    .filter((entry) => entry.kind === 'Bid' && entry.amount !== undefined)
    .map((entry) => Number(entry.amount));
  const maxBid = bidValues.length > 0 ? Math.max(...bidValues) : 0;
  const bars = bidValues.slice(0, 13).map((value) => (maxBid > 0 ? value / maxBid : 0));

  return (
    <section
      aria-label="activity log"
      className="flex flex-col gap-4 border border-surface-3 bg-surface-1 p-6"
    >
      <div className="flex items-center justify-between">
        <MonoLabel className="text-signal">activity log</MonoLabel>
        <SignalBars values={bars} />
      </div>

      {isLoading ? (
        <MonoLabel className="text-white">reading activity…</MonoLabel>
      ) : error ? (
        <p role="alert" className="font-mono text-sm text-white">
          chain unreachable — activity unavailable.
        </p>
      ) : entries.length === 0 ? (
        <MonoLabel className="text-signal">no activity yet</MonoLabel>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry: ActivityEntry) => (
            <li
              key={entry.id}
              className="grid grid-cols-[5.5rem_1fr_auto_5rem] items-baseline gap-3 border-t border-surface-3 py-2 font-mono text-xs"
            >
              <span className="text-white">{entry.kind.toUpperCase()}</span>
              <span className="truncate text-paper">
                {entry.actor ? formatAddress(entry.actor) : '—'}
              </span>
              <span className="tabular-nums text-paper">
                {entry.amount !== undefined ? `${formatEth(entry.amount)} eth` : '—'}
              </span>
              <span className="tabular-nums text-signal">{formatLogTime(entry.time)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
