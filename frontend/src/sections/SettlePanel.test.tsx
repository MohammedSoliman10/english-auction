import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useSettleAuction: vi.fn(),
  useAuctionState: vi.fn(),
}));

vi.mock('../hooks/useSettleAuction', () => ({
  useSettleAuction: () => mocks.useSettleAuction(),
}));
vi.mock('../hooks/useAuctionState', () => ({
  useAuctionState: () => mocks.useAuctionState(),
}));

import { SettlePanel } from './SettlePanel';

const validate = vi.fn();
const submit = vi.fn();

function auctionState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'AWAITING_SETTLEMENT',
    isLoading: false,
    error: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  validate.mockReturnValue(null);
  mocks.useAuctionState.mockImplementation(() => auctionState());
  mocks.useSettleAuction.mockImplementation(() => ({
    validate,
    submit,
    tx: { status: 'idle' },
  }));
});

describe('SettlePanel — US4 / matrix §3 (anyone settles)', () => {
  it('shows the settle CTA in AWAITING_SETTLEMENT', () => {
    render(<SettlePanel />);
    expect(screen.getByText('settlement')).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: /^settle$/i });
    expect(cta).toBeEnabled();
  });

  it('renders nothing outside the settle window (phase-exclusive)', () => {
    for (const phase of ['NOT_STARTED', 'OPEN_FOR_BIDS', 'SETTLED']) {
      mocks.useAuctionState.mockImplementation(() => auctionState({ phase }));
      const { container, unmount } = render(<SettlePanel />);
      expect(container.firstChild).toBeNull();
      unmount();
    }
  });

  it('blocks with the phase message and never prompts the wallet', async () => {
    validate.mockReturnValue('Auction is still in progress');
    render(<SettlePanel />);

    fireEvent.click(screen.getByRole('button', { name: /^settle$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Auction is still in progress');
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits when validation passes', () => {
    render(<SettlePanel />);

    fireEvent.click(screen.getByRole('button', { name: /^settle$/i }));

    expect(validate).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables the CTA while settlement is in flight', () => {
    mocks.useSettleAuction.mockImplementation(() => ({
      validate,
      submit,
      tx: { status: 'pending' },
    }));
    render(<SettlePanel />);
    expect(screen.getByRole('button', { name: /^settle$/i })).toBeDisabled();
  });

  it('disables the CTA while auction reads are loading', () => {
    mocks.useAuctionState.mockImplementation(() => auctionState({ isLoading: true }));
    render(<SettlePanel />);
    expect(screen.getByRole('button', { name: /^settle$/i })).toBeDisabled();
  });
});
