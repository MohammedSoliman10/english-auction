interface RadialGaugeProps {
  /** Progress 0..1 (clamped). */
  value: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Achromatic radial gauge: gray track + gray arc (contract §4).
 * Semantics are carried by the accessible label, not color.
 */
export function RadialGauge({
  value,
  label = 'radial gauge',
  size = 100,
  strokeWidth = 8,
  className = '',
}: RadialGaugeProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      className={className}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--color-surface-3)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--color-signal)"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeDasharray={`${clamped * circumference} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}
