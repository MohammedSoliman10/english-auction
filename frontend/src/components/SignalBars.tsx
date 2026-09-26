interface SignalBarsProps {
  /** Per-step intensity 0..1; missing steps render at height 0. */
  values?: readonly number[];
  className?: string;
}

const BAR_COUNT = 13; // fixed 13-step grayscale ramp (contract §4)
const MAX_HEIGHT = 32;
const BAR_WIDTH = 6;
const BAR_GAP = 2;

/**
 * Grayscale signal-bar readout — 13 fixed steps filled by ramp token
 * `--bar-step-0…12` (defined in caliper.css). State reads by height + text,
 * never by hue (SC-004).
 */
export function SignalBars({ values = [], className = '' }: SignalBarsProps) {
  const step = BAR_WIDTH + BAR_GAP;
  return (
    <svg
      viewBox={`0 0 ${BAR_COUNT * step - BAR_GAP} ${MAX_HEIGHT}`}
      className={`h-8 w-auto ${className}`}
      role="img"
      aria-label="signal history"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const raw = values[i] ?? 0;
        const value = Math.min(1, Math.max(0, raw));
        const height = value * MAX_HEIGHT;
        return (
          <rect
            key={i}
            data-step={i}
            x={i * step}
            y={MAX_HEIGHT - height}
            width={BAR_WIDTH}
            height={height}
            fill={`var(--bar-step-${i})`}
          />
        );
      })}
    </svg>
  );
}
