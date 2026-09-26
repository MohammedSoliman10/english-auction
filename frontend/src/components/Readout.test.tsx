import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Readout } from './Readout';

describe('Readout', () => {
  it('formats bigint values as ETH through formatEth', () => {
    render(<Readout label="Highest bid" value={1_500_000_000_000_000_000n} unit="ETH" />);
    expect(screen.getByText('1.5')).toBeInTheDocument();
    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  it('renders plain string values untouched', () => {
    render(<Readout label="Phase" value="open for bids" />);
    expect(screen.getByText('open for bids')).toBeInTheDocument();
  });

  it('uppercases its label via MonoLabel', () => {
    render(<Readout label="time remaining" value="05:00" />);
    expect(getComputedStyle(screen.getByText('time remaining')).textTransform).toBe('uppercase');
  });

  it('shows an optional hint line', () => {
    render(<Readout label="end" value="05:00" hint="settlement enabled" />);
    expect(screen.getByText('settlement enabled')).toBeInTheDocument();
  });
});
