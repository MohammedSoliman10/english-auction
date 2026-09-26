import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RadialGauge } from './RadialGauge';

const readSrc = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), 'utf8');

describe('RadialGauge', () => {
  it('renders a track and a progress arc in gray tokens', () => {
    const { container } = render(<RadialGauge value={0.5} label="time remaining" />);
    const arcs = [...container.querySelectorAll('circle')];
    expect(arcs).toHaveLength(2);
    expect(arcs[0].getAttribute('stroke')).toBe('var(--color-surface-3)');
    expect(arcs[1].getAttribute('stroke')).toBe('var(--color-signal)');
  });

  it('scales the arc with value and clamps out-of-range input', () => {
    const low = render(<RadialGauge value={0.1} />);
    const lowArc = low.container.querySelectorAll('circle')[1].getAttribute('stroke-dasharray');
    const high = render(<RadialGauge value={1} />);
    const highArc = high.container.querySelectorAll('circle')[1].getAttribute('stroke-dasharray');
    const clamped = render(<RadialGauge value={2.5} />);
    const clampedArc = clamped.container.querySelectorAll('circle')[1].getAttribute('stroke-dasharray');
    expect(lowArc).not.toBe(highArc);
    expect(clampedArc).toBe(highArc);
  });

  it('is exposed to assistive tech with a label', () => {
    const { container } = render(<RadialGauge value={0.5} label="time remaining" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('time remaining');
  });

  it('contains no color literals in its source (SC-004)', () => {
    const source = readSrc('src/components/RadialGauge.tsx');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|hsl|oklch)a?\(/);
  });
});
