import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HairlineGrid } from './HairlineGrid';

describe('HairlineGrid', () => {
  it('renders a decorative, hidden grid layer', () => {
    const { container } = render(<HairlineGrid />);
    const grid = container.querySelector('[data-testid="hairline-grid"]');
    expect(grid).not.toBeNull();
    expect(grid?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws 1px lines in the surface-3 token', () => {
    const { container } = render(<HairlineGrid />);
    const style = container.querySelector<HTMLElement>(
      '[data-testid="hairline-grid"]',
    )!.style;
    expect(style.backgroundImage).toContain('var(--color-surface-3)');
    expect(style.backgroundImage).toContain('1px');
  });

  it('supports a custom cell size', () => {
    const { container } = render(<HairlineGrid cell={32} />);
    const style = container.querySelector<HTMLElement>(
      '[data-testid="hairline-grid"]',
    )!.style;
    expect(style.backgroundSize).toBe('32px 32px');
  });
});
