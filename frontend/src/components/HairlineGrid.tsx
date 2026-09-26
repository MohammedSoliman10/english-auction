interface HairlineGridProps {
  /** Grid cell size in px (default 48). */
  cell?: number;
  className?: string;
}

/**
 * Full-bleed 1px hairline grid layer in `--color-surface-3` (contract §4).
 * Purely decorative — hidden from assistive tech.
 */
export function HairlineGrid({ cell = 48, className = '' }: HairlineGridProps) {
  const line = 'var(--color-surface-3)';
  return (
    <div
      data-testid="hairline-grid"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `${cell}px ${cell}px`,
      }}
    />
  );
}
