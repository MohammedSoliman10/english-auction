import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  usePlaceBid: vi.fn(),
  useAuctionState: vi.fn(),
}));

vi.mock('../hooks/usePlaceBid', () => ({
  usePlaceBid: () => mocks.usePlaceBid(),
}));
vi.mock('../hooks/useAuctionState', () => ({
  useAuctionState: () => mocks.useAuctionState(),
}));

import { BidForm } from './BidForm';

const validate = vi.fn();
const submit = vi.fn();

function auctionState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'OPEN_FOR_BIDS',
    highestBid: 100_000_000_000_000_000n, // 0.1 — the floor to exceed
    isLoading: false,
    ...overrides,
  };
}

function renderForm() {
  return render(<BidForm />);
}

function typeAmount(value: string) {
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  validate.mockReturnValue(null);
  mocks.usePlaceBid.mockImplementation(() => ({ validate, submit, tx: { status: 'idle' } }));
  mocks.useAuctionState.mockImplementation(() => auctionState());
});

describe('BidForm — matrix §3 disabled states (FR-004)', () => {
  it('enables bidding only in OPEN_FOR_BIDS', () => {
    const open = renderForm();
    expect(screen.getByRole('button', { name: /place bid/i })).toBeEnabled();
    open.unmount();

    for (const phase of ['NOT_STARTED', 'AWAITING_SETTLEMENT', 'SETTLED']) {
      mocks.useAuctionState.mockImplementation(() => auctionState({ phase }));
      const mounted = renderForm();
      expect(screen.getByRole('button', { name: /place bid/i })).toBeDisabled();
      mounted.unmount();
    }
  });

  it('states the exact floor to exceed', () => {
    renderForm();
    expect(screen.getByText(/bid > 0\.1 eth/i)).toBeInTheDocument();
  });
});

describe('BidForm — pre-wallet validation (FR-003/FR-004, V4)', () => {
  it('shows the catalogue message and never calls submit when too low', () => {
    validate.mockReturnValue('Bid must exceed current highest');
    renderForm();
    typeAmount('0.1');
    fireEvent.click(screen.getByRole('button', { name: /place bid/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Bid must exceed current highest',
    );
    expect(submit).not.toHaveBeenCalled();
    expect(validate).toHaveBeenCalledWith(100_000_000_000_000_000n);
  });

  it('rejects an unparseable amount without touching the hook', () => {
    renderForm();
    typeAmount('abc');
    fireEvent.click(screen.getByRole('button', { name: /place bid/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/valid eth amount/i);
    expect(validate).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits the parsed wei when valid', () => {
    renderForm();
    typeAmount('0.002');
    fireEvent.click(screen.getByRole('button', { name: /place bid/i }));

    expect(validate).toHaveBeenCalledWith(2_000_000_000_000_000n);
    expect(submit).toHaveBeenCalledWith(2_000_000_000_000_000n);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
