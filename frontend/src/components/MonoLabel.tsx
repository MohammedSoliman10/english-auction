import type { ReactNode } from 'react';

interface MonoLabelProps {
  children: ReactNode;
  className?: string;
}

/**
 * Monospace uppercase micro-label (contract §4: letter-spacing ≥ 0.12em).
 * Typographic guarantees are set inline so they are component-invariant.
 */
export function MonoLabel({ children, className = '' }: MonoLabelProps) {
  return (
    <span
      className={`font-mono text-[11px] font-medium text-signal ${className}`}
      style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}
    >
      {children}
    </span>
  );
}
