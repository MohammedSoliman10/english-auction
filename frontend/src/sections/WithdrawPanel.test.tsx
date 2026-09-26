import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useWithdrawFunds: vi.fn(),
  useAuctionState: vi.fn(),
}));

vi.mock('../hooks/useWithdrawFunds', () => ({
  useWithdrawFunds: () => mocks.useWithdrawFunds(),
}));
vi.mock('../hooks/useAuctionState', () => ({
  useAuctionState: () => mocks.useAuctionState(),
}));

import { WithdrawPanel } from './WithdrawPanel';

const validate = vi.fn();
const submit = vi.fn();

const CLAIM = 500_000_000_000_000_000n; // 0.5 ETH (US3 scenario 1)

function auctionState(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'OPEN_FOR_BIDS',
    myRefundable: 0n,
    isLoading: false,
    error: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  validate.mockReturnValue(null);
  mocks.useAuctionState.mockImplementation(() => auctionState());
  mocks.useWithdrawFunds.mockImplementation(() => ({
    validate,
    submit,
    tx: { status: 'idle' },
  }));
});

describe('WithdrawPanel — US3 / FR-005 (contract §1)', () => {
  it('shows the claimable readout and withdraw CTA when myRefundable > 0', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ myRefundable: CLAIM }),
    );
    render(<WithdrawPanel />);
    expect(screen.getByText('my refundable')).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^withdraw$/i })).toBeEnabled();
  });

  it('renders nothing when there is no claim (hidden at 0)', () => {
    const { container } = render(<WithdrawPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('blocks with the catalogue message and never prompts the wallet when blocked', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ myRefundable: CLAIM }),
    );
    validate.mockReturnValue('Nothing to withdraw');
    render(<WithdrawPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^withdraw$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Nothing to withdraw');
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits when validation passes', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ myRefundable: CLAIM }),
    );
    render(<WithdrawPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^withdraw$/i }));

    expect(validate).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('post-withdraw reset hides the panel (scenario 1 — readout resets to zero)', () => {
    let refundable = CLAIM;
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ myRefundable: refundable }),
    );
    const { container, rerender } = render(<WithdrawPanel />);
    expect(screen.getByRole('button', { name: /^withdraw$/i })).toBeInTheDocument();

    refundable = 0n; // chain re-read after the claim mined
    rerender(<WithdrawPanel />);

    expect(container.firstChild).toBeNull();
  });

  it('disables the CTA while the claim is in flight', () => {
    mocks.useAuctionState.mockImplementation(() =>
      auctionState({ myRefundable: CLAIM }),
    );
    mocks.useWithdrawFunds.mockImplementation(() => ({
      validate,
      submit,
      tx: { status: 'awaiting_confirmation' },
    }));
    render(<WithdrawPanel />);
    expect(screen.getByRole('button', { name: /^withdraw$/i })).toBeDisabled();
  });
});
