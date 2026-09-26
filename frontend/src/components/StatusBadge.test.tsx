import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';
import type { AuctionPhase } from '../lib/types';

const CASES: Array<[AuctionPhase, string]> = [
  ['NOT_STARTED', 'NOT STARTED'],
  ['OPEN_FOR_BIDS', 'OPEN FOR BIDS'],
  ['AWAITING_SETTLEMENT', 'AWAITING SETTLEMENT'],
  ['SETTLED', 'SETTLED'],
];

describe('StatusBadge', () => {
  it.each(CASES)('renders %s as readable uppercase text', (phase, text) => {
    render(<StatusBadge phase={phase} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('is announced as status', () => {
    render(<StatusBadge phase="OPEN_FOR_BIDS" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('conveys state by shape, not hue (distinct shapes per phase)', () => {
    const { container } = render(<StatusBadge phase="NOT_STARTED" />);
    const { container: container2 } = render(<StatusBadge phase="AWAITING_SETTLEMENT" />);
    const shape1 = container.querySelector('[data-shape]')?.getAttribute('data-shape');
    const shape2 = container2.querySelector('[data-shape]')?.getAttribute('data-shape');
    expect(shape1).toBeTruthy();
    expect(shape2).toBeTruthy();
    expect(shape1).not.toBe(shape2);
  });
});
