import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MonoLabel } from './MonoLabel';

describe('MonoLabel', () => {
  it('renders its children as an uppercase micro-label', () => {
    render(<MonoLabel>highest bid</MonoLabel>);
    const el = screen.getByText('highest bid');
    expect(el).toBeInTheDocument();
    expect(getComputedStyle(el).textTransform).toBe('uppercase');
  });

  it('sets letter-spacing >= 0.12em (contract §4)', () => {
    render(<MonoLabel>bid</MonoLabel>);
    const spacing = parseFloat(getComputedStyle(screen.getByText('bid')).letterSpacing);
    expect(Number.isFinite(spacing)).toBe(true);
    expect(spacing).toBeGreaterThanOrEqual(0.12);
  });

  it('uses the monospace utility class', () => {
    render(<MonoLabel>time remaining</MonoLabel>);
    expect(screen.getByText('time remaining').classList.contains('font-mono')).toBe(true);
  });
});
