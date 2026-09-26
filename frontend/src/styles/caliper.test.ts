import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * T063 — design-token contract tests (SC-004 achromatic ramp, SC-007
 * contrast, FR-012 focus visibility). The palette gate (check.sh #8) keeps
 * literals out of the rest of `src/`; these tests pin the values that live
 * in `caliper.css` itself and the accessibility guarantees derived from them.
 *
 * NOTE: characterization tests over already-shipped styles (documented
 * test-first protocol exception — the styles predate the tests).
 */
const css = readFileSync(resolve(process.cwd(), 'src/styles/caliper.css'), 'utf8');

function tokens(pattern: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of css.matchAll(pattern)) out[match[1]] = match[2];
  return out;
}

const themeColors = tokens(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g);
const rampSteps = tokens(/--bar-step-(\d+):\s*(#[0-9a-fA-F]{6})/g);

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const linear = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('caliper.css — SC-004 design-token contract', () => {
  it('defines exactly the 7 ramp tokens from the spec table', () => {
    expect(Object.keys(themeColors).sort()).toEqual([
      'paper',
      'signal',
      'surface-1',
      'surface-2',
      'surface-3',
      'void',
      'white',
    ]);
    expect(themeColors['void']).toBe('#0a0d09');
    expect(themeColors['surface-1']).toBe('#131519');
    expect(themeColors['surface-2']).toBe('#1d2026');
    expect(themeColors['surface-3']).toBe('#2a2e35');
    expect(themeColors['signal']).toBe('#979c99');
    expect(themeColors['paper']).toBe('#f4f5f7');
    expect(themeColors['white']).toBe('#ffffff');
  });

  it('keeps every token and signal-bar step achromatic (channel spread ≤ 16)', () => {
    const all = { ...themeColors, ...rampSteps };
    expect(Object.keys(all).length).toBe(20); // 7 tokens + 13 steps
    for (const [name, hex] of Object.entries(all)) {
      const [r, g, b] = rgb(hex);
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      expect(spread, `${name} ${hex} spread ${spread}`).toBeLessThanOrEqual(16);
    }
  });

  it('renders the full 13-step grayscale signal ramp', () => {
    expect(Object.keys(rampSteps)).toHaveLength(13);
    expect(rampSteps['0']).toBe('#131519');
    expect(rampSteps['12']).toBe('#ffffff');
  });
});

describe('caliper.css — SC-007 / FR-012 accessibility contract', () => {
  it('paper-on-void body contrast is at least 14:1', () => {
    const ratio = contrast(themeColors['paper'], themeColors['void']);
    expect(ratio).toBeGreaterThanOrEqual(14);
    expect(ratio).toBeGreaterThan(17); // measured ~17.9
  });

  it('body paints paper text on the void background', () => {
    // the standalone `body { … }` rule (not `html, body, #root`)
    const bodyRule = css.match(/(?:^|})\s*body\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(bodyRule).toContain('background-color: var(--color-void)');
    expect(bodyRule).toContain('color: var(--color-paper)');
  });

  it('focus-visible draws the white achromatic ring (FR-012)', () => {
    const focusRule = css.match(/:focus-visible\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(focusRule).toContain('outline: 2px solid var(--color-white)');
    expect(focusRule).toContain('outline-offset: 2px');
  });
});
