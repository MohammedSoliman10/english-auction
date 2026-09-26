import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignalBars } from './SignalBars';

const readSrc = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), 'utf8');

describe('SignalBars', () => {
  it('renders exactly 13 bars — the 13-step grayscale ramp', () => {
    const { container } = render(<SignalBars values={[0.2, 0.5, 1]} />);
    const bars = container.querySelectorAll('rect');
    expect(bars).toHaveLength(13);
  });

  it('fills each bar with its ramp step token (no literals in source)', () => {
    const { container } = render(<SignalBars values={[1]} />);
    const bars = [...container.querySelectorAll('rect')];
    bars.forEach((bar, i) => {
      expect(bar.getAttribute('fill')).toBe(`var(--bar-step-${i})`);
    });
    const source = readSrc('src/components/SignalBars.tsx');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|hsl|oklch)a?\(/);
  });

  it('uses values as heights (missing values collapse to 0)', () => {
    const { container } = render(<SignalBars values={[1, 0.5]} />);
    const bars = [...container.querySelectorAll('rect')];
    expect(Number(bars[0].getAttribute('height'))).toBeGreaterThan(
      Number(bars[1].getAttribute('height')),
    );
    expect(Number(bars[12].getAttribute('height'))).toBe(0);
  });

  it('defines all 13 ramp steps as near-gray hex values in caliper.css', () => {
    const css = readSrc('src/styles/caliper.css');
    const steps = [...css.matchAll(/--bar-step-(\d+):\s*#([0-9a-fA-F]{6})/g)];
    expect(steps).toHaveLength(13);
    for (const [, index, hex] of steps) {
      expect(Number(index)).toBeGreaterThanOrEqual(0);
      expect(Number(index)).toBeLessThanOrEqual(12);
      const channels = [0, 2, 4].map((off) => parseInt(hex.slice(off, off + 2), 16));
      const spread = Math.max(...channels) - Math.min(...channels);
      expect(spread).toBeLessThanOrEqual(16); // achromatic tolerance (SC-004)
    }
  });
});
